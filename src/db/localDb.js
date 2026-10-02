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

// ----------------- DEFAULT SEED DATA -----------------
const DEFAULT_COMPANY_PROFILE = {
  id: 'd0000000-0000-4000-8000-000000000001',
  name: COMPANY_CONFIG.name,
  owner_name: COMPANY_CONFIG.ownerName,
  address: COMPANY_CONFIG.address,
  phone: COMPANY_CONFIG.phone,
  email: COMPANY_CONFIG.email,
  logo_url: COMPANY_CONFIG.logoUrl,
  signature_url: '',
  default_greeting: COMPANY_CONFIG.defaultGreeting,
  default_closing: COMPANY_CONFIG.defaultClosing,
  synced: true
};

const DEFAULT_CUSTOMERS = [
  { id: 'c1000000-0000-4000-8000-000000000001', name: 'Apex Engineering Works', place: 'Coimbatore', synced: true },
  { id: 'c2000000-0000-4000-8000-000000000002', name: 'Premier Precision Tools', place: 'Tirupur', synced: true },
  { id: 'c3000000-0000-4000-8000-000000000003', name: 'Sterling Machinery Corp', place: 'Erode', synced: true }
];

const DEFAULT_MATERIALS = [
  {
    id: 'a0000000-0000-4000-8000-000000000001',
    name: 'Industrial Hydraulic Valve 25mm (High Pressure)',
    code: '8481',
    unit: 'Nos',
    rate: 7500,
    description: 'High pressure 25mm CNC finished hydraulic control valve',
    is_active: true,
    synced: true
  },
  {
    id: 'a0000000-0000-4000-8000-000000000002',
    name: 'Forged Steel Flange 150# ANSI Class',
    code: '7307',
    unit: 'Nos',
    rate: 4500,
    description: '150# ANSI class forged steel industrial connection flange',
    is_active: true,
    synced: true
  },
  {
    id: 'a0000000-0000-4000-8000-000000000003',
    name: 'Heavy Duty CNC Turned Component Shaft SS304',
    code: '8483',
    unit: 'Nos',
    rate: 4250,
    description: 'Precision turned SS304 transmission component shaft',
    is_active: true,
    synced: true
  },
  {
    id: 'a0000000-0000-4000-8000-000000000004',
    name: 'Precision Ground Bearing Housing Unit',
    code: '8482',
    unit: 'Nos',
    rate: 5000,
    description: 'Cast iron ground bearing housing unit with dust seal',
    is_active: true,
    synced: true
  },
  {
    id: 'a0000000-0000-4000-8000-000000000005',
    name: 'SS316 Fastener Bolt & Nut Assembly M16x60',
    code: '7318',
    unit: 'Set',
    rate: 180,
    description: 'Corrosion resistant stainless steel fastener bolt and nut assembly',
    is_active: true,
    synced: true
  },
  {
    id: 'a0000000-0000-4000-8000-000000000006',
    name: 'Industrial Hydraulic Fluid ISO VG 68',
    code: '2710',
    unit: 'Ltr',
    rate: 320,
    description: 'Premium anti-wear industrial hydraulic system fluid',
    is_active: true,
    synced: true
  },
  {
    id: 'a0000000-0000-4000-8000-000000000007',
    name: 'Heavy Duty Stainless Steel Raw Rod 50mm',
    code: '7222',
    unit: 'Kg',
    rate: 380,
    description: 'Grade 304 solid stainless steel round bar stock',
    is_active: true,
    synced: true
  }
];

const DEFAULT_QUOTATIONS = [
  {
    id: 'e1000000-0000-4000-8000-000000000001',
    quote_no: 'VI/2026-27/001',
    quote_date: '2026-10-02',
    customer_id: 'c1000000-0000-4000-8000-000000000001',
    greeting: 'Kind Attention: Purchase Department. We thank you for your enquiry and take pleasure in submitting our competitive quotation as below:',
    closing: 'We trust our quotation meets your valued approval and look forward to receiving your valuable purchase order.',
    subtotal: 75000,
    discount_percent: 5,
    discount_amount: 3750,
    gst_percent: 18,
    gst_amount: 12825,
    grand_total: 84075,
    created_at: '2026-10-02T10:00:00.000Z',
    synced: true
  },
  {
    id: 'e2000000-0000-4000-8000-000000000002',
    quote_no: 'VI/2026-27/002',
    quote_date: '2026-10-02',
    customer_id: 'c2000000-0000-4000-8000-000000000002',
    greeting: 'Dear Sir/Madam, With reference to your technical enquiry, we are pleased to quote our best rates for the following items:',
    closing: 'Quality inspection certificate will be provided along with delivery. Looking forward to your order.',
    subtotal: 92700,
    discount_percent: 0,
    discount_amount: 0,
    gst_percent: 18,
    gst_amount: 16686,
    grand_total: 109386,
    created_at: '2026-10-02T10:15:00.000Z',
    synced: true
  }
];

const DEFAULT_ITEMS = [
  {
    id: 'b1000000-0000-4000-8000-000000000001',
    quotation_id: 'e1000000-0000-4000-8000-000000000001',
    sl_no: 1,
    description: 'Industrial Hydraulic Valve 25mm (High Pressure) - CNC finished precision body with dual seal protection',
    unit: 'Nos',
    qty: 10,
    price: 7500,
    total: 75000,
    synced: true
  },
  {
    id: 'b2000000-0000-4000-8000-000000000001',
    quotation_id: 'e2000000-0000-4000-8000-000000000002',
    sl_no: 1,
    description: 'Forged Steel Flange 150# ANSI Class - High tensile standard pipe connection flange',
    unit: 'Nos',
    qty: 4,
    price: 4500,
    total: 18000,
    synced: true
  },
  {
    id: 'b2000000-0000-4000-8000-000000000002',
    quotation_id: 'e2000000-0000-4000-8000-000000000002',
    sl_no: 2,
    description: 'Heavy Duty CNC Turned Component Shaft SS304 - Precision engineered transmission shaft',
    unit: 'Nos',
    qty: 6,
    price: 4250,
    total: 25500,
    synced: true
  },
  {
    id: 'b2000000-0000-4000-8000-000000000003',
    quotation_id: 'e2000000-0000-4000-8000-000000000002',
    sl_no: 3,
    description: 'Precision Ground Bearing Housing Unit - Cast iron with heat treated inner race',
    unit: 'Nos',
    qty: 5,
    price: 5000,
    total: 25000,
    synced: true
  },
  {
    id: 'b2000000-0000-4000-8000-000000000004',
    quotation_id: 'e2000000-0000-4000-8000-000000000002',
    sl_no: 4,
    description: 'SS316 Fastener Bolt & Nut Assembly M16x60 - Grade 316 stainless hardware',
    unit: 'Set',
    qty: 50,
    price: 180,
    total: 9000,
    synced: true
  },
  {
    id: 'b2000000-0000-4000-8000-000000000005',
    quotation_id: 'e2000000-0000-4000-8000-000000000002',
    sl_no: 5,
    description: 'Heavy Duty Stainless Steel Raw Rod 50mm - Grade 304 round bar stock',
    unit: 'Kg',
    qty: 40,
    price: 380,
    total: 15200,
    synced: true
  }
];

// ----------------- SEED INITIAL LOCAL DATA -----------------
export async function seedInitialLocalData() {
  try {
    const custCount = await db.customers.count();
    if (custCount === 0) {
      await db.customers.bulkAdd(DEFAULT_CUSTOMERS);
    }

    const matCount = await db.materials.count();
    if (matCount === 0) {
      await db.materials.bulkAdd(DEFAULT_MATERIALS);
    }

    const profCount = await db.company_profile.count();
    if (profCount === 0) {
      await db.company_profile.add(DEFAULT_COMPANY_PROFILE);
    }

    const quoteCount = await db.quotations.count();
    if (quoteCount === 0) {
      await db.quotations.bulkAdd(DEFAULT_QUOTATIONS);
      await db.quotation_items.bulkAdd(DEFAULT_ITEMS);
    }
  } catch (err) {
    console.warn('[Dexie] Error during initial seeding:', err);
  }
}

// ----------------- INITIAL SYNC (ONLINE -> LOCAL DEXIE) -----------------
export async function syncFromSupabase() {
  if (!isSupabaseConfigured || !supabase || !navigator.onLine) {
    return;
  }

  try {
    console.log('[Dexie Sync] Mirroring cloud data from Supabase to Dexie...');

    // 1. Fetch Customers
    const { data: remoteCustomers, error: cErr } = await supabase.from('customers').select('*');
    if (!cErr && remoteCustomers?.length) {
      for (const rc of remoteCustomers) {
        const local = await db.customers.where('id').equals(rc.id).first();
        if (local) {
          await db.customers.update(local.localId, { ...rc, synced: true });
        } else {
          await db.customers.add({ ...rc, synced: true });
        }
      }
    }

    // 2. Fetch Materials
    const { data: remoteMaterials, error: mErr } = await supabase.from('materials').select('*');
    if (!mErr && remoteMaterials?.length) {
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
    const { data: remoteQuotations, error: qErr } = await supabase.from('quotations').select('*');
    if (!qErr && remoteQuotations?.length) {
      for (const rq of remoteQuotations) {
        const local = await db.quotations.where('id').equals(rq.id).first();
        if (local) {
          // If local has pending edits, do not overwrite with stale cloud data
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
    if (!iErr && remoteItems?.length) {
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

// Initialize immediately
seedInitialLocalData().then(() => {
  if (typeof navigator !== 'undefined' && navigator.onLine) {
    syncFromSupabase();
  }
});
