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

export async function getQuotations(searchQuery = '') {
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

    let list = allQuotes.map((q) => ({
      ...q,
      customers: customerMap[q.customer_id] || { name: 'Customer', place: '' }
    })).sort((a, b) => new Date(b.created_at || b.quote_date) - new Date(a.created_at || a.quote_date));

    if (!searchQuery.trim()) return list;

    const query = searchQuery.toLowerCase().trim();
    return list.filter((q) => {
      const quoteNo = (q.quote_no || '').toLowerCase();
      const custName = (q.customers?.name || '').toLowerCase();
      const custPlace = (q.customers?.place || '').toLowerCase();
      return quoteNo.includes(query) || custName.includes(query) || custPlace.includes(query);
    });
  } catch (err) {
    console.warn('[Dexie] getQuotations error:', err);
    return [];
  }
}

export async function getQuotationById(id) {
  if (!id) return null;

  try {
    const allQuotes = await db.quotations.toArray();
    const quotation = allQuotes.find(
      (q) => q.id === id || String(q.localId) === String(id)
    );

    if (!quotation) return null;

    // Load customer
    let customer = null;
    if (quotation.customer_id) {
      customer = await db.customers
        .filter((c) => c.id === quotation.customer_id || String(c.localId) === String(quotation.customer_id))
        .first();
    }

    // Load items
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
    console.warn('[Dexie] getQuotationById error:', err);
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

  const quoteId = targetQuote?.id || quoteData.id || generateUuid();

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
    synced: false // Marked as pending sync until synced to cloud
  };

  let assignedLocalId = targetQuote?.localId;

  if (targetQuote) {
    await db.quotations.update(targetQuote.localId, recordPayload);
    // Remove existing items to overwrite with new ones
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

  // 2. Add Quotation Items into Dexie
  const itemsToAdd = (quoteData.items || []).map((it, idx) => ({
    id: it.id || generateUuid(),
    quotation_id: quoteId,
    quotation_local_id: assignedLocalId,
    sl_no: it.sl_no || idx + 1,
    description: it.description,
    unit: it.unit || 'Nos',
    qty: parseFloat(it.qty) || 1,
    price: parseFloat(it.price !== undefined ? it.price : it.rate) || 0,
    total: parseFloat(it.total !== undefined ? it.total : it.amount) || 0,
    material_id: it.material_id || null,
    synced: false
  }));

  if (itemsToAdd.length) {
    await db.quotation_items.bulkAdd(itemsToAdd);
  }

  const result = {
    ...recordPayload,
    localId: assignedLocalId,
    id: quoteId,
    items: itemsToAdd
  };

  // 3. If online, attempt background sync immediately
  if (navigator.onLine && isSupabaseConfigured && supabase) {
    syncPendingChanges().catch((e) => console.warn('[Sync] Background sync queued:', e));
  }

  return result;
}

export async function deleteQuotation(id) {
  if (!id) return { success: false, error: 'No quotation identifier provided' };

  try {
    const allQuotes = await db.quotations.toArray();
    const target = allQuotes.find(
      (q) => q.id === id || String(q.localId) === String(id)
    );

    if (target) {
      await db.quotations.delete(target.localId);
      await db.quotation_items
        .filter(
          (it) =>
            it.quotation_id === target.id ||
            it.quotation_id === String(target.localId) ||
            it.quotation_local_id === target.localId
        )
        .delete();

      // If online and had a Supabase UUID, delete from cloud
      if (target.id && isUuid(target.id) && navigator.onLine && isSupabaseConfigured && supabase) {
        try {
          const { error } = await supabase.from('quotations').delete().eq('id', target.id);
          if (error) {
            logSupabaseError('deleteQuotation', error);
          }
        } catch (e) {
          console.warn('[Sync] Cloud delete failed:', e);
        }
      }
      return { success: true };
    }
    return { success: false, error: 'Quotation not found' };
  } catch (err) {
    console.warn('[Dexie] deleteQuotation error:', err);
    return { success: false, error: err.message || 'Failed to delete quotation' };
  }
}

export async function getNextQuoteNo() {
  try {
    const quotes = await db.quotations.toArray();
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

export async function getMaterials(searchQuery = '') {
  try {
    const all = await db.materials.toArray();
    if (!searchQuery.trim()) {
      return all.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }
    const q = searchQuery.toLowerCase().trim();
    return all
      .filter((m) => (m.name || '').toLowerCase().includes(q) || (m.code || '').toLowerCase().includes(q))
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  } catch (err) {
    console.warn('[Dexie] getMaterials error:', err);
    return [];
  }
}

export async function saveMaterial(matData) {
  const isEditing = Boolean(matData.id || matData.localId);
  let target = null;

  if (isEditing) {
    const all = await db.materials.toArray();
    target = all.find((m) => (matData.id && m.id === matData.id) || (matData.localId && m.localId === matData.localId));
  }

  const payload = {
    id: target?.id || matData.id || generateUuid(),
    name: matData.name,
    code: matData.code || '',
    unit: matData.unit || 'Nos',
    rate: parseFloat(matData.rate) || 0,
    description: matData.description || '',
    is_active: matData.is_active !== false,
    synced: false
  };

  if (target) {
    await db.materials.update(target.localId, payload);
    payload.localId = target.localId;
  } else {
    const localId = await db.materials.add(payload);
    payload.localId = localId;
  }

  if (navigator.onLine && isSupabaseConfigured && supabase) {
    syncPendingChanges().catch((e) => console.warn('[Sync] Material sync failed:', e));
  }

  return payload;
}

export async function deleteMaterial(identifier) {
  if (!identifier) return { success: false, error: 'No material identifier provided' };

  try {
    const all = await db.materials.toArray();
    const target = all.find(
      (m) =>
        (m.id && m.id === identifier) ||
        (m.localId && String(m.localId) === String(identifier)) ||
        (typeof identifier === 'object' &&
          ((identifier.id && m.id === identifier.id) ||
            (identifier.localId && m.localId === identifier.localId)))
    );

    if (!target) {
      console.warn('[Dexie] Material not found for deletion:', identifier);
      return { success: false, error: 'Material not found' };
    }

    // 1. Unlink any local Dexie quotation items referencing this material
    try {
      await db.quotation_items
        .filter(
          (it) =>
            it.material_id === target.id ||
            String(it.material_id) === String(target.localId)
        )
        .modify({ material_id: null });
    } catch (e) {
      console.warn('[Dexie] Could not unlink local quotation_items:', e);
    }

    // 2. If online and Supabase is configured and material has a cloud UUID
    if (target.id && isUuid(target.id) && navigator.onLine && isSupabaseConfigured && supabase) {
      // First attempt to delete directly from Supabase
      const { error: sbError } = await supabase.from('materials').delete().eq('id', target.id);

      if (sbError) {
        logSupabaseError('deleteMaterial', sbError);

        // If foreign key constraint violation (Postgres error 23503)
        if (
          sbError.code === '23503' ||
          sbError.message?.toLowerCase().includes('foreign key') ||
          sbError.details?.toLowerCase().includes('foreign key')
        ) {
          try {
            // Unlink quotation_items in Supabase so past quotations remain intact
            console.log('[Supabase] Unlinking material from quotation_items to resolve foreign key...');
            const { error: unlinkErr } = await supabase
              .from('quotation_items')
              .update({ material_id: null })
              .eq('material_id', target.id);

            if (!unlinkErr) {
              // Retry delete after unlinking
              const { error: retryErr } = await supabase.from('materials').delete().eq('id', target.id);
              if (retryErr) {
                return {
                  success: false,
                  error: 'This material is used in existing quotations and cannot be deleted.'
                };
              }
            } else {
              return {
                success: false,
                error: 'This material is used in existing quotations and cannot be deleted.'
              };
            }
          } catch (unlinkException) {
            return {
              success: false,
              error: 'This material is used in existing quotations and cannot be deleted.'
            };
          }
        } else {
          return {
            success: false,
            error: sbError.message || 'Failed to delete from database'
          };
        }
      }
    }

    // 3. Delete from Dexie local database
    await db.materials.delete(target.localId);
    return { success: true };
  } catch (err) {
    console.error('[deleteMaterial] Error deleting material:', err);
    return { success: false, error: err.message || 'Failed to delete material' };
  }
}
