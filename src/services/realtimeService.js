import { supabase, isSupabaseConfigured } from '../supabaseClient';
import { db } from '../db/localDb';

let channel = null;

/**
 * Initializes Supabase Realtime subscriptions on materials, material_categories, quotations, and quotation_items.
 * When changes occur on the server (by other devices or admin), records are immediately synced to local Dexie
 * and a custom event 'vishakha_realtime_change' is dispatched so UI components update without manual refresh.
 */
export function initRealtimeSubscriptions() {
  if (!isSupabaseConfigured || !supabase || channel) {
    return () => {};
  }

  try {
    channel = supabase
      .channel('public-db-realtime')
      // 1. Materials changes
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'materials' },
        async (payload) => {
          try {
            const { eventType, new: newRec, old: oldRec } = payload;
            if (eventType === 'DELETE' && oldRec?.id) {
              await db.materials.where('id').equals(oldRec.id).delete();
            } else if (newRec?.id) {
              const existing = await db.materials.where('id').equals(newRec.id).first();
              if (existing) {
                await db.materials.update(existing.localId, { ...newRec, synced: true });
              } else {
                await db.materials.add({ ...newRec, synced: true });
              }
            }
            dispatchRealtimeEvent('materials', eventType, newRec, oldRec);
          } catch (err) {
            console.warn('[Realtime] Error processing materials change:', err);
          }
        }
      )
      // 2. Material Categories changes
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'material_categories' },
        async (payload) => {
          try {
            const { eventType, new: newRec, old: oldRec } = payload;
            if (eventType === 'DELETE' && oldRec?.id) {
              await db.material_categories.where('id').equals(oldRec.id).delete();
            } else if (newRec?.id) {
              const existing = await db.material_categories.where('id').equals(newRec.id).first();
              if (existing) {
                await db.material_categories.update(existing.localId, { ...newRec, synced: true });
              } else {
                await db.material_categories.add({ ...newRec, synced: true });
              }
            }
            dispatchRealtimeEvent('material_categories', eventType, newRec, oldRec);
          } catch (err) {
            console.warn('[Realtime] Error processing category change:', err);
          }
        }
      )
      // 3. Quotations changes
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'quotations' },
        async (payload) => {
          try {
            const { eventType, new: newRec, old: oldRec } = payload;
            if (eventType === 'DELETE' && oldRec?.id) {
              await db.quotations.where('id').equals(oldRec.id).delete();
            } else if (newRec?.id) {
              const existing = await db.quotations.where('id').equals(newRec.id).first();
              if (existing) {
                await db.quotations.update(existing.localId, { ...newRec, synced: true });
              } else {
                await db.quotations.add({ ...newRec, synced: true });
              }
            }
            dispatchRealtimeEvent('quotations', eventType, newRec, oldRec);
          } catch (err) {
            console.warn('[Realtime] Error processing quotation change:', err);
          }
        }
      )
      // 4. Quotation Items changes
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'quotation_items' },
        async (payload) => {
          try {
            const { eventType, new: newRec, old: oldRec } = payload;
            if (eventType === 'DELETE' && oldRec?.id) {
              await db.quotation_items.where('id').equals(oldRec.id).delete();
            } else if (newRec?.id) {
              const existing = await db.quotation_items.where('id').equals(newRec.id).first();
              if (existing) {
                await db.quotation_items.update(existing.localId, { ...newRec, synced: true });
              } else {
                await db.quotation_items.add({ ...newRec, synced: true });
              }
            }
            dispatchRealtimeEvent('quotation_items', eventType, newRec, oldRec);
          } catch (err) {
            console.warn('[Realtime] Error processing quotation items change:', err);
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.info('[Realtime] Live database sync subscribed successfully.');
        }
      });
  } catch (subErr) {
    console.warn('[Realtime] Failed to initialize Supabase realtime subscription:', subErr);
  }

  return () => {
    cleanupRealtimeSubscriptions();
  };
}

export function cleanupRealtimeSubscriptions() {
  if (channel && supabase) {
    try {
      supabase.removeChannel(channel);
      channel = null;
      console.info('[Realtime] Realtime channel unsubscribed.');
    } catch (e) {
      console.warn('[Realtime] Error removing channel:', e);
    }
  }
}

function dispatchRealtimeEvent(table, eventType, newRecord, oldRecord) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('vishakha_realtime_change', {
        detail: { table, eventType, newRecord, oldRecord }
      })
    );
  }
}
