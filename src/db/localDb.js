import Dexie from 'dexie';
import { supabase, isSupabaseConfigured } from '../supabaseClient';
import { COMPANY_CONFIG } from '../config/companyConfig';

// ----------------- DEXIE LOCAL DATABASE SCHEMA -----------------
export const db = new Dexie('VishakhaQuotationDB');

db.version(1).stores({
  customers: '++localId, id, name, place, synced',
  quotations: '++localId, id, quote_no, quote_date, customer_id, synced',
  quotation_items: '++localId, id, quotation_id, quotation_local_id, sl_no, description, qty, price, total, synced',
  materials: '++localId, id, name, code, synced',
  company_profile: '++localId, id, synced'
});

// Helper for generating UUIDs offline
export function generateOfflineUuid() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ----------------- ONE-TIME MIGRATION: PURGE INVALID / SEED RECORDS -----------------
export async function purgeInvalidLocalRecords() {
  try {
    // 1. Clear legacy demo keys from localStorage
    const demoKeys = [
      'vishakha_demo_quotations',
      'vishakha_demo_items',
      'vishakha_demo_materials',
      'vishakha_demo_customers'
    ];
    demoKeys.forEach((k) => {
      try {
        localStorage.removeItem(k);
      } catch (e) {}
    });

    // 2. Strict UUID regex (standard 8-4-4-4-12 hex format)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    const isInvalid = (id) => {
      if (!id || typeof id !== 'string') return true;
      const clean = id.trim();
      // Test regex: must be a valid standard UUID
      if (!uuidRegex.test(clean)) return true;
      // Also reject known seed pattern IDs (e.g., a0000000-..., b1000000-..., c1000000-..., e1000000-...)
      if (/^[a-e][0-9]000000-0000-4000-8000-[0-9]{12}$/i.test(clean)) return true;
      return false;
    };

    // Purge invalid quotations
    const quotes = await db.quotations.toArray();
    for (const q of quotes) {
      if (isInvalid(q.id)) {
        console.log('[Migration] Purging invalid/seed local quotation:', q.id || q.localId);
        await db.quotations.delete(q.localId);
      }
    }

    // Purge invalid quotation items
    const items = await db.quotation_items.toArray();
    for (const item of items) {
      if (isInvalid(item.id) || (item.quotation_id && isInvalid(item.quotation_id))) {
        console.log('[Migration] Purging invalid/seed local quotation item:', item.id || item.localId);
        await db.quotation_items.delete(item.localId);
      }
    }

    // Purge invalid materials
    const materials = await db.materials.toArray();
    for (const mat of materials) {
      if (isInvalid(mat.id)) {
        console.log('[Migration] Purging invalid/seed local material:', mat.name, mat.id || mat.localId);
        await db.materials.delete(mat.localId);
      }
    }

    // Purge invalid customers
    const customers = await db.customers.toArray();
    for (const cust of customers) {
      if (isInvalid(cust.id)) {
        console.log('[Migration] Purging invalid/seed local customer:', cust.name, cust.id || cust.localId);
        await db.customers.delete(cust.localId);
      }
    }

    console.log('[Migration] Invalid local records checked/purged.');
  } catch (err) {
    console.warn('[Migration] Error purging invalid local records:', err);
  }
}

// ----------------- SYNC FROM SUPABASE (MIRROR CLOUD AS SOURCE OF TRUTH) -----------------
export async function syncFromSupabase() {
  if (!isSupabaseConfigured || !supabase || !navigator.onLine) {
    return;
  }

  try {
    console.log('[Dexie Sync] Mirroring cloud data from Supabase to Dexie...');

    // 1. Fetch Customers
    const { data: remoteCustomers, error: cErr } = await supabase.from('customers').select('*');
    if (!cErr && remoteCustomers !== null) {
      const remoteCustIdSet = new Set(remoteCustomers.map((c) => c.id));
      const localSyncedCusts = await db.customers.filter((c) => c.synced !== false).toArray();
      for (const lc of localSyncedCusts) {
        if (!remoteCustIdSet.has(lc.id)) {
          await db.customers.delete(lc.localId);
        }
      }
      for (const rc of remoteCustomers) {
        const local = await db.customers.where('id').equals(rc.id).first();
        if (local) {
          await db.customers.update(local.localId, { ...rc, synced: true });
        } else {
          await db.customers.add({ ...rc, synced: true });
        }
      }
    }

    // 2. Fetch Active Materials (soft delete is_active = true)
    const { data: remoteMaterials, error: mErr } = await supabase
      .from('materials')
      .select('*')
      .eq('is_active', true);

    if (!mErr && remoteMaterials !== null) {
      const remoteMatIdSet = new Set(remoteMaterials.map((m) => m.id));
      const localSyncedMats = await db.materials.filter((m) => m.synced !== false).toArray();
      for (const lm of localSyncedMats) {
        // Drop items that are no longer active or present in Supabase
        if (!remoteMatIdSet.has(lm.id)) {
          await db.materials.delete(lm.localId);
        }
      }
      for (const rm of remoteMaterials) {
        const local = await db.materials.where('id').equals(rm.id).first();
        if (local) {
          await db.materials.update(local.localId, { ...rm, synced: true });
        } else {
          await db.materials.add({ ...rm, synced: true });
        }
      }
    }

    // 3. Fetch Company Profile
    const { data: remoteProfile, error: pErr } = await supabase.from('company_profile').select('*').limit(1).maybeSingle();
    if (!pErr && remoteProfile) {
      const local = await db.company_profile.where('id').equals(remoteProfile.id).first() || await db.company_profile.toCollection().first();
      if (local) {
        await db.company_profile.update(local.localId, { ...remoteProfile, synced: true });
      } else {
        await db.company_profile.add({ ...remoteProfile, synced: true });
      }
    }

    // 4. Fetch Quotations
    const { data: remoteQuotations, error: qErr } = await supabase
      .from('quotations')
      .select('*')
      .order('created_at', { ascending: false });

    if (!qErr && remoteQuotations !== null) {
      const remoteQuoteIdSet = new Set(remoteQuotations.map((q) => q.id));
      const localSyncedQuotes = await db.quotations.filter((q) => q.synced !== false).toArray();
      for (const lq of localSyncedQuotes) {
        if (!remoteQuoteIdSet.has(lq.id)) {
          await db.quotations.delete(lq.localId);
        }
      }
      for (const rq of remoteQuotations) {
        const local = await db.quotations.where('id').equals(rq.id).first();
        if (local) {
          if (local.synced !== false) {
            await db.quotations.update(local.localId, { ...rq, synced: true });
          }
        } else {
          await db.quotations.add({ ...rq, synced: true });
        }
      }
    }

    // 5. Fetch Quotation Items
    const { data: remoteItems, error: iErr } = await supabase.from('quotation_items').select('*');
    if (!iErr && remoteItems !== null) {
      const remoteItemIdSet = new Set(remoteItems.map((i) => i.id));
      const localSyncedItems = await db.quotation_items.filter((i) => i.synced !== false).toArray();
      for (const li of localSyncedItems) {
        if (!remoteItemIdSet.has(li.id)) {
          await db.quotation_items.delete(li.localId);
        }
      }
      for (const ri of remoteItems) {
        const local = await db.quotation_items.where('id').equals(ri.id).first();
        if (local) {
          if (local.synced !== false) {
            await db.quotation_items.update(local.localId, { ...ri, synced: true });
          }
        } else {
          await db.quotation_items.add({ ...ri, synced: true });
        }
      }
    }

    console.log('[Dexie Sync] Mirror complete.');
  } catch (err) {
    console.warn('[Dexie Sync] Sync from Supabase encountered an error:', err);
  }
}

// ----------------- SYNC PENDING CHANGES (LOCAL -> SUPABASE) -----------------
let isSyncing = false;
let retryAttempt = 0;
const MAX_BACKOFF_MS = 30000;

export async function syncPendingChanges() {
  if (!navigator.onLine || !isSupabaseConfigured || !supabase) {
    return;
  }

  if (isSyncing) return;
  isSyncing = true;

  try {
    // A. Sync Unsynced Customers First
    const unsyncedCustomers = await db.customers.filter((c) => !c.synced).toArray();
    for (const cust of unsyncedCustomers) {
      try {
        const payload = {
          name: cust.name,
          place: cust.place || ''
        };
        if (cust.id) {
          payload.id = cust.id;
        }

        const { data, error } = await supabase
          .from('customers')
          .upsert(payload)
          .select()
          .single();

        if (!error && data) {
          await db.customers.update(cust.localId, { id: data.id, synced: true });
        }
      } catch (e) {
        console.warn('[Sync] Failed to sync customer:', e);
      }
    }

    // B. Sync Unsynced Materials
    const unsyncedMaterials = await db.materials.filter((m) => !m.synced).toArray();
    for (const mat of unsyncedMaterials) {
      try {
        const payload = {
          name: mat.name,
          code: mat.code || '',
          unit: mat.unit || 'Nos',
          rate: parseFloat(mat.rate) || 0,
          description: mat.description || '',
          is_active: mat.is_active !== false
        };
        if (mat.id) payload.id = mat.id;

        const { data, error } = await supabase
          .from('materials')
          .upsert(payload)
          .select()
          .single();

        if (!error && data) {
          await db.materials.update(mat.localId, { id: data.id, synced: true });
        }
      } catch (e) {
        console.warn('[Sync] Failed to sync material:', e);
      }
    }

    // C. Sync Unsynced Quotations
    const unsyncedQuotes = await db.quotations.filter((q) => !q.synced).toArray();
    for (const quote of unsyncedQuotes) {
      try {
        // Resolve customer id if pending
        let custId = quote.customer_id;
        if (!custId) {
          const cust = await db.customers.toCollection().first();
          custId = cust?.id;
        }

        const quotePayload = {
          quote_no: quote.quote_no,
          quote_date: quote.quote_date,
          customer_id: custId,
          greeting: quote.greeting || '',
          closing: quote.closing || '',
          subtotal: parseFloat(quote.subtotal) || 0,
          discount_percent: parseFloat(quote.discount_percent) || 0,
          discount_amount: parseFloat(quote.discount_amount) || 0,
          gst_percent: parseFloat(quote.gst_percent) || 0,
          gst_amount: parseFloat(quote.gst_amount) || 0,
          grand_total: parseFloat(quote.grand_total) || 0,
          created_at: quote.created_at || new Date().toISOString()
        };

        if (quote.id) {
          quotePayload.id = quote.id;
        }

        const { data: syncedQuote, error: qErr } = await supabase
          .from('quotations')
          .upsert(quotePayload)
          .select()
          .single();

        if (qErr || !syncedQuote) {
          console.warn('[Sync] Quotation upsert error:', qErr);
          continue;
        }

        // Update local quotation with real cloud id and synced: true
        await db.quotations.update(quote.localId, {
          id: syncedQuote.id,
          customer_id: syncedQuote.customer_id,
          synced: true
        });

        // D. Sync Quotation Items for this quotation
        const items = await db.quotation_items
          .filter(
            (it) =>
              it.quotation_id === quote.id ||
              it.quotation_id === String(quote.localId) ||
              it.quotation_local_id === quote.localId
          )
          .toArray();

        for (const item of items) {
          const itemPayload = {
            quotation_id: syncedQuote.id,
            sl_no: item.sl_no,
            description: item.description,
            unit: item.unit || 'Nos',
            qty: parseFloat(item.qty) || 1,
            price: parseFloat(item.price !== undefined ? item.price : item.rate) || 0,
            total: parseFloat(item.total !== undefined ? item.total : item.amount) || 0,
            material_id: item.material_id || null
          };

          if (item.id) {
            itemPayload.id = item.id;
          }

          const { data: syncedItem, error: iErr } = await supabase
            .from('quotation_items')
            .upsert(itemPayload)
            .select()
            .single();

          if (!iErr && syncedItem) {
            await db.quotation_items.update(item.localId, {
              id: syncedItem.id,
              quotation_id: syncedQuote.id,
              synced: true
            });
          }
        }
      } catch (quoteErr) {
        console.warn('[Sync] Failed syncing quotation:', quoteErr);
      }
    }

    // Success reset retry
    retryAttempt = 0;
  } catch (overallErr) {
    console.warn('[Sync] Sync pending changes encountered an issue:', overallErr);
    // Exponential backoff retry
    retryAttempt++;
    const delay = Math.min(1000 * Math.pow(2, retryAttempt), MAX_BACKOFF_MS);
    console.log(`[Sync] Retrying in ${delay / 1000}s...`);
    setTimeout(() => {
      syncPendingChanges();
    }, delay);
  } finally {
    isSyncing = false;
  }
}

// ----------------- AUTOMATIC LISTENERS -----------------
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('[Network] Back online! Starting automatic sync...');
    syncPendingChanges();
  });
}

// Initialize immediately: run purge migration, then mirror from Supabase
purgeInvalidLocalRecords().then(() => {
  if (typeof navigator !== 'undefined' && navigator.onLine) {
    syncFromSupabase();
  }
});
