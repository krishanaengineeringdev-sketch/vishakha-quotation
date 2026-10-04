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
  materials: '++localId, id, name, code, category, category_id, image_url, in_stock, synced',
  material_categories: '++localId, id, name, synced, is_deleted'
});

db.version(5).stores({
  materials: '++localId, id, name, code, category, category_id, image_url, in_stock, synced',
  material_categories: '++localId, id, name, synced, is_deleted'
});

export const DEFAULT_MATERIAL_CATEGORIES = [
  'Furniture'
];

export const DEMO_CATEGORIES_TO_PURGE = [
  'electrical',
  'fabrication',
  'hardware',
  'raw material',
  'services'
];

export async function purgeDemoCategories() {
  try {
    const demoNames = new Set(DEMO_CATEGORIES_TO_PURGE);

    // 1. Find all demo categories in Dexie
    const allCats = await db.material_categories.toArray();
    const demoCatIds = new Set();
    const demoCatLocalIds = new Set();
    const demoCatNames = new Set();

    for (const cat of allCats) {
      const norm = (cat.name || '').trim().toLowerCase();
      if (demoNames.has(norm)) {
        if (cat.id) demoCatIds.add(String(cat.id).toLowerCase());
        if (cat.localId) demoCatLocalIds.add(String(cat.localId));
        demoCatNames.add(norm);
        await db.material_categories.delete(cat.localId);
      }
    }

    // 2. Unlink any materials referencing deleted demo categories -> set to Uncategorized
    const allMats = await db.materials.toArray();
    for (const mat of allMats) {
      const matCatId = mat.category_id ? String(mat.category_id).toLowerCase() : null;
      const matCatName = (mat.category || '').trim().toLowerCase();

      const isDemoCat =
        (matCatId && demoCatIds.has(matCatId)) ||
        (mat.category_id && demoCatLocalIds.has(String(mat.category_id))) ||
        (matCatName && demoCatNames.has(matCatName)) ||
        demoNames.has(matCatName);

      if (isDemoCat) {
        console.log(`[Migration] Unlinking material "${mat.name}" from demo category "${mat.category}" -> Uncategorized`);
        await db.materials.update(mat.localId, {
          category: null,
          category_id: null,
          synced: false
        });
      }
    }

    // 3. Ensure 'Furniture' category exists if there are furniture items (Chair, Desk, Dine, Table)
    let furnitureCat = await db.material_categories
      .filter((c) => !c.is_deleted && (c.name || '').trim().toLowerCase() === 'furniture')
      .first();

    const furnitureItemNames = new Set(['chair', 'desk', 'dine', 'table', 'laptop table']);
    const furnitureMaterials = allMats.filter((m) => {
      const name = (m.name || '').trim().toLowerCase();
      return furnitureItemNames.has(name) || (m.category || '').trim().toLowerCase() === 'furniture';
    });

    if (furnitureMaterials.length > 0) {
      if (!furnitureCat) {
        const id = generateOfflineUuid();
        const localId = await db.material_categories.add({
          id,
          name: 'Furniture',
          created_at: new Date().toISOString(),
          synced: false,
          is_deleted: false
        });
        furnitureCat = { id, localId, name: 'Furniture' };
      }

      for (const fMat of furnitureMaterials) {
        if (!fMat.category_id || fMat.category !== 'Furniture') {
          await db.materials.update(fMat.localId, {
            category: 'Furniture',
            category_id: furnitureCat.id
          });
        }
      }
    }

    // 4. If online and Supabase is configured, delete demo categories from Supabase too
    if (typeof navigator !== 'undefined' && navigator.onLine && isSupabaseConfigured && supabase) {
      try {
        await supabase
          .from('material_categories')
          .delete()
          .in('name', ['Electrical', 'Fabrication', 'Hardware', 'Raw Material', 'Services', 'electrical', 'fabrication', 'hardware', 'raw material', 'services']);
      } catch (sbErr) {
        console.warn('[Migration] Note: Cloud category cleanup requires authenticated user or RLS policy:', sbErr?.message || sbErr);
      }
    }

    console.log('[Migration] Demo categories purged successfully.');
  } catch (err) {
    console.warn('[Migration] Error purging demo categories:', err);
  }
}

export async function seedAndMigrateMaterialCategories() {
  try {
    const existing = await db.material_categories.filter((c) => !c.is_deleted).toArray();
    const catMap = new Map();
    existing.forEach((c) => {
      catMap.set(c.name.toLowerCase(), c);
    });

    // Migrate any existing materials that have a category name but no category_id
    const materials = await db.materials.toArray();
    for (const mat of materials) {
      if (!mat.category_id && mat.category && mat.category.trim()) {
        const catName = mat.category.trim();
        // Do not recreate demo categories
        if (DEMO_CATEGORIES_TO_PURGE.includes(catName.toLowerCase())) {
          await db.materials.update(mat.localId, {
            category_id: null,
            category: null
          });
          continue;
        }

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
    console.warn('[Migration] Error migrating material categories:', err);
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

// ----------------- MATERIAL DESCRIPTION METADATA HELPERS -----------------
// Embeds category and image_url into the description text (HTML comment tag <!--v_meta:...-->)
// so that cross-device synchronization works immediately without breaking on missing cloud columns or RLS policies.
const META_REGEX = /<!--v_meta:(.*?)-->/s;

export const KNOWN_MATERIAL_IMAGES = {
  desk: 'https://ugulqrvwimctpeudvkod.supabase.co/storage/v1/object/public/company-assets/assets/material-1791081981366.webp',
  table: 'https://ugulqrvwimctpeudvkod.supabase.co/storage/v1/object/public/company-assets/materials/material-1791086920926.webp',
  chair: 'https://ugulqrvwimctpeudvkod.supabase.co/storage/v1/object/public/company-assets/assets/material-1791085527468.webp',
  dine: 'https://ugulqrvwimctpeudvkod.supabase.co/storage/v1/object/public/company-assets/assets/material-1791085577224.webp'
};

export function decodeMaterialDescription(rawDesc) {
  if (!rawDesc || typeof rawDesc !== 'string') {
    return {
      description: '',
      category: null,
      category_id: null,
      image_url: null
    };
  }

  const match = rawDesc.match(META_REGEX);
  if (!match) {
    return {
      description: rawDesc,
      category: null,
      category_id: null,
      image_url: null
    };
  }

  const cleanDescription = rawDesc.replace(META_REGEX, '').trim();
  try {
    const meta = JSON.parse(match[1]);
    return {
      description: cleanDescription,
      category: meta.cat || null,
      category_id: meta.cat_id || null,
      image_url: meta.img || null
    };
  } catch (err) {
    return {
      description: cleanDescription,
      category: null,
      category_id: null,
      image_url: null
    };
  }
}

export function encodeMaterialDescription(desc, { category, category_id, image_url } = {}) {
  const cleanDesc = (desc || '').replace(META_REGEX, '').trim();
  const meta = {};
  if (category) meta.cat = category;
  if (category_id) meta.cat_id = category_id;
  if (image_url) meta.img = image_url;

  if (Object.keys(meta).length === 0) {
    return cleanDesc;
  }

  const tag = `<!--v_meta:${JSON.stringify(meta)}-->`;
  return cleanDesc ? `${cleanDesc}\n${tag}` : tag;
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

// ----------------- FRESH SYNC FROM SUPABASE (CLOUD AS SOURCE OF TRUTH) -----------------
/**
 * Forces a fresh pull from Supabase to overwrite local Dexie cache with the shared cloud state.
 * Conflict rule:
 * - Unsynced local drafts (synced: false) are preserved or pushed first.
 * - All other records (synced !== false) are overwritten by the cloud source of truth.
 * - Materials descriptions are decoded to extract categories and uploaded image URLs.
 * - Categories are auto-registered into Dexie so chips immediately appear on mobile.
 */
export async function refreshFromSupabase() {
  if (!isSupabaseConfigured || !supabase || !navigator.onLine) {
    return;
  }

  try {
    console.log('[Dexie Sync] Performing fresh sync from Supabase...');
    const pendingBefore = await getPendingSyncCount();
    broadcastSyncStatus(true, pendingBefore);

    // 1. Push any pending local drafts first so local changes are preserved and sent to cloud
    await syncPendingChanges();

    // 2. Fetch Material Categories from Supabase
    try {
      const { data: remoteCategories, error: mcErr } = await supabase
        .from('material_categories')
        .select('*')
        .order('name');

      if (!mcErr && remoteCategories !== null) {
        const demoNames = new Set(DEMO_CATEGORIES_TO_PURGE);
        const validRemote = remoteCategories.filter(
          (c) => !demoNames.has((c.name || '').trim().toLowerCase())
        );
        const remoteCatIdSet = new Set(validRemote.map((c) => c.id));
        const localSyncedCats = await db.material_categories.filter((c) => c.synced !== false).toArray();
        for (const lc of localSyncedCats) {
          if (demoNames.has((lc.name || '').trim().toLowerCase()) || !remoteCatIdSet.has(lc.id)) {
            await db.material_categories.delete(lc.localId);
          }
        }
        for (const rc of validRemote) {
          const local = await db.material_categories.where('id').equals(rc.id).first();
          if (local) {
            await db.material_categories.update(local.localId, { ...rc, synced: true, is_deleted: false });
          } else {
            await db.material_categories.add({ ...rc, synced: true, is_deleted: false });
          }
        }
      }
    } catch (catErr) {
      console.warn('[Dexie Sync] Material categories sync notice:', catErr);
    }

    // 3. Fetch Active Materials from Supabase
    const { data: remoteMaterials, error: mErr } = await supabase
      .from('materials')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (!mErr && remoteMaterials !== null) {
      const allLocalCats = await db.material_categories.toArray();
      const catMap = new Map();
      allLocalCats.forEach((c) => {
        if (c.id) catMap.set(String(c.id).toLowerCase(), c.name);
        if (c.localId) catMap.set(String(c.localId), c.name);
        if (c.name) catMap.set(c.name.trim().toLowerCase(), c.name);
      });

      const remoteMatIdSet = new Set(remoteMaterials.map((m) => m.id));
      const localSyncedMats = await db.materials.filter((m) => m.synced !== false).toArray();
      for (const lm of localSyncedMats) {
        // Drop local materials that are deleted or marked inactive on Supabase
        if (!remoteMatIdSet.has(lm.id)) {
          await db.materials.delete(lm.localId);
        }
      }

      for (const rm of remoteMaterials) {
        const meta = decodeMaterialDescription(rm.description);
        const normName = (rm.name || '').trim().toLowerCase();

        // Resolve Category
        const demoNames = new Set(DEMO_CATEGORIES_TO_PURGE);
        let resolvedCategory = meta.category ||
          rm.category ||
          (rm.category_id ? catMap.get(String(rm.category_id).toLowerCase()) : null) ||
          null;

        if (resolvedCategory && demoNames.has(resolvedCategory.trim().toLowerCase())) {
          resolvedCategory = null;
        }

        let resolvedCategoryId = rm.category_id || meta.category_id || null;
        if (!resolvedCategory) {
          resolvedCategoryId = null;
        }

        // Auto-register category into Dexie if it's missing on this device (e.g. mobile hasn't created it yet)
        if (resolvedCategory && !catMap.has(resolvedCategory.toLowerCase()) && !demoNames.has(resolvedCategory.toLowerCase())) {
          const generatedId = resolvedCategoryId || generateOfflineUuid();
          try {
            await db.material_categories.add({
              id: generatedId,
              name: resolvedCategory,
              created_at: new Date().toISOString(),
              synced: true,
              is_deleted: false
            });
            catMap.set(resolvedCategory.toLowerCase(), resolvedCategory);
            catMap.set(String(generatedId).toLowerCase(), resolvedCategory);
            resolvedCategoryId = generatedId;
          } catch (e) {
            // Already present or added concurrently
          }
        }

        const local = (await db.materials.where('id').equals(rm.id).first()) ||
                      (rm.name ? await db.materials.where('name').equalsIgnoreCase(rm.name.trim()).first() : null);

        const resolvedImage = rm.image_url ||
          meta.image_url ||
          local?.image_url ||
          KNOWN_MATERIAL_IMAGES[normName] ||
          null;

        const matRecord = {
          ...rm,
          description: meta.description, // Clean human-readable text
          raw_description: rm.description,
          category: resolvedCategory || (local?.category && !demoNames.has(local.category.toLowerCase()) ? local.category : null),
          category_id: resolvedCategoryId || (local?.category_id && !demoNames.has(String(local.category).toLowerCase()) ? local.category_id : null),
          image_url: resolvedImage,
          in_stock: rm.in_stock !== undefined && rm.in_stock !== null ? rm.in_stock : true,
          stock_qty: rm.stock_qty !== undefined && rm.stock_qty !== null ? rm.stock_qty : null,
          is_active: true,
          synced: true
        };

        if (local) {
          if (local.synced !== false) {
            await db.materials.update(local.localId, matRecord);
          }
        } else {
          await db.materials.add(matRecord);
        }
      }
    }

    // 4. Fetch Customers
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
          if (local.synced !== false) {
            await db.customers.update(local.localId, { ...rc, synced: true });
          }
        } else {
          await db.customers.add({ ...rc, synced: true });
        }
      }
    }

    // 5. Fetch Company Profile
    try {
      const { data: remoteProfile, error: pErr } = await supabase.from('company_profile').select('*').limit(1).maybeSingle();
      if (!pErr && remoteProfile) {
        const local = (await db.company_profile.where('id').equals(remoteProfile.id).first()) || (await db.company_profile.toCollection().first());
        if (local) {
          if (local.synced !== false) {
            await db.company_profile.update(local.localId, { ...remoteProfile, synced: true });
          }
        } else {
          await db.company_profile.add({ ...remoteProfile, synced: true });
        }
      }
    } catch (profErr) {}

    // 6. Fetch Quotations
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

    // 7. Fetch Quotation Items
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

    console.log('[Dexie Sync] Fresh sync complete.');

    // Broadcast refresh events across open tabs/views
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('vishakha_synced_fresh', { detail: { timestamp: Date.now() } }));
      window.dispatchEvent(new CustomEvent('vishakha_realtime_change', { detail: { table: 'all', eventType: 'SYNC' } }));
    }
  } catch (err) {
    console.warn('[Dexie Sync] refreshFromSupabase encountered an error:', err);
  } finally {
    const pendingAfter = await getPendingSyncCount();
    broadcastSyncStatus(false, pendingAfter);
  }
}

// Backward-compatible alias
export const syncFromSupabase = refreshFromSupabase;

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
              try {
                await supabase.from('material_categories').delete().eq('id', cat.id);
              } catch (delErr) {
                console.warn('[Sync] Non-fatal category remote delete notice:', delErr?.message || delErr);
              }
            }
            await db.material_categories.delete(cat.localId);
            continue;
          }

          const trimmedCatName = (cat.name || '').trim();
          if (!trimmedCatName) {
            await db.material_categories.delete(cat.localId);
            continue;
          }

          // Prevent local duplicate rows for the same category name
          const existingSynced = await db.material_categories
            .filter((c) => !c.is_deleted && c.synced && c.localId !== cat.localId && (c.name || '').trim().toLowerCase() === trimmedCatName.toLowerCase())
            .first();

          if (existingSynced) {
            if (cat.id && cat.id !== existingSynced.id) {
              try {
                const linked = await db.materials.where('category_id').equals(cat.id).toArray();
                for (const m of linked) {
                  await db.materials.update(m.localId, { category_id: existingSynced.id });
                }
              } catch (remapErr) {
                console.warn('[Sync] Non-fatal category remapping error:', remapErr);
              }
            }
            await db.material_categories.delete(cat.localId);
            continue;
          }

          const { data, error } = await supabase
            .from('material_categories')
            .upsert({ name: trimmedCatName }, { onConflict: 'name', ignoreDuplicates: false })
            .select()
            .single();

          if (!error && data) {
            const oldId = cat.id;
            const newId = data.id;
            await db.material_categories.update(cat.localId, { id: newId, name: trimmedCatName, synced: true });

            if (oldId && oldId !== newId) {
              try {
                const linkedMaterials = await db.materials.where('category_id').equals(oldId).toArray();
                for (const m of linkedMaterials) {
                  await db.materials.update(m.localId, { category_id: newId });
                }
              } catch (mErr) {
                console.warn('[Sync] Non-fatal updating linked materials category ID:', mErr);
              }
            }
          } else if (error) {
            console.warn('[Sync] Non-fatal category sync notice (resolving conflict):', error?.message || error);
            try {
              const { data: existing } = await supabase
                .from('material_categories')
                .select('id, name')
                .ilike('name', trimmedCatName)
                .maybeSingle();

              if (existing) {
                const oldId = cat.id;
                const newId = existing.id;
                await db.material_categories.update(cat.localId, { id: newId, name: existing.name || trimmedCatName, synced: true });
                if (oldId && oldId !== newId) {
                  const linkedMaterials = await db.materials.where('category_id').equals(oldId).toArray();
                  for (const m of linkedMaterials) {
                    await db.materials.update(m.localId, { category_id: newId });
                  }
                }
              }
            } catch (fetchErr) {
              console.warn('[Sync] Error checking existing category by name:', fetchErr);
            }
          }
        } catch (e) {
          console.warn('[Sync] Non-fatal error syncing individual category:', e?.message || e);
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
          if (mat.is_deleted) {
            if (mat.id && uuidRegex.test(String(mat.id).trim())) {
              try {
                await supabase.from('materials').update({ is_active: false }).eq('id', mat.id);
              } catch (e) {
                console.warn('[Sync] Failed soft-deleting material in cloud:', e);
              }
            }
            await db.materials.delete(mat.localId);
            continue;
          }

          const rawCatId = mat.category_id ? String(mat.category_id).trim() : null;
          const cleanCatId = rawCatId && uuidRegex.test(rawCatId) && validRemoteCategoryIds.has(rawCatId.toLowerCase())
            ? rawCatId
            : null;

          // Encode category and image_url into description metadata tag for guaranteed cross-device sync
          const encodedDesc = encodeMaterialDescription(mat.description, {
            category: mat.category,
            category_id: cleanCatId,
            image_url: mat.image_url
          });

          const payload = {
            name: mat.name,
            code: mat.code || '',
            hsn: mat.code || mat.hsn || null,
            unit: mat.unit || 'Nos',
            rate: parseFloat(mat.rate) || 0,
            description: encodedDesc,
            category_id: cleanCatId,
            in_stock: mat.in_stock !== false,
            stock_qty: mat.stock_qty !== undefined && mat.stock_qty !== null && mat.stock_qty !== '' ? parseFloat(mat.stock_qty) : null,
            is_active: mat.is_active !== false
          };

          // Also send image_url if the column exists in cloud schema
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
        if (quote.is_deleted) {
          if (quote.id) {
            try {
              await supabase.from('quotation_items').delete().eq('quotation_id', quote.id);
              await supabase.from('quotations').delete().eq('id', quote.id);
            } catch (e) {
              console.warn('[Sync] Failed deleting quotation in cloud:', e);
            }
          }
          await db.quotations.delete(quote.localId);
          await db.quotation_items
            .filter((it) => it.quotation_id === quote.id || it.quotation_local_id === quote.localId)
            .delete();
          continue;
        }

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

    // E. Sync Unsynced Company Profile
    try {
      const unsyncedProfile = await db.company_profile.filter((p) => p.synced === false).first();
      if (unsyncedProfile) {
        let remoteProfileId = unsyncedProfile.id;
        const { data: remoteRows } = await supabase.from('company_profile').select('id').limit(1);
        if (remoteRows && remoteRows.length > 0) {
          remoteProfileId = remoteRows[0].id;
        }

        const profilePayload = {
          name: unsyncedProfile.name || COMPANY_CONFIG.name,
          owner_name: unsyncedProfile.owner_name || COMPANY_CONFIG.ownerName,
          address: unsyncedProfile.address || COMPANY_CONFIG.address,
          phone: unsyncedProfile.phone || COMPANY_CONFIG.phone,
          email: unsyncedProfile.email || COMPANY_CONFIG.email,
          logo_url: unsyncedProfile.logo_url || COMPANY_CONFIG.logoUrl,
          signature_url: unsyncedProfile.signature_url || '',
          default_greeting: unsyncedProfile.default_greeting || COMPANY_CONFIG.defaultGreeting,
          default_closing: unsyncedProfile.default_closing || COMPANY_CONFIG.defaultClosing
        };

        if (remoteProfileId) {
          const { data, error } = await supabase
            .from('company_profile')
            .update(profilePayload)
            .eq('id', remoteProfileId)
            .select()
            .single();

          if (!error && data) {
            await db.company_profile.update(unsyncedProfile.localId, { id: data.id, synced: true });
          }
        } else {
          const { data, error } = await supabase
            .from('company_profile')
            .insert(profilePayload)
            .select()
            .single();

          if (!error && data) {
            await db.company_profile.update(unsyncedProfile.localId, { id: data.id, synced: true });
          }
        }
      }
    } catch (profSyncErr) {
      console.warn('[Sync] Failed syncing company profile:', profSyncErr);
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

// Initialize immediately: run purge migrations, seed categories, then perform fresh sync from Supabase
purgeInvalidLocalRecords()
  .then(() => purgeDemoCategories())
  .then(() => seedAndMigrateMaterialCategories())
  .then(() => {
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      refreshFromSupabase();
    }
  });
