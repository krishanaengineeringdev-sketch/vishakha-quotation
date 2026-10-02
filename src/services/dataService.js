import { supabase, isSupabaseConfigured } from '../supabaseClient';
import { db, generateOfflineUuid, syncPendingChanges, syncFromSupabase } from '../db/localDb';
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

  // If online and id is a valid UUID, read directly from Supabase
  if (isUuid(id) && navigator.onLine && isSupabaseConfigured && supabase) {
    try {
      const { data: quote, error: qErr } = await supabase
        .from('quotations')
        .select('*, customers(*), quotation_items(*)')
        .eq('id', id)
        .maybeSingle();

      if (!qErr && quote) {
        const sortedItems = (quote.quotation_items || []).sort(
          (a, b) => (a.sl_no || 0) - (b.sl_no || 0)
        );
        return {
          ...quote,
          customers: quote.customers || { name: 'Customer', place: '' },
          items: sortedItems
        };
      }
    } catch (err) {
      console.warn('[dataService] getQuotationById Supabase error:', err);
    }
  }

  // Fallback to local Dexie cache
  try {
    const allQuotes = await db.quotations.toArray();
    const quotation = allQuotes.find(
      (q) => q.id === id || String(q.localId) === String(id)
    );

    if (!quotation) return null;

    let customer = null;
    if (quotation.customer_id) {
      customer = await db.customers
        .filter((c) => c.id === quotation.customer_id || String(c.localId) === String(quotation.customer_id))
        .first();
    }

    const allItems = await db.quotation_items.toArray();
    const items = allItems
      .filter(
        (it) =>
          it.quotation_id === quotation.id ||
          it.quotation_id === String(quotation.localId) ||
          it.quotation_local_id === quotation.localId
      )
      .sort((a, b) => (a.sl_no || 0) - (b.sl_no || 0));

    return {
      ...quotation,
      customers: customer || { name: 'Customer', place: '' },
      items
    };
  } catch (err) {
    console.warn('[Dexie] getQuotationById fallback error:', err);
    return null;
  }
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
    created_at: targetQuote?.created_at || new Date().toISOString(),
    synced: false
  };

  let assignedLocalId = targetQuote?.localId;

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
    await db.quotations.update(assignedLocalId, { localId: assignedLocalId });
  }

  const itemsToAdd = (quoteData.items || []).map((it, idx) => ({
    id: it.id && isUuid(it.id) ? it.id : generateUuid(),
    quotation_id: quoteId,
    quotation_local_id: assignedLocalId,
    sl_no: it.sl_no || idx + 1,
    description: it.description,
    unit: it.unit || 'Nos',
    qty: parseFloat(it.qty) || 1,
    price: parseFloat(it.price !== undefined ? it.price : it.rate) || 0,
    total: parseFloat(it.total !== undefined ? it.total : it.amount) || 0,
    material_id: it.material_id && isUuid(it.material_id) ? it.material_id : null,
    synced: false
  }));

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
            material_id: it.material_id,
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

function filterMaterials(list, searchQuery) {
  if (!searchQuery || !searchQuery.trim()) {
    return list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }
  const q = searchQuery.toLowerCase().trim();
  return list
    .filter(
      (m) =>
        (m.name || '').toLowerCase().includes(q) ||
        (m.code || '').toLowerCase().includes(q)
    )
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
}

export async function getMaterials(searchQuery = '') {
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

      // Mirror to Dexie cache in the background (drops inactive/deleted items)
      syncFromSupabase().catch((e) => console.warn('[Sync] Background sync error:', e));

      return filterMaterials(combined, searchQuery);
    } catch (err) {
      console.warn('[dataService] Supabase unreachable, reading materials from offline cache:', err);
    }
  }

  // Offline fallback: read active materials from Dexie local cache
  try {
    const all = await db.materials
      .filter((m) => m.is_active !== false)
      .toArray();
    return filterMaterials(all, searchQuery);
  } catch (err) {
    console.warn('[Dexie] getMaterials fallback error:', err);
    return [];
  }
}

export async function saveMaterial(matData) {
  const isEditing = Boolean(matData.id || matData.localId);
  let target = null;

  if (isEditing) {
    const all = await db.materials.toArray();
    target = all.find(
      (m) => (matData.id && m.id === matData.id) || (matData.localId && m.localId === matData.localId)
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
      const { data: savedSbMat, error: sbError } = await supabase
        .from('materials')
        .upsert({
          id: payload.id,
          name: payload.name,
          code: payload.code,
          unit: payload.unit,
          rate: payload.rate,
          description: payload.description,
          is_active: true
        })
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
