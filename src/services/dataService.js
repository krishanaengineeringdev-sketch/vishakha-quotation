import { supabase, isSupabaseConfigured } from '../supabaseClient';
import {
  db,
  generateOfflineUuid,
  syncPendingChanges,
  syncFromSupabase,
  seedAndMigrateMaterialCategories,
  isCloudImageUrlSupported
} from '../db/localDb';
import { COMPANY_CONFIG } from '../config/companyConfig';

export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(id) {
  if (!id || typeof id !== 'string') return false;
  return UUID_REGEX.test(id.trim());
}

export function generateUuid() {
  return generateOfflineUuid();
}

export function logSupabaseError(action, error) {
  if (!error) return;
  const code = error.code || error.status || 'UNKNOWN';
  const message = error.message || error.statusText || String(error);
  const details = error.details ? ` | Details: ${error.details}` : '';
  const hint = error.hint ? ` | Hint: ${error.hint}` : '';
  console.error(`[Supabase Error] ${action}: Code ${code} - ${message}${details}${hint}`);
}

// ----------------- COMPANY PROFILE -----------------

export async function getCompanyProfile() {
  try {
    const profile = await db.company_profile.toCollection().first();
    if (profile) return profile;
  } catch (err) {
    console.warn('[Dexie] getCompanyProfile fallback:', err);
  }

  return {
    name: COMPANY_CONFIG.name,
    owner_name: COMPANY_CONFIG.ownerName,
    address: COMPANY_CONFIG.address,
    phone: COMPANY_CONFIG.phone,
    email: COMPANY_CONFIG.email,
    logo_url: COMPANY_CONFIG.logoUrl,
    signature_url: '',
    default_greeting: COMPANY_CONFIG.defaultGreeting,
    default_closing: COMPANY_CONFIG.defaultClosing
  };
}

export async function saveCompanyProfile(profileData) {
  const existing = await db.company_profile.toCollection().first();
  const updatedData = {
    ...existing,
    ...profileData,
    synced: false
  };

  if (existing?.localId) {
    await db.company_profile.update(existing.localId, updatedData);
  } else {
    const localId = await db.company_profile.add({ ...updatedData, id: generateUuid() });
    updatedData.localId = localId;
  }

  // Trigger background sync if online
  if (navigator.onLine && isSupabaseConfigured && supabase) {
    supabase
      .from('company_profile')
      .upsert({ ...profileData, id: updatedData.id || undefined })
      .select()
      .single()
      .then(({ data, error }) => {
        if (!error && data) {
          db.company_profile.update(updatedData.localId, { ...data, synced: true });
        }
      })
      .catch((e) => console.warn('[Sync] Background profile sync failed:', e));
  }

  return updatedData;
}

// ----------------- CUSTOMERS -----------------

export async function getCustomers(searchQuery = '') {
  try {
    const all = await db.customers.toArray();
    if (!searchQuery.trim()) {
      return all.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }
    const q = searchQuery.toLowerCase().trim();
    return all
      .filter((c) => (c.name || '').toLowerCase().includes(q) || (c.place || '').toLowerCase().includes(q))
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  } catch (err) {
    console.warn('[Dexie] getCustomers error:', err);
    return [];
  }
}

export async function getCustomerById(id) {
  if (!id) return null;
  try {
    const cust = await db.customers
      .filter((c) => c.id === id || String(c.localId) === String(id))
      .first();
    return cust || null;
  } catch (err) {
    console.warn('[Dexie] getCustomerById error:', err);
    return null;
  }
}

export async function upsertCustomer(name, place = '') {
  if (!name || !name.trim()) return null;
  const trimmedName = name.trim();
  const trimmedPlace = (place || '').trim();

  try {
    const existing = await db.customers
      .filter((c) => (c.name || '').toLowerCase() === trimmedName.toLowerCase())
      .first();

    if (existing) {
      if (trimmedPlace && existing.place !== trimmedPlace) {
        await db.customers.update(existing.localId, { place: trimmedPlace, synced: false });
        existing.place = trimmedPlace;
      }
      return existing;
    }

    const newCust = {
      id: generateUuid(),
      name: trimmedName,
      place: trimmedPlace,
      synced: false
    };

    const localId = await db.customers.add(newCust);
    newCust.localId = localId;

    if (navigator.onLine && isSupabaseConfigured && supabase) {
      syncPendingChanges();
    }

    return newCust;
  } catch (err) {
    console.warn('[Dexie] upsertCustomer error:', err);
    return { id: generateUuid(), name: trimmedName, place: trimmedPlace, synced: false };
  }
}

// ----------------- QUOTATIONS -----------------

function filterQuotations(list, searchQuery) {
  if (!searchQuery || !searchQuery.trim()) return list;
  const q = searchQuery.toLowerCase().trim();
  return list.filter((item) => {
    const quoteNo = (item.quote_no || '').toLowerCase();
    const custName = (item.customers?.name || '').toLowerCase();
    const custPlace = (item.customers?.place || '').toLowerCase();
    return quoteNo.includes(q) || custName.includes(q) || custPlace.includes(q);
  });
}

export async function getQuotations(searchQuery = '') {
  // If Supabase is reachable, read ONLY from Supabase (Single source of truth)
  if (navigator.onLine && isSupabaseConfigured && supabase) {
    try {
      const { data: cloudQuotes, error: qErr } = await supabase
        .from('quotations')
        .select('*, customers(*)')
        .order('created_at', { ascending: false });

      if (qErr) {
        logSupabaseError('getQuotations', qErr);
        throw qErr;
      }

      // Check for any pending unsynced offline quotations in local cache
      let unsyncedQuotes = [];
      try {
        const unsynced = await db.quotations.filter((q) => q.synced === false).toArray();
        if (unsynced.length) {
          const allCustomers = await db.customers.toArray();
          const customerMap = {};
          allCustomers.forEach((c) => {
            if (c.id) customerMap[c.id] = c;
            if (c.localId) customerMap[String(c.localId)] = c;
          });
          unsyncedQuotes = unsynced.map((q) => ({
            ...q,
            customers: customerMap[q.customer_id] || { name: 'Customer', place: '' }
          }));
        }
      } catch (e) {
        console.warn('Error fetching unsynced quotations:', e);
      }

      const combined = [...unsyncedQuotes, ...(cloudQuotes || [])];

      // Mirror fresh cloud data to Dexie cache in the background (purging deleted items)
      syncFromSupabase().catch((e) => console.warn('[Sync] Background sync error:', e));

      return filterQuotations(combined, searchQuery);
    } catch (err) {
      console.warn('[dataService] Supabase unreachable, reading from offline cache:', err);
    }
  }

  // Offline fallback: read from Dexie local cache
  try {
    const [allQuotes, allCustomers] = await Promise.all([
      db.quotations.toArray(),
      db.customers.toArray()
    ]);

    const customerMap = {};
    allCustomers.forEach((c) => {
      if (c.id) customerMap[c.id] = c;
      if (c.localId) customerMap[String(c.localId)] = c;
    });

    const list = allQuotes
      .map((q) => ({
        ...q,
        customers: customerMap[q.customer_id] || { name: 'Customer', place: '' }
      }))
      .sort((a, b) => new Date(b.created_at || b.quote_date) - new Date(a.created_at || a.quote_date));

    return filterQuotations(list, searchQuery);
  } catch (err) {
    console.warn('[Dexie] getQuotations fallback error:', err);
    return [];
  }
}

export async function getQuotationById(id) {
  if (!id) return null;

  let quote = null;
  let items = [];
  let customer = null;

  // 1. If online and ID is a valid UUID, try fetching from Supabase
  if (isUuid(id) && navigator.onLine && isSupabaseConfigured && supabase) {
    try {
      const { data: sbQuote, error: qErr } = await supabase
        .from('quotations')
        .select('*, customers(*), quotation_items(*)')
        .eq('id', id)
        .maybeSingle();

      if (!qErr && sbQuote) {
        quote = sbQuote;
        customer = sbQuote.customers;
        if (Array.isArray(sbQuote.quotation_items) && sbQuote.quotation_items.length > 0) {
          items = sbQuote.quotation_items;
        } else {
          // Direct child query in case embedded relation was skipped or filtered by RLS
          const { data: directItems, error: diErr } = await supabase
            .from('quotation_items')
            .select('*')
            .eq('quotation_id', id);
          if (!diErr && Array.isArray(directItems) && directItems.length > 0) {
            items = directItems;
          }
        }
      }
    } catch (err) {
      console.warn('[dataService] getQuotationById Supabase error:', err);
    }
  }

  // 2. Lookup quotation in Dexie if not found in Supabase (or for local/offline data)
  let localQuote = null;
  try {
    const allQuotes = await db.quotations.toArray();
    const cleanId = String(id).trim().toLowerCase();
    localQuote = allQuotes.find(
      (q) =>
        (q.id && String(q.id).trim().toLowerCase() === cleanId) ||
        (q.localId !== undefined && q.localId !== null && String(q.localId).trim() === cleanId) ||
        (q.quote_no && String(q.quote_no).trim().toLowerCase() === cleanId)
    );

    if (!quote && localQuote) {
      quote = localQuote;
    }
  } catch (err) {
    console.warn('[Dexie] getQuotationById quote lookup error:', err);
  }

  if (!quote) return null;

  // 3. Resolve Customer if missing
  if (!customer) {
    const custId = quote.customer_id;
    if (custId) {
      try {
        const cleanCustId = String(custId).trim().toLowerCase();
        const allCusts = await db.customers.toArray();
        customer = allCusts.find(
          (c) =>
            (c.id && String(c.id).trim().toLowerCase() === cleanCustId) ||
            (c.localId !== undefined && c.localId !== null && String(c.localId).trim() === cleanCustId)
        );
      } catch (cErr) {
        console.warn('[Dexie] Customer lookup error:', cErr);
      }
    }
    if (!customer && quote.customers) {
      customer = quote.customers;
    }
  }

  // 4. Resolve Items: if items are still empty (e.g. Supabase returned 0 items or offline quote)
  if (!items || items.length === 0) {
    // Check if items are embedded directly in the quotation object
    if (Array.isArray(quote.items) && quote.items.length > 0) {
      items = quote.items;
    } else if (localQuote && Array.isArray(localQuote.items) && localQuote.items.length > 0) {
      items = localQuote.items;
    } else {
      // Query Dexie db.quotation_items with comprehensive matching
      try {
        const allDbItems = await db.quotation_items.toArray();
        const qId = quote.id ? String(quote.id).trim().toLowerCase() : null;
        const qLocalId = (quote.localId !== undefined && quote.localId !== null)
          ? String(quote.localId).trim()
          : (localQuote?.localId !== undefined && localQuote?.localId !== null ? String(localQuote.localId).trim() : null);
        const searchId = String(id).trim().toLowerCase();
        const qNo = quote.quote_no ? String(quote.quote_no).trim().toLowerCase() : null;

        items = allDbItems.filter((it) => {
          const itQId = it.quotation_id ? String(it.quotation_id).trim().toLowerCase() : null;
          const itLocalId = it.quotation_local_id !== undefined && it.quotation_local_id !== null
            ? String(it.quotation_local_id).trim()
            : null;

          if (qId && itQId === qId) return true;
          if (qLocalId && (itLocalId === qLocalId || itQId === qLocalId)) return true;
          if (searchId && (itQId === searchId || itLocalId === searchId)) return true;
          if (qNo && itQId === qNo) return true;
          return false;
        });
      } catch (itErr) {
        console.warn('[Dexie] quotation_items lookup error:', itErr);
      }
    }
  }

  // 5. Materials Catalog lookup: enrich any item referencing material_id if description/rate is missing
  let materialsMap = null;
  const enrichedItems = await Promise.all(
    (items || []).map(async (it, idx) => {
      let desc = it.description || it.name || it.desc || it.item_name || '';
      let unit = it.unit || it.uom || 'Nos';
      let rate = it.price !== undefined && it.price !== null ? it.price : (it.rate !== undefined && it.rate !== null ? it.rate : 0);

      if ((!desc || !rate) && it.material_id) {
        try {
          if (!materialsMap) {
            const allMats = await db.materials.toArray();
            materialsMap = new Map();
            allMats.forEach((m) => {
              if (m.id) materialsMap.set(String(m.id).trim().toLowerCase(), m);
              if (m.localId) materialsMap.set(String(m.localId).trim(), m);
            });
          }
          const cleanMatId = String(it.material_id).trim().toLowerCase();
          const mat = materialsMap.get(cleanMatId) || materialsMap.get(String(it.material_id).trim());
          if (mat) {
            if (!desc) desc = mat.name || mat.description || '';
            if (!unit || unit === 'Nos') unit = mat.unit || unit;
            if (!rate) rate = parseFloat(mat.rate) || 0;
          }
        } catch (mErr) {
          console.warn('[dataService] Material lookup error:', mErr);
        }
      }

      const rawQty = it.qty !== undefined && it.qty !== null ? it.qty : (it.quantity !== undefined && it.quantity !== null ? it.quantity : 1);
      const qty = parseFloat(rawQty);
      const numericQty = isNaN(qty) ? 1 : qty;
      const numericRate = parseFloat(rate) || 0;
      const rawTotal = it.total !== undefined && it.total !== null ? it.total : (it.amount !== undefined && it.amount !== null ? it.amount : Math.round(numericQty * numericRate * 100) / 100);
      const numericTotal = parseFloat(rawTotal);
      const finalTotal = isNaN(numericTotal) ? Math.round(numericQty * numericRate * 100) / 100 : numericTotal;

      return {
        ...it,
        id: it.id || String(idx + 1),
        sl_no: it.sl_no || idx + 1,
        description: desc,
        name: desc,
        desc: desc,
        unit: unit,
        uom: unit,
        qty: numericQty,
        quantity: numericQty,
        price: numericRate,
        rate: numericRate,
        total: finalTotal,
        amount: finalTotal
      };
    })
  );

  enrichedItems.sort((a, b) => (Number(a.sl_no) || 0) - (Number(b.sl_no) || 0));

  return {
    ...quote,
    customers: customer || { name: 'Customer', place: '' },
    items: enrichedItems
  };
}

export async function saveQuotation(quoteData) {
  // 1. Resolve / upsert customer locally
  let customerId = quoteData.customer_id;
  if (!customerId && quoteData.customerName) {
    const cust = await upsertCustomer(quoteData.customerName, quoteData.customerPlace || '');
    customerId = cust?.id || cust?.localId;
  }

  const isEditing = Boolean(quoteData.id || quoteData.localId);
  let targetQuote = null;

  if (isEditing) {
    const allQuotes = await db.quotations.toArray();
    targetQuote = allQuotes.find(
      (q) => (quoteData.id && q.id === quoteData.id) || (quoteData.localId && q.localId === quoteData.localId)
    );
  }

  const quoteId = targetQuote?.id && isUuid(targetQuote.id)
    ? targetQuote.id
    : (quoteData.id && isUuid(quoteData.id) ? quoteData.id : generateUuid());

  let assignedLocalId = targetQuote?.localId;

  // Build items list with comprehensive field aliases
  const itemsToAdd = (quoteData.items || []).map((it, idx) => {
    const desc = (it.description || it.name || it.desc || '').trim();
    const u = it.unit || it.uom || 'Nos';
    const rawQty = it.qty !== undefined && it.qty !== null ? it.qty : (it.quantity !== undefined && it.quantity !== null ? it.quantity : 1);
    const qty = parseFloat(rawQty);
    const numericQty = isNaN(qty) ? 1 : qty;
    const rawPrice = it.price !== undefined && it.price !== null ? it.price : (it.rate !== undefined && it.rate !== null ? it.rate : 0);
    const numericPrice = parseFloat(rawPrice) || 0;
    const rawTotal = it.total !== undefined && it.total !== null ? it.total : (it.amount !== undefined && it.amount !== null ? it.amount : Math.round(numericQty * numericPrice * 100) / 100);
    const numericTotal = parseFloat(rawTotal);
    const finalTotal = isNaN(numericTotal) ? Math.round(numericQty * numericPrice * 100) / 100 : numericTotal;

    return {
      id: it.id && isUuid(it.id) ? it.id : generateUuid(),
      quotation_id: quoteId,
      quotation_local_id: assignedLocalId,
      sl_no: it.sl_no || idx + 1,
      description: desc,
      name: desc,
      desc: desc,
      unit: u,
      uom: u,
      qty: numericQty,
      quantity: numericQty,
      price: numericPrice,
      rate: numericPrice,
      total: finalTotal,
      amount: finalTotal,
      material_id: it.material_id && isUuid(it.material_id) ? it.material_id : null,
      synced: false
    };
  });

  const recordPayload = {
    id: quoteId,
    quote_no: quoteData.quote_no,
    quote_date: quoteData.quote_date,
    customer_id: customerId,
    greeting: quoteData.greeting || '',
    closing: quoteData.closing || '',
    subtotal: parseFloat(quoteData.subtotal) || 0,
    discount_percent: parseFloat(quoteData.discount_percent) || 0,
    discount_amount: parseFloat(quoteData.discount_amount) || 0,
    gst_percent: parseFloat(quoteData.gst_percent) || 0,
    gst_amount: parseFloat(quoteData.gst_amount) || 0,
    grand_total: parseFloat(quoteData.grand_total) || 0,
    items: itemsToAdd,
    created_at: targetQuote?.created_at || new Date().toISOString(),
    synced: false
  };

  if (targetQuote) {
    await db.quotations.update(targetQuote.localId, recordPayload);
    await db.quotation_items
      .filter(
        (it) =>
          it.quotation_id === targetQuote.id ||
          it.quotation_id === String(targetQuote.localId) ||
          it.quotation_local_id === targetQuote.localId
      )
      .delete();
  } else {
    assignedLocalId = await db.quotations.add(recordPayload);
    await db.quotations.update(assignedLocalId, { localId: assignedLocalId, items: itemsToAdd });
  }

  // Update items with assigned local id
  itemsToAdd.forEach((it) => {
    it.quotation_local_id = assignedLocalId;
  });

  if (itemsToAdd.length) {
    await db.quotation_items.bulkAdd(itemsToAdd);
  }

  // If online, directly upsert quotation and items to Supabase
  if (navigator.onLine && isSupabaseConfigured && supabase) {
    try {
      let cloudCustId = customerId;
      if (customerId && !isUuid(customerId)) {
        const cust = await db.customers.where('localId').equals(Number(customerId)).first();
        if (cust?.id && isUuid(cust.id)) cloudCustId = cust.id;
      }

      const cloudQuotePayload = {
        id: quoteId,
        quote_no: recordPayload.quote_no,
        quote_date: recordPayload.quote_date,
        customer_id: isUuid(cloudCustId) ? cloudCustId : null,
        greeting: recordPayload.greeting,
        closing: recordPayload.closing,
        grand_total: recordPayload.grand_total,
        created_at: recordPayload.created_at
      };

      const { data: savedSbQuote, error: qErr } = await supabase
        .from('quotations')
        .upsert(cloudQuotePayload)
        .select()
        .single();

      if (qErr) {
        logSupabaseError('saveQuotation (cloud)', qErr);
      } else if (savedSbQuote) {
        await db.quotations.update(assignedLocalId, { synced: true });
        recordPayload.synced = true;

        // Upsert quotation_items
        await supabase.from('quotation_items').delete().eq('quotation_id', quoteId);
        if (itemsToAdd.length) {
          const cloudItems = itemsToAdd.map((it) => ({
            id: it.id,
            quotation_id: quoteId,
            material_id: it.material_id && isUuid(it.material_id) ? it.material_id : null,
            sl_no: it.sl_no,
            description: it.description,
            unit: it.unit,
            qty: it.qty,
            price: it.price,
            total: it.total
          }));

          const { error: itemsErr } = await supabase.from('quotation_items').insert(cloudItems);
          if (itemsErr) {
            logSupabaseError('saveQuotation items (cloud)', itemsErr);
          } else {
            for (const it of itemsToAdd) {
              await db.quotation_items.where('id').equals(it.id).modify({ synced: true });
            }
          }
        }
      }
    } catch (err) {
      console.warn('[saveQuotation] Error syncing to Supabase:', err);
    }
  }

  return {
    ...recordPayload,
    localId: assignedLocalId,
    id: quoteId,
    items: itemsToAdd
  };
}

export async function deleteQuotation(id) {
  if (!id) return { success: false, error: 'No quotation identifier provided' };

  let target = null;
  try {
    const allQuotes = await db.quotations.toArray();
    target = allQuotes.find(
      (q) => q.id === id || String(q.localId) === String(id)
    );
  } catch (err) {
    console.warn('[Dexie] deleteQuotation lookup error:', err);
  }

  const cloudId = (target && target.id && isUuid(target.id)) ? target.id : (isUuid(id) ? id : null);

  // If online and quotation has a cloud UUID, delete from Supabase FIRST
  if (cloudId && navigator.onLine && isSupabaseConfigured && supabase) {
    try {
      // First delete associated items from Supabase
      await supabase.from('quotation_items').delete().eq('quotation_id', cloudId);

      const { error: sbError } = await supabase.from('quotations').delete().eq('id', cloudId);

      if (sbError) {
        const code = sbError.code || 'UNKNOWN';
        const message = sbError.message || 'Failed to delete quotation from cloud';
        console.error(`[deleteQuotation] Supabase error: code=${code}, message=${message}`, sbError);
        return {
          success: false,
          error: `Failed to delete from database: ${message} (Code: ${code})`,
          code,
          message
        };
      }
    } catch (err) {
      console.error('[deleteQuotation] Exception during Supabase delete:', err);
      return {
        success: false,
        error: err.message || 'Network error while deleting quotation'
      };
    }
  }

  // Supabase delete succeeded (or offline purely local quote) -> Drop from Dexie cache
  try {
    if (target?.localId) {
      await db.quotations.delete(target.localId);
      await db.quotation_items
        .filter(
          (it) =>
            it.quotation_id === target.id ||
            it.quotation_id === String(target.localId) ||
            it.quotation_local_id === target.localId
        )
        .delete();
    } else if (isUuid(id)) {
      await db.quotations.where('id').equals(id).delete();
      await db.quotation_items.where('quotation_id').equals(id).delete();
    }
  } catch (dexieErr) {
    console.warn('[Dexie] Local cache drop error:', dexieErr);
  }

  return { success: true };
}

export async function getNextQuoteNo() {
  try {
    let quotes = [];
    if (navigator.onLine && isSupabaseConfigured && supabase) {
      const { data } = await supabase.from('quotations').select('quote_no');
      quotes = data || [];
    } else {
      quotes = await db.quotations.toArray();
    }

    const currentYear = new Date().getFullYear();
    const nextYearShort = String(currentYear + 1).slice(-2);
    const prefix = `VI/${currentYear}-${nextYearShort}/`;

    let maxNum = 0;
    quotes.forEach((q) => {
      const qNo = q.quote_no || '';
      if (qNo.startsWith(prefix)) {
        const numPart = parseInt(qNo.replace(prefix, ''), 10);
        if (!isNaN(numPart) && numPart > maxNum) maxNum = numPart;
      } else {
        const matches = qNo.match(/(\d+)$/);
        if (matches) {
          const val = parseInt(matches[1], 10);
          if (val > maxNum) maxNum = val;
        }
      }
    });

    const nextNumber = maxNum + 1;
    return `${prefix}${String(nextNumber).padStart(3, '0')}`;
  } catch (err) {
    return `VI/${new Date().getFullYear()}-27/001`;
  }
}

// ----------------- MATERIALS -----------------

export const DEFAULT_MATERIAL_CATEGORIES = [
  'Furniture',
  'Fabrication',
  'Hardware',
  'Electrical',
  'Raw Material',
  'Services'
];

function filterMaterials(list, searchQuery = '', categoryFilter = 'All', stockFilter = 'All') {
  let result = list;

  // 1. Filter by Stock Status
  if (stockFilter === 'In Stock') {
    result = result.filter((m) => m.in_stock !== false);
  } else if (stockFilter === 'Out of Stock') {
    result = result.filter((m) => m.in_stock === false);
  }

  // 2. Filter by Category
  if (categoryFilter && categoryFilter !== 'All') {
    if (categoryFilter === 'Uncategorized') {
      result = result.filter(
        (m) =>
          !m.category_id &&
          (!m.category || m.category.trim() === '' || m.category.trim().toLowerCase() === 'uncategorized')
      );
    } else {
      const filterCat = categoryFilter.toLowerCase().trim();
      result = result.filter(
        (m) =>
          (m.category_id && m.category_id === categoryFilter) ||
          (m.category || '').toLowerCase().trim() === filterCat
      );
    }
  }

  // 3. Filter by Search Query
  if (!searchQuery || !searchQuery.trim()) {
    return result.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }

  const q = searchQuery.toLowerCase().trim();
  return result
    .filter(
      (m) =>
        (m.name || '').toLowerCase().includes(q) ||
        (m.code || '').toLowerCase().includes(q) ||
        (m.category || '').toLowerCase().includes(q) ||
        (m.description || '').toLowerCase().includes(q)
    )
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
}

export async function getMaterials(searchQuery = '', categoryFilter = 'All', stockFilter = 'All') {
  // If Supabase is reachable, read ONLY from Supabase with is_active = true
  if (navigator.onLine && isSupabaseConfigured && supabase) {
    try {
      const { data: cloudMaterials, error: mErr } = await supabase
        .from('materials')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (mErr) {
        logSupabaseError('getMaterials', mErr);
        throw mErr;
      }

      // Check for any pending unsynced offline materials in local cache
      let unsyncedMats = [];
      try {
        unsyncedMats = await db.materials
          .filter((m) => m.synced === false && m.is_active !== false)
          .toArray();
      } catch (e) {
        console.warn('Error reading unsynced materials:', e);
      }

      const combined = [...unsyncedMats, ...(cloudMaterials || [])];

      // Enrich materials with human-readable category name from material_categories / Dexie
      const categories = await getMaterialCategories();
      const catMap = new Map();
      categories.forEach((c) => {
        if (c.id) catMap.set(String(c.id).toLowerCase(), c.name);
        if (c.localId) catMap.set(String(c.localId), c.name);
      });

      // Merge with local Dexie materials to preserve local image_url
      let allLocal = [];
      try {
        allLocal = await db.materials.toArray();
      } catch (e) {
        console.warn('Error reading local materials:', e);
      }
      const localMatMap = new Map();
      const localMatByName = new Map();
      allLocal.forEach((m) => {
        if (m.id) localMatMap.set(String(m.id).toLowerCase(), m);
        if (m.localId) localMatMap.set(String(m.localId), m);
        if (m.name) localMatByName.set(m.name.trim().toLowerCase(), m);
      });

      // Default/verified images for established catalog items if local cache was flushed during schema updates
      const KNOWN_MATERIAL_IMAGES = {
        desk: 'https://ugulqrvwimctpeudvkod.supabase.co/storage/v1/object/public/company-assets/assets/material-1791085577224.webp',
        table: 'https://ugulqrvwimctpeudvkod.supabase.co/storage/v1/object/public/company-assets/materials/material-1791086920926.webp'
      };

      const enriched = combined.map((m) => {
        const normName = (m.name || '').trim().toLowerCase();
        const local = localMatMap.get(String(m.id || m.localId || '').toLowerCase()) ||
                      localMatByName.get(normName);
        const resolvedImage = m.image_url || local?.image_url || KNOWN_MATERIAL_IMAGES[normName] || null;

        // If local record didn't have image_url but we resolved one, update local cache in background
        if (local && !local.image_url && resolvedImage) {
          db.materials.update(local.localId, { image_url: resolvedImage }).catch(() => {});
        }

        return {
          ...m,
          image_url: resolvedImage,
          category: m.category || (m.category_id ? catMap.get(String(m.category_id).toLowerCase()) : null) || ''
        };
      });

      // Mirror to Dexie cache in the background (drops inactive/deleted items)
      syncFromSupabase().catch((e) => console.warn('[Sync] Background sync error:', e));

      return filterMaterials(enriched, searchQuery, categoryFilter, stockFilter);
    } catch (err) {
      console.warn('[dataService] Supabase unreachable, reading materials from offline cache:', err);
    }
  }

  // Offline fallback: read active materials from Dexie local cache
  try {
    const all = await db.materials
      .filter((m) => m.is_active !== false)
      .toArray();
    return filterMaterials(all, searchQuery, categoryFilter, stockFilter);
  } catch (err) {
    console.warn('[Dexie] getMaterials fallback error:', err);
    return [];
  }
}

export async function getMaterialCategories() {
  // If Supabase is reachable, read from Supabase
  if (navigator.onLine && isSupabaseConfigured && supabase) {
    try {
      const { data: cloudCategories, error: cErr } = await supabase
        .from('material_categories')
        .select('*')
        .order('name');

      if (!cErr && cloudCategories !== null) {
        // Also merge local categories from Dexie
        let localCats = [];
        try {
          localCats = await db.material_categories
            .filter((c) => !c.is_deleted)
            .toArray();
        } catch (e) {
          console.warn('Error reading local categories:', e);
        }

        const map = new Map();
        localCats.forEach((c) => {
          const key = (c.id || c.name || '').toLowerCase();
          if (key) map.set(key, c);
        });
        cloudCategories.forEach((c) => {
          const key = (c.id || c.name || '').toLowerCase();
          if (key) map.set(key, c);
        });

        if (map.size === 0) {
          await seedAndMigrateMaterialCategories();
          const seeded = await db.material_categories.filter((c) => !c.is_deleted).toArray();
          seeded.forEach((c) => {
            const key = (c.id || c.name || '').toLowerCase();
            if (key) map.set(key, c);
          });
        }

        // Background sync to Dexie
        syncFromSupabase().catch((e) => console.warn('[Sync] Background sync error:', e));

        const list = Array.from(map.values()).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        if (list.length > 0) return list;
      }
    } catch (err) {
      console.warn('[dataService] Supabase unreachable for categories, falling back to Dexie:', err);
    }
  }

  // Offline fallback: read active categories from Dexie local cache
  try {
    let list = await db.material_categories.filter((c) => !c.is_deleted).toArray();
    if (list.length === 0) {
      await seedAndMigrateMaterialCategories();
      list = await db.material_categories.filter((c) => !c.is_deleted).toArray();
    }
    return list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  } catch (err) {
    console.warn('[Dexie] getMaterialCategories fallback error:', err);
    return DEFAULT_MATERIAL_CATEGORIES.map((name) => ({ id: name, name }));
  }
}

export async function saveMaterialCategory(catData) {
  const trimmedName = (catData.name || '').trim();
  if (!trimmedName) {
    throw new Error('Category name cannot be empty');
  }

  const targetId = catData.id || null;
  const targetLocalId = catData.localId || null;

  // Check for duplicate category name (case-insensitive)
  const all = await db.material_categories.filter((c) => !c.is_deleted).toArray();
  const duplicate = all.find(
    (c) =>
      c.name.toLowerCase().trim() === trimmedName.toLowerCase() &&
      c.id !== targetId &&
      c.localId !== targetLocalId
  );
  if (duplicate) {
    throw new Error(`Category "${trimmedName}" already exists`);
  }

  let target = null;
  if (targetId || targetLocalId) {
    target = all.find(
      (c) => (targetId && c.id === targetId) || (targetLocalId && c.localId === targetLocalId)
    );
  }

  if (target) {
    // Editing / Rename
    const oldName = target.name;
    const updated = {
      ...target,
      name: trimmedName,
      synced: false
    };

    await db.material_categories.update(target.localId, {
      name: trimmedName,
      synced: false
    });

    // Update materials referencing old name or category_id
    try {
      const allMats = await db.materials.toArray();
      for (const m of allMats) {
        if (
          m.category_id === target.id ||
          (m.category && m.category.toLowerCase().trim() === oldName.toLowerCase().trim())
        ) {
          await db.materials.update(m.localId, {
            category_id: target.id,
            category: trimmedName
          });
        }
      }
    } catch (mErr) {
      console.warn('Error updating local materials for renamed category:', mErr);
    }

    // If online, update in Supabase
    if (navigator.onLine && isSupabaseConfigured && supabase) {
      try {
        await supabase
          .from('material_categories')
          .update({ name: trimmedName })
          .eq('id', target.id);

        await db.material_categories.update(target.localId, { synced: true });
        updated.synced = true;
      } catch (sbErr) {
        console.warn('[saveMaterialCategory] Error updating cloud category:', sbErr);
      }
    }

    return updated;
  } else {
    // Adding New Category
    const newId = generateOfflineUuid();
    const payload = {
      id: newId,
      name: trimmedName,
      created_at: new Date().toISOString(),
      synced: false
    };

    const localId = await db.material_categories.add(payload);
    payload.localId = localId;

    // If online, insert to Supabase
    if (navigator.onLine && isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('material_categories')
          .insert({ id: newId, name: trimmedName })
          .select()
          .single();

        if (!error && data) {
          await db.material_categories.update(localId, { id: data.id, synced: true });
          payload.id = data.id;
          payload.synced = true;
        }
      } catch (sbErr) {
        console.warn('[saveMaterialCategory] Error saving cloud category:', sbErr);
      }
    }

    return payload;
  }
}

export async function deleteMaterialCategory(category) {
  if (!category) return { success: false };

  const targetId = category.id || null;
  const targetLocalId = category.localId || null;
  const targetName = category.name || '';

  // 1. Unlink materials in local Dexie (set category_id = null, category = null)
  try {
    const allMats = await db.materials.toArray();
    for (const m of allMats) {
      const matchId = targetId && m.category_id === targetId;
      const matchLocalId = targetLocalId && m.category_id === targetLocalId;
      const matchName =
        targetName &&
        m.category &&
        m.category.toLowerCase().trim() === targetName.toLowerCase().trim();

      if (matchId || matchLocalId || matchName) {
        await db.materials.update(m.localId, {
          category_id: null,
          category: null,
          synced: false
        });
      }
    }
  } catch (mErr) {
    console.warn('Error unlinking local materials on category delete:', mErr);
  }

  // 2. Delete or mark deleted in local Dexie
  if (targetLocalId) {
    if (targetId) {
      await db.material_categories.update(targetLocalId, { is_deleted: true, synced: false });
    } else {
      await db.material_categories.delete(targetLocalId);
    }
  } else if (targetId) {
    const local = await db.material_categories.where('id').equals(targetId).first();
    if (local) {
      await db.material_categories.update(local.localId, { is_deleted: true, synced: false });
    }
  }

  // 3. If online, unlink materials and delete in Supabase
  if (navigator.onLine && isSupabaseConfigured && supabase && targetId) {
    try {
      await supabase
        .from('materials')
        .update({ category_id: null })
        .eq('category_id', targetId);

      await supabase
        .from('material_categories')
        .delete()
        .eq('id', targetId);

      if (targetLocalId) {
        await db.material_categories.delete(targetLocalId);
      }
    } catch (sbErr) {
      console.warn('[deleteMaterialCategory] Error deleting from Supabase:', sbErr);
    }
  }

  return { success: true };
}

export async function saveMaterial(matData) {
  const isEditing = Boolean(matData.id || matData.localId);
  let target = null;

  const all = await db.materials.toArray();
  if (isEditing) {
    target = all.find(
      (m) => (matData.id && m.id === matData.id) ||
             (matData.localId && m.localId === matData.localId) ||
             (matData.name && m.name && m.name.trim().toLowerCase() === matData.name.trim().toLowerCase())
    );
  } else if (matData.name) {
    target = all.find(
      (m) => m.name && m.name.trim().toLowerCase() === matData.name.trim().toLowerCase()
    );
  }

  const matId = target?.id && isUuid(target.id)
    ? target.id
    : (matData.id && isUuid(matData.id) ? matData.id : generateUuid());

  const payload = {
    id: matId,
    name: matData.name,
    code: matData.code || '',
    unit: matData.unit || 'Nos',
    rate: parseFloat(matData.rate) || 0,
    description: matData.description || '',
    category: matData.category ? matData.category.trim() : null,
    category_id: matData.category_id || null,
    image_url: matData.image_url !== undefined && matData.image_url !== ''
      ? matData.image_url
      : (target?.image_url || null),
    in_stock: matData.in_stock !== undefined ? Boolean(matData.in_stock) : (target?.in_stock !== undefined ? target.in_stock : true),
    stock_qty: (matData.stock_qty !== undefined && matData.stock_qty !== null && matData.stock_qty !== '')
      ? parseFloat(matData.stock_qty)
      : (matData.stock_qty === '' ? null : (target?.stock_qty !== undefined ? target.stock_qty : null)),
    is_active: true,
    synced: false
  };

  if (target) {
    await db.materials.update(target.localId, payload);
    payload.localId = target.localId;
  } else {
    const localId = await db.materials.add(payload);
    payload.localId = localId;
  }

  // If online, directly upsert to Supabase
  if (navigator.onLine && isSupabaseConfigured && supabase) {
    try {
      let validCatId = null;
      if (payload.category_id && isUuid(payload.category_id)) {
        try {
          const { data: remoteCat } = await supabase
            .from('material_categories')
            .select('id')
            .eq('id', payload.category_id)
            .maybeSingle();
          if (remoteCat) validCatId = payload.category_id;
        } catch (e) {}
      }

      // Note: 'category' and 'image_url' were dropped from materials table in Supabase.
      // Only include valid columns in cloud upsert:
      const cloudHasImageCol = await isCloudImageUrlSupported();
      const sbPayload = {
        id: payload.id,
        name: payload.name,
        code: payload.code,
        hsn: payload.code || null,
        unit: payload.unit,
        rate: payload.rate,
        description: payload.description,
        category_id: validCatId,
        in_stock: payload.in_stock,
        stock_qty: payload.stock_qty,
        is_active: true
      };
      if (cloudHasImageCol && payload.image_url) {
        sbPayload.image_url = payload.image_url;
      }

      const { data: savedSbMat, error: sbError } = await supabase
        .from('materials')
        .upsert(sbPayload)
        .select()
        .single();

      if (sbError) {
        logSupabaseError('saveMaterial (cloud)', sbError);
      } else if (savedSbMat) {
        payload.synced = true;
        await db.materials.update(payload.localId, { synced: true });
      }
    } catch (err) {
      console.warn('[saveMaterial] Error syncing to Supabase:', err);
    }
  }

  return payload;
}

export async function updateMaterialStock(identifier, { in_stock, stock_qty } = {}) {
  if (!identifier) return null;
  const targetId = typeof identifier === 'object' ? (identifier.id || identifier.localId) : identifier;

  const all = await db.materials.toArray();
  const target = all.find(
    (m) =>
      (m.id && m.id === targetId) ||
      (m.localId && String(m.localId) === String(targetId)) ||
      (typeof identifier === 'object' &&
        ((identifier.id && m.id === identifier.id) ||
          (identifier.localId && m.localId === identifier.localId)))
  );

  if (!target) return null;

  const updates = { synced: false };
  if (in_stock !== undefined) {
    updates.in_stock = Boolean(in_stock);
  }
  if (stock_qty !== undefined) {
    updates.stock_qty = (stock_qty !== null && stock_qty !== '') ? parseFloat(stock_qty) : null;
  }

  await db.materials.update(target.localId, updates);
  const updatedMaterial = { ...target, ...updates };

  // Sync to Supabase in background if online
  if (navigator.onLine && isSupabaseConfigured && supabase && target.id && isUuid(target.id)) {
    const sbUpdates = {};
    if (in_stock !== undefined) sbUpdates.in_stock = updates.in_stock;
    if (stock_qty !== undefined) sbUpdates.stock_qty = updates.stock_qty;

    supabase
      .from('materials')
      .update(sbUpdates)
      .eq('id', target.id)
      .then(({ error }) => {
        if (!error) {
          db.materials.update(target.localId, { synced: true });
        } else {
          console.warn('[updateMaterialStock] Background sync error:', error);
        }
      })
      .catch((e) => console.warn('[updateMaterialStock] Sync exception:', e));
  }

  return updatedMaterial;
}


export async function deleteMaterial(identifier) {
  if (!identifier) return { success: false, error: 'No material identifier provided' };

  let target = null;
  const targetId = typeof identifier === 'object' ? (identifier.id || identifier.localId) : identifier;

  try {
    const all = await db.materials.toArray();
    target = all.find(
      (m) =>
        (m.id && m.id === targetId) ||
        (m.localId && String(m.localId) === String(targetId)) ||
        (typeof identifier === 'object' &&
          ((identifier.id && m.id === identifier.id) ||
            (identifier.localId && m.localId === identifier.localId)))
    );
  } catch (e) {
    console.warn('[Dexie] Error finding material for deletion:', e);
  }

  const cloudId = (target && target.id && isUuid(target.id)) ? target.id : (isUuid(targetId) ? targetId : null);

  // Soft delete (is_active = false) in Supabase if online
  if (cloudId && navigator.onLine && isSupabaseConfigured && supabase) {
    try {
      const { error: sbError } = await supabase
        .from('materials')
        .update({ is_active: false })
        .eq('id', cloudId);

      if (sbError) {
        const code = sbError.code || 'UNKNOWN';
        const message = sbError.message || 'Failed to soft delete material';
        console.error(`[deleteMaterial] Supabase error: code=${code}, message=${message}`, sbError);
        return {
          success: false,
          error: `Failed to delete material: ${message} (Code: ${code})`,
          code,
          message
        };
      }
    } catch (err) {
      console.error('[deleteMaterial] Supabase soft delete exception:', err);
      return {
        success: false,
        error: err.message || 'Network error while deleting material'
      };
    }
  }

  // Drop from local Dexie cache (Requirement 4: local cache also drops the item)
  try {
    if (target?.localId) {
      await db.materials.delete(target.localId);
    } else if (isUuid(targetId)) {
      await db.materials.where('id').equals(targetId).delete();
    }

    // Unlink any local Dexie quotation items referencing this material
    await db.quotation_items
      .filter((it) => it.material_id === cloudId || String(it.material_id) === String(targetId))
      .modify({ material_id: null });
  } catch (dexieErr) {
    console.warn('[Dexie] Error dropping material from local cache:', dexieErr);
  }

  return { success: true };
}

// ----------------- DASHBOARD ANALYTICS (OFFLINE-FIRST VIA DEXIE) -----------------

export async function getDashboardAnalytics() {
  try {
    const [allQuotes, allCustomers] = await Promise.all([
      db.quotations.toArray(),
      db.customers.toArray()
    ]);

    const customerMap = {};
    allCustomers.forEach((c) => {
      if (c.id) customerMap[c.id] = c;
      if (c.localId) customerMap[String(c.localId)] = c;
    });

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-indexed (Jan = 0)

    let totalQuotedValue = 0;
    let thisMonthCount = 0;
    let thisMonthValue = 0;
    const customerSpending = {};

    allQuotes.forEach((q) => {
      const grandTotal = parseFloat(q.grand_total) || 0;
      totalQuotedValue += grandTotal;

      // Filter by current month
      const dateVal = q.quote_date || q.created_at;
      if (dateVal) {
        const d = new Date(dateVal);
        if (!isNaN(d.getTime())) {
          if (d.getFullYear() === currentYear && d.getMonth() === currentMonth) {
            thisMonthCount++;
            thisMonthValue += grandTotal;
          }
        }
      }

      // Group by customer
      const cust = customerMap[q.customer_id];
      const custKey = cust?.id || cust?.name || q.customer_id || 'Unknown Customer';
      const custName = cust?.name || 'Customer';
      const custPlace = cust?.place || '';

      if (!customerSpending[custKey]) {
        customerSpending[custKey] = {
          id: custKey,
          name: custName,
          place: custPlace,
          totalAmount: 0,
          quoteCount: 0
        };
      }
      customerSpending[custKey].totalAmount += grandTotal;
      customerSpending[custKey].quoteCount += 1;
    });

    // Top 5 customers sorted descending by total quoted value
    const topCustomers = Object.values(customerSpending)
      .sort((a, b) => b.totalAmount - a.totalAmount)
      .slice(0, 5);

    return {
      totalQuotations: allQuotes.length,
      totalQuotedValue,
      thisMonthCount,
      thisMonthValue,
      topCustomers,
      currentMonthName: now.toLocaleString('en-IN', { month: 'long', year: 'numeric' })
    };
  } catch (err) {
    console.warn('[Dexie] getDashboardAnalytics error:', err);
    return {
      totalQuotations: 0,
      totalQuotedValue: 0,
      thisMonthCount: 0,
      thisMonthValue: 0,
      topCustomers: [],
      currentMonthName: ''
    };
  }
}

