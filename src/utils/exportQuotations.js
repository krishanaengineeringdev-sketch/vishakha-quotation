import * as XLSX from 'xlsx';
import { db } from '../db/localDb';

/**
 * Exports quotations from local Dexie storage to an Excel (.xlsx) file.
 * Creates a flat row-per-quotation-item with all customer and pricing details.
 * Completely offline capable.
 *
 * @param {Array} filteredQuotes - Optional list of quotations (if filtered by search).
 *                                  If not provided or null, all local quotations are exported.
 * @returns {Promise<{ success: boolean, count: number, quoteCount: number, fileName: string }>}
 */
export async function exportQuotationsToExcel(filteredQuotes = null) {
  // 1. Fetch from Dexie local storage
  const [allDbQuotes, allCustomers, allItems] = await Promise.all([
    db.quotations.toArray(),
    db.customers.toArray(),
    db.quotation_items.toArray()
  ]);

  // Customer lookup map
  const customerMap = new Map();
  allCustomers.forEach((c) => {
    if (c.id) customerMap.set(c.id, c);
    if (c.localId) customerMap.set(String(c.localId), c);
  });

  // Items grouped by quotation
  const itemsByQuoteId = new Map();
  allItems.forEach((it) => {
    const keys = [];
    if (it.quotation_id) keys.push(String(it.quotation_id));
    if (it.quotation_local_id) keys.push(String(it.quotation_local_id));

    keys.forEach((k) => {
      if (!itemsByQuoteId.has(k)) {
        itemsByQuoteId.set(k, []);
      }
      itemsByQuoteId.get(k).push(it);
    });
  });

  // Determine quotes to export
  let targetQuotes = [];
  if (Array.isArray(filteredQuotes) && filteredQuotes.length > 0) {
    // Match by ID or localId from Dexie cache to ensure fresh references
    const idSet = new Set(filteredQuotes.map((q) => String(q.id || q.localId)));
    targetQuotes = allDbQuotes.filter(
      (q) => idSet.has(String(q.id)) || idSet.has(String(q.localId))
    );
    // If not found in Dexie (e.g. freshly loaded cloud items), use filteredQuotes directly
    if (targetQuotes.length === 0) {
      targetQuotes = filteredQuotes;
    }
  } else if (Array.isArray(filteredQuotes) && filteredQuotes.length === 0) {
    throw new Error('No matching quotations to export with the current filter.');
  } else {
    targetQuotes = allDbQuotes;
  }

  // Sort quotations descending by date/creation
  targetQuotes.sort((a, b) => {
    const dateA = new Date(a.quote_date || a.created_at || 0).getTime();
    const dateB = new Date(b.quote_date || b.created_at || 0).getTime();
    return dateB - dateA;
  });

  if (targetQuotes.length === 0) {
    throw new Error('No quotations found in local storage to export.');
  }

  // 2. Build flat row-per-quotation-item export
  const rows = [];

  for (const q of targetQuotes) {
    const cust = customerMap.get(q.customer_id) || customerMap.get(String(q.customer_id)) || q.customers || {};
    const custName = cust.name || 'Customer';
    const custPlace = cust.place || '';

    // Find items for this quotation
    let quoteItems = [];
    if (q.id && itemsByQuoteId.has(String(q.id))) {
      quoteItems = itemsByQuoteId.get(String(q.id));
    } else if (q.localId && itemsByQuoteId.has(String(q.localId))) {
      quoteItems = itemsByQuoteId.get(String(q.localId));
    } else if (Array.isArray(q.items) && q.items.length > 0) {
      quoteItems = q.items;
    }

    // Deduplicate items by id/localId if matched by multiple keys
    const seenItems = new Set();
    const uniqueItems = quoteItems.filter((it) => {
      const itKey = it.id || it.localId || `${it.sl_no}-${it.description}`;
      if (seenItems.has(itKey)) return false;
      seenItems.add(itKey);
      return true;
    });

    // Sort items by sl_no
    uniqueItems.sort((a, b) => (Number(a.sl_no) || 0) - (Number(b.sl_no) || 0));

    const discountPct = Number(q.discount_percent) || 0;
    const gstRateVal = q.gst_percent !== undefined && q.gst_percent !== null ? `${Number(q.gst_percent)}%` : '0%';
    const grandTotalVal = Number(q.grand_total) || 0;

    if (uniqueItems.length > 0) {
      for (const item of uniqueItems) {
        const qtyVal = Number(item.qty) || 0;
        const rateVal = Number(item.price !== undefined ? item.price : item.rate) || 0;
        const amountVal = Number(item.total !== undefined ? item.total : item.amount) || Math.round(qtyVal * rateVal * 100) / 100;

        rows.push({
          'Quote No.': q.quote_no || '',
          'Date': q.quote_date || '',
          'Customer Name': custName,
          'Customer Place': custPlace,
          'Item Description': item.description || '',
          'Unit': item.unit || 'Nos',
          'Qty': qtyVal,
          'Rate': rateVal,
          'Amount': amountVal,
          'Discount %': discountPct,
          'GST Rate': gstRateVal,
          'Grand Total': grandTotalVal
        });
      }
    } else {
      // Empty quote row
      rows.push({
        'Quote No.': q.quote_no || '',
        'Date': q.quote_date || '',
        'Customer Name': custName,
        'Customer Place': custPlace,
        'Item Description': 'No line items',
        'Unit': '-',
        'Qty': 0,
        'Rate': 0,
        'Amount': 0,
        'Discount %': discountPct,
        'GST Rate': gstRateVal,
        'Grand Total': grandTotalVal
      });
    }
  }

  // 3. Create Excel Sheet with xlsx
  const ws = XLSX.utils.json_to_sheet(rows);

  // Set user-friendly column widths
  if (rows.length > 0) {
    const colKeys = Object.keys(rows[0]);
    ws['!cols'] = colKeys.map((key) => {
      let maxLen = key.length;
      for (let i = 0; i < Math.min(rows.length, 50); i++) {
        const valStr = String(rows[i][key] ?? '');
        if (valStr.length > maxLen) maxLen = valStr.length;
      }
      return { wch: Math.min(Math.max(maxLen + 3, 10), 45) };
    });
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Quotations');

  const fileName = `Vishakha_Quotations_${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(wb, fileName);

  return {
    success: true,
    count: rows.length,
    quoteCount: targetQuotes.length,
    fileName
  };
}
