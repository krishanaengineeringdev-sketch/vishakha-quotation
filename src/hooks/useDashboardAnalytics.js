import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/localDb';

/**
 * Format currency with Indian Rupee symbol and Indian comma separator (Lakhs/Crores)
 * e.g., 125000 -> ₹1,25,000.00
 */
export function formatRupee(amount) {
  const num = parseFloat(amount) || 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(num);
}

const DEFAULT_ANALYTICS = {
  totalQuotations: 0,
  totalQuotedValue: 0,
  thisMonthCount: 0,
  thisMonthValue: 0,
  topCustomers: [],
  currentMonthName: new Date().toLocaleString('en-IN', { month: 'long', year: 'numeric' }),
  isLoading: true
};

/**
 * Reactive hook powered by Dexie useLiveQuery.
 * Automatically recalculates analytics from local Dexie database (quotations, quotation_items, customers)
 * whenever quotations are added, edited, duplicated, or deleted offline or online.
 */
export function useDashboardAnalytics() {
  const analytics = useLiveQuery(
    async () => {
      const [quotes, customers, items] = await Promise.all([
        db.quotations.toArray(),
        db.customers.toArray(),
        db.quotation_items.toArray()
      ]);

      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth(); // 0-11

      // Fast lookup for customers
      const customerMap = new Map();
      customers.forEach((c) => {
        if (c.id) customerMap.set(c.id, c);
        if (c.localId) customerMap.set(String(c.localId), c);
      });

      // Item totals grouped by quote id or localId for fallback if grand_total is missing
      const itemTotalsByQuote = new Map();
      items.forEach((it) => {
        const itemVal =
          parseFloat(it.total !== undefined ? it.total : it.amount) ||
          (parseFloat(it.qty) || 0) * (parseFloat(it.price !== undefined ? it.price : it.rate) || 0);

        if (it.quotation_id) {
          itemTotalsByQuote.set(it.quotation_id, (itemTotalsByQuote.get(it.quotation_id) || 0) + itemVal);
        }
        if (it.quotation_local_id) {
          const key = String(it.quotation_local_id);
          itemTotalsByQuote.set(key, (itemTotalsByQuote.get(key) || 0) + itemVal);
        }
      });

      let totalQuotedValue = 0;
      let thisMonthCount = 0;
      let thisMonthValue = 0;
      const customerAgg = new Map();

      for (const q of quotes) {
        let quoteVal = parseFloat(q.grand_total);
        if (isNaN(quoteVal) || quoteVal <= 0) {
          quoteVal = itemTotalsByQuote.get(q.id) || itemTotalsByQuote.get(String(q.localId)) || 0;
        }

        totalQuotedValue += quoteVal;

        // Check if created in current calendar month
        const dateStr = q.quote_date || q.created_at;
        if (dateStr) {
          const d = new Date(dateStr);
          if (!isNaN(d.getTime())) {
            if (d.getFullYear() === currentYear && d.getMonth() === currentMonth) {
              thisMonthCount += 1;
              thisMonthValue += quoteVal;
            }
          }
        }

        // Customer aggregation
        const cust =
          customerMap.get(q.customer_id) ||
          customerMap.get(String(q.customer_id)) ||
          q.customers;
        const custName = (cust?.name || q.customer_name || 'Customer').trim();
        const custPlace = (cust?.place || q.customer_place || '').trim();
        const custKey = cust?.id ? String(cust.id) : custName.toLowerCase() || 'unknown';

        const existing = customerAgg.get(custKey);
        if (existing) {
          existing.totalAmount += quoteVal;
          existing.quoteCount += 1;
        } else {
          customerAgg.set(custKey, {
            id: custKey,
            name: custName,
            place: custPlace,
            totalAmount: quoteVal,
            quoteCount: 1
          });
        }
      }

      const topCustomers = Array.from(customerAgg.values())
        .filter((c) => c.totalAmount > 0 || c.quoteCount > 0)
        .sort((a, b) => b.totalAmount - a.totalAmount)
        .slice(0, 5);

      const currentMonthName = now.toLocaleString('en-IN', { month: 'long', year: 'numeric' });

      return {
        totalQuotations: quotes.length,
        totalQuotedValue,
        thisMonthCount,
        thisMonthValue,
        topCustomers,
        currentMonthName,
        isLoading: false
      };
    },
    [],
    DEFAULT_ANALYTICS
  );

  return analytics || DEFAULT_ANALYTICS;
}
