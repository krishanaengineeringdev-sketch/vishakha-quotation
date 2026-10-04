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

db.version(2).stores({
  materials: '++localId, id, name, code, category, synced'
});

db.version(3).stores({
  materials: '++localId, id, name, code, category, in_stock, synced'
});

db.version(4).stores({
  materials: '++localId, id, name, code, category, category_id, in_stock, synced',
  material_categories: '++localId, id, name, synced, is_deleted'
});

export const DEFAULT_MATERIAL_CATEGORIES = [
  'Furniture',
  'Fabrication',
  'Hardware',
  'Electrical',
  'Raw Material',
  'Services'
];

export async function seedAndMigrateMaterialCategories() {
  try {
    const existing = await db.material_categories.filter((c) => !c.is_deleted).toArray();
    const catMap = new Map();

    if (existing.length === 0) {
      for (const name of DEFAULT_MATERIAL_CATEGORIES) {
        const id = generateOfflineUuid();
        const localId = await db.material_categories.add({
          id,
          name,
          created_at: new Date().toISOString(),
          synced: false
        });
        catMap.set(name.toLowerCase(), { id, localId, name });
      }
    } else {
      existing.forEach((c) => {
        catMap.set(c.name.toLowerCase(), c);
      });
    }

    // Migrate any existing materials that have a category name but no category_id
    const materials = await db.materials.toArray();
    for (const mat of materials) {
      if (!mat.category_id && mat.category && mat.category.trim()) {
        const catName = mat.category.trim();
        let cat = catMap.get(catName.toLowerCase());
        if (!cat) {
          const newId = generateOfflineUuid();
          const localId = await db.material_categories.add({
            id: newId,
            name: catName,
            created_at: new Date().toISOString(),
            synced: false
          });
          cat = { id: newId, localId, name: catName };
          catMap.set(catName.toLowerCase(), cat);
        }
        await db.materials.update(mat.localId, {
          category_id: cat.id,
          category: cat.name
        });
      }
    }
  } catch (err) {
    console.warn('[Migration] Error seeding/migrating material categories:', err);
  }
}


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

// Dynamic check to determine if Supabase materials table has image_url column
let isCloudImageUrlChecked = false;
let isCloudImageUrlAvailable = false;
export async function isCloudImageUrlSupported() {
  if (isCloudImageUrlChecked) return isCloudImageUrlAvailable;
  if (!supabase || !isSupabaseConfigured) return false;
  try {
    const { error } = await supabase.from('materials').select('image_url').limit(1);
    isCloudImageUrlAvailable = !error;
    isCloudImageUrlChecked = true;
  } catch {
    isCloudImageUrlAvailable = false;
  }
  return isCloudImageUrlAvailable;
}

// ----------------- ONE-TIME MIGRATION: PURGE INVALID / SEED RECORDS -----------------
export async function purgeInvalidLocalRecords() {
  try {
    if (typeof localStorage !== 'undefined' && localStorage.getItem('vishakha_purged_invalid_records_v3')) {
      return;
    }

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

    // Purge only orphaned known seed quotation items (NEVER purge items whose parent quotation exists in Dexie)
    const remainingQuotes = await db.quotations.toArray();
    const validQuoteIds = new Set();
    remainingQuotes.forEach((q) => {
      if (q.id) validQuoteIds.add(String(q.id).toLowerCase());
      if (q.localId) validQuoteIds.add(String(q.localId));
      if (q.quote_no) validQuoteIds.add(String(q.quote_no).toLowerCase());
    });

    const items = await db.quotation_items.toArray();
    for (const item of items) {
      const parentQId = item.quotation_id ? String(item.quotation_id).toLowerCase() : null;
      const parentLocalId = item.quotation_local_id ? String(item.quotation_local_id) : null;
      const hasParent = (parentQId && validQuoteIds.has(parentQId)) || (parentLocalId && validQuoteIds.has(parentLocalId));

      if (hasParent) continue;

      if (isInvalid(item.id)) {
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

    // Purge invalid material categories
    const categories = await db.material_categories.toArray();
    for (const cat of categories) {
      if (isInvalid(cat.id)) {
        console.log('[Migration] Purging invalid/seed local category:', cat.name, cat.id || cat.localId);
        await db.material_categories.delete(cat.localId);
      }
    }

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('vishakha_purged_invalid_records_v3', 'true');
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

    // 2a. Fetch Material Categories first so materials can resolve category names
    try {
      const { data: remoteCategories, error: mcErr } = await supabase
        .from('material_categories')
        .select('*')
        .order('name');

      if (!mcErr && remoteCategories !== null && remoteCategories.length > 0) {
        const remoteCatIdSet = new Set(remoteCategories.map((c) => c.id));
        const localSyncedCats = await db.material_categories.filter((c) => c.synced !== false).toArray();
        for (const lc of localSyncedCats) {
          if (!remoteCatIdSet.has(lc.id)) {
            await db.material_categories.delete(lc.localId);
          }
        }
        for (const rc of remoteCategories) {
          const local = await db.material_categories.where('id').equals(rc.id).first();
          if (local) {
            await db.material_categories.update(local.localId, { ...rc, synced: true });
          } else {
            await db.material_categories.add({ ...rc, synced: true });
          }
        }
      }
    } catch (catErr) {
      console.warn('[Dexie Sync] Material categories sync notice:', catErr);
    }

    // 2b. Fetch Active Materials (soft delete is_active = true)
    const { data: remoteMaterials, error: mErr } = await supabase
      .from('materials')
      .select('*')
      .eq('is_active', true);

    if (!mErr && remoteMaterials !== null && remoteMaterials.length > 0) {
      const allLocalCats = await db.material_categories.toArray();
      const catMap = new Map();
      allLocalCats.forEach((c) => {
        if (c.id) catMap.set(String(c.id).toLowerCase(), c.name);
        if (c.localId) catMap.set(String(c.localId), c.name);
      });

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
        const resolvedCategory = (rm.category_id ? catMap.get(String(rm.category_id).toLowerCase()) : null) || rm.category || local?.category || '';
        const matRecord = {
          ...rm,
          category: resolvedCategory,
          category_id: rm.category_id || null,
          image_url: rm.image_url || local?.image_url || null,
          in_stock: rm.in_stock !== undefined && rm.in_stock !== null ? rm.in_stock : true,
          stock_qty: rm.stock_qty !== undefined && rm.stock_qty !== null ? rm.stock_qty : null,
          synced: true
        };
        if (local) {
          await db.materials.update(local.localId, matRecord);
        } else {
          await db.materials.add(matRecord);
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
    if (!iErr && remoteItems !== null && remoteItems.length > 0) {
      const remoteItemIdSet = new Set(remoteItems.map((i) => i.id));
      const localSyncedItems = await db.quotation_items.filter((i) => i.synced !== false).toArray();
      for (const li of localSyncedItems) {
        if (!remoteItemIdSet.has(li.id)) {
          await db.quotation_items.delete(li.localId);
        }
      }
      for (const ri of remoteItems) {
        const local = await db.quotation_items.where('id').equals(ri.id).first();
        const normalized = {
          ...ri,
          description: ri.description || '',
          name: ri.description || '',
          unit: ri.unit || 'Nos',
          qty: parseFloat(ri.qty) || 1,
          quantity: parseFloat(ri.qty) || 1,
          price: parseFloat(ri.price) || 0,
          rate: parseFloat(ri.price) || 0,
          total: parseFloat(ri.total) || 0,
          amount: parseFloat(ri.total) || 0,
          synced: true
        };
        if (local) {
          if (local.synced !== false) {
            await db.quotation_items.update(local.localId, normalized);
          }
        } else {
          await db.quotation_items.add(normalized);
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

export async function getPendingSyncCount() {
  try {
    const [c, mc, m, q, qi] = await Promise.all([
      db.customers.filter((x) => !x.synced).count(),
      db.material_categories.filter((x) => !x.synced).count(),
      db.materials.filter((x) => !x.synced).count(),
      db.quotations.filter((x) => !x.synced).count(),
      db.quotation_items.filter((x) => !x.synced).count()
    ]);
    return c + mc + m + q + qi;
  } catch (err) {
    return 0;
  }
}

export function broadcastSyncStatus(isSyncingState, count) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('vishakha-sync-status', {
        detail: { isSyncing: isSyncingState, pendingCount: count }
      })
    );
  }
}

export async function syncPendingChanges() {
  if (!navigator.onLine || !isSupabaseConfigured || !supabase) {
    return;
  }

  if (isSyncing) return;
  isSyncing = true;

  try {
    const initialPending = await getPendingSyncCount();
    broadcastSyncStatus(true, initialPending);

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

    // B. Sync Unsynced Material Categories First
    try {
      const unsyncedCategories = await db.material_categories.filter((c) => !c.synced).toArray();
      for (const cat of unsyncedCategories) {
        try {
          if (cat.is_deleted) {
            if (cat.id) {
              await supabase.from('material_categories').delete().eq('id', cat.id);
            }
            await db.material_categories.delete(cat.localId);
            continue;
          }

          const payload = {
            name: cat.name
          };
          if (cat.id) payload.id = cat.id;

          const { data, error } = await supabase
            .from('material_categories')
            .upsert(payload)
            .select()
            .single();

          if (!error && data) {
            await db.material_categories.update(cat.localId, { id: data.id, synced: true });
          }
        } catch (e) {
          console.warn('[Sync] Failed to sync category:', e);
        }
      }
    } catch (catSyncErr) {
      console.warn('[Sync] Error checking unsynced categories:', catSyncErr);
    }

    // C. Sync Unsynced Materials
    try {
      // Check which category IDs exist in remote material_categories to prevent foreign key errors
      const validRemoteCategoryIds = new Set();
      try {
        const { data: remoteCats } = await supabase.from('material_categories').select('id');
        if (remoteCats) {
          remoteCats.forEach((c) => validRemoteCategoryIds.add(String(c.id).toLowerCase()));
        }
      } catch (catErr) {
        console.warn('[Sync] Could not check remote categories:', catErr);
      }

      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      const unsyncedMaterials = await db.materials.filter((m) => !m.synced).toArray();

      for (const mat of unsyncedMaterials) {
        try {
          const rawCatId = mat.category_id ? String(mat.category_id).trim() : null;
          const cleanCatId = rawCatId && uuidRegex.test(rawCatId) && validRemoteCategoryIds.has(rawCatId.toLowerCase())
            ? rawCatId
            : null;

          // Note: The 'category' and 'image_url' columns were dropped from materials table in Supabase.
          // We only send columns that exist in the cloud schema:
          const payload = {
            name: mat.name,
            code: mat.code || '',
            hsn: mat.code || mat.hsn || null,
            unit: mat.unit || 'Nos',
            rate: parseFloat(mat.rate) || 0,
            description: mat.description || '',
            category_id: cleanCatId,
            in_stock: mat.in_stock !== false,
            stock_qty: mat.stock_qty !== undefined && mat.stock_qty !== null && mat.stock_qty !== '' ? parseFloat(mat.stock_qty) : null,
            is_active: mat.is_active !== false
          };

          // Only send image_url to Supabase if the column exists in cloud schema
          const cloudHasImageCol = await isCloudImageUrlSupported();
          if (cloudHasImageCol && mat.image_url) {
            payload.image_url = mat.image_url;
          }

          if (mat.id && uuidRegex.test(String(mat.id).trim())) {
            payload.id = mat.id;
          }

          const { data, error } = await supabase
            .from('materials')
            .upsert(payload)
            .select()
            .single();

          if (!error && data) {
            await db.materials.update(mat.localId, { id: data.id, synced: true });
          } else if (error) {
            console.warn('[Sync] Failed to sync material:', error.message);
          }
        } catch (e) {
          console.warn('[Sync] Failed to sync material exception:', e);
        }
      }
    } catch (matSyncErr) {
      console.warn('[Sync] Error checking unsynced materials:', matSyncErr);
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
        const qId = quote.id ? String(quote.id).toLowerCase().trim() : null;
        const qLocalId = quote.localId !== undefined && quote.localId !== null ? String(quote.localId).trim() : null;
        const allLocalItems = await db.quotation_items.toArray();
        const items = allLocalItems.filter((it) => {
          const itQId = it.quotation_id ? String(it.quotation_id).toLowerCase().trim() : null;
          const itLocalId = it.quotation_local_id !== undefined && it.quotation_local_id !== null ? String(it.quotation_local_id).trim() : null;
          if (qId && itQId === qId) return true;
          if (qLocalId && (itLocalId === qLocalId || itQId === qLocalId)) return true;
          return false;
        });

        // Also update local quote record with items
        if (items.length > 0 && quote.localId) {
          await db.quotations.update(quote.localId, { items });
        }

        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

        for (const item of items) {
          const itemPayload = {
            quotation_id: syncedQuote.id,
            sl_no: item.sl_no,
            description: item.description || item.name || '',
            unit: item.unit || item.uom || 'Nos',
            qty: parseFloat(item.qty !== undefined ? item.qty : item.quantity) || 1,
            price: parseFloat(item.price !== undefined ? item.price : item.rate) || 0,
            total: parseFloat(item.total !== undefined ? item.total : item.amount) || 0,
            material_id: item.material_id && uuidRegex.test(String(item.material_id).trim()) ? item.material_id : null
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
    const remainingPending = await getPendingSyncCount();
    broadcastSyncStatus(false, remainingPending);
  }
}

// ----------------- AUTOMATIC LISTENERS -----------------
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('[Network] Back online! Starting automatic sync...');
    syncPendingChanges();
  });
}

// Initialize immediately: run purge migration, seed categories, then mirror from Supabase
purgeInvalidLocalRecords()
  .then(() => seedAndMigrateMaterialCategories())
  .then(() => {
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      syncFromSupabase();
    }
  });
