import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { syncPendingChanges, syncFromSupabase } from '../db/localDb';
import {
  getQuotations,
  getQuotationsLocal,
  getQuotationById,
  getCompanyProfile,
  deleteQuotation,
  getNextQuoteNo
} from '../services/dataService';
import {
  PrintableQuotationDoc,
  generateQuotationPdf,
  shareQuotationWhatsApp
} from '../components/PrintableQuotationDoc';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import BottomNav from '../components/BottomNav';
import PWAInstallBanner from '../components/PWAInstallBanner';
import DashboardStatsSection from '../components/DashboardStatsSection';
import { exportQuotationsToExcel } from '../utils/exportQuotations';
import {
  Search,
  Plus,
  Calendar,
  User,
  FileText,
  RefreshCw,
  Trash2,
  Eye,
  Download,
  Share2,
  Printer,
  Check,
  AlertCircle,
  Copy,
  FileSpreadsheet
} from 'lucide-react';

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05
    }
  }
};

const cardVariants = {
  hidden: { opacity: 0, y: 10 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.25, ease: 'easeOut' }
  }
};

export default function QuotationListPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [quotations, setQuotations] = useState([]);
  const [loading, setLoading] = useState(true);

  // Quick Action States
  const [quoteToDelete, setQuoteToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [actionLoading, setActionLoading] = useState(null); // { id, type: 'pdf' | 'share' }
  const [exportData, setExportData] = useState(null); // { quotation, profile }
  const [toast, setToast] = useState(null); // { message, type: 'success' | 'error' }
  const [isExporting, setIsExporting] = useState(false);
  const offscreenDocRef = useRef(null);

  const handleExportExcel = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      // Fetch currently filtered/searched quotations, or all if no search query
      const targetQuotes = searchQuery.trim() ? quotations : null;
      const res = await exportQuotationsToExcel(targetQuotes);
      showToast(
        `Exported ${res.quoteCount} ${res.quoteCount === 1 ? 'quotation' : 'quotations'} (${res.count} items) to Excel!`,
        'success'
      );
    } catch (err) {
      console.error('Export to Excel error:', err);
      showToast(err.message || 'Failed to export quotations to Excel', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  // Fetch quotations: Instant local-first render (0ms) + background Supabase sync
  const fetchQuotations = useCallback(async () => {
    try {
      // 1. Instant local-first render
      const local = await getQuotationsLocal(searchQuery);
      if (local && local.length > 0) {
        setQuotations(local);
        setLoading(false);
      }

      // 2. Background cloud sync if online
      if (navigator.onLine) {
        const data = await getQuotations(searchQuery);
        if (data) {
          setQuotations(data);
        }
      } else if (!local || local.length === 0) {
        setQuotations([]);
      }
    } catch (e) {
      console.warn('Error fetching quotations:', e);
    } finally {
      setLoading(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    fetchQuotations();
  }, [fetchQuotations]);

  // Re-fetch when connection restored
  useEffect(() => {
    const handleOnline = () => {
      fetchQuotations();
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [fetchQuotations]);

  // Supabase Realtime live sync listener: updates instantly without page refresh
  useEffect(() => {
    const handleRealtime = (e) => {
      if (e.detail?.table === 'quotations' || e.detail?.table === 'quotation_items') {
        fetchQuotations();
      }
    };
    window.addEventListener('vishakha_realtime_change', handleRealtime);
    return () => window.removeEventListener('vishakha_realtime_change', handleRealtime);
  }, [fetchQuotations]);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    if (navigator.onLine) {
      await syncPendingChanges();
      await syncFromSupabase();
    }
    await fetchQuotations();
    setIsRefreshing(false);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    } catch (e) {
      return dateStr;
    }
  };

  const formatCurrency = (val) => {
    const num = parseFloat(val) || 0;
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2
    }).format(num);
  };

  // 1. Download PDF directly from card
  const handleDownloadPdf = async (quote, e) => {
    e?.stopPropagation();
    const identifier = quote.id || quote.localId;
    setActionLoading({ id: identifier, type: 'pdf' });

    try {
      const [fullQuote, profile] = await Promise.all([
        getQuotationById(identifier),
        getCompanyProfile()
      ]);

      if (!fullQuote) {
        showToast('Quotation details could not be loaded', 'error');
        setActionLoading(null);
        return;
      }

      setExportData({ quotation: fullQuote, profile });
      await new Promise((resolve) => setTimeout(resolve, 80));

      if (offscreenDocRef.current) {
        const result = await generateQuotationPdf(offscreenDocRef.current);
        if (result?.pdf) {
          result.pdf.save(`Vishakha_Quotation_${fullQuote.quote_no || 'Quote'}.pdf`);
          showToast(`Downloaded PDF for ${fullQuote.quote_no}`, 'success');
        } else {
          showToast('Failed to create PDF document', 'error');
        }
      }
    } catch (err) {
      console.error('PDF export error:', err);
      showToast('Failed to generate PDF', 'error');
    } finally {
      setActionLoading(null);
      setExportData(null);
    }
  };

  // 2. Share on WhatsApp directly from card
  const handleShareWhatsApp = async (quote, e) => {
    e?.stopPropagation();
    const identifier = quote.id || quote.localId;
    setActionLoading({ id: identifier, type: 'share' });

    try {
      const [fullQuote, profile] = await Promise.all([
        getQuotationById(identifier),
        getCompanyProfile()
      ]);

      if (!fullQuote) {
        showToast('Quotation details could not be loaded', 'error');
        setActionLoading(null);
        return;
      }

      setExportData({ quotation: fullQuote, profile });
      await new Promise((resolve) => setTimeout(resolve, 80));

      const res = await shareQuotationWhatsApp({
        quotation: fullQuote,
        profile,
        targetElement: offscreenDocRef.current
      });

      if (res?.success) {
        showToast(`Sharing ${fullQuote.quote_no} on WhatsApp`, 'success');
      }
    } catch (err) {
      console.error('WhatsApp share error:', err);
      showToast('Failed to share quotation', 'error');
    } finally {
      setActionLoading(null);
      setExportData(null);
    }
  };

  // 3. Duplicate / Repeat Quotation from card
  const handleDuplicateQuote = async (quote, e) => {
    e?.stopPropagation();
    const identifier = quote.id || quote.localId;
    try {
      const fullQuote = await getQuotationById(identifier);
      if (!fullQuote) {
        showToast('Could not load quotation details for duplication', 'error');
        return;
      }

      const nextNo = await getNextQuoteNo();
      const duplicatePayload = {
        originalQuoteNo: fullQuote.quote_no,
        quote_no: nextNo,
        quote_date: new Date().toISOString().split('T')[0],
        customerName: fullQuote.customers?.name || '',
        customerPlace: fullQuote.customers?.place || '',
        greeting: fullQuote.greeting || '',
        closing: fullQuote.closing || '',
        discount_percent: fullQuote.discount_percent || 0,
        gst_percent: fullQuote.gst_percent || 0,
        items: (fullQuote.items || []).map((it) => ({
          material_id: it.material_id || null,
          description: it.description || '',
          unit: it.unit || 'Nos',
          qty: it.qty || 1,
          price: it.price !== undefined ? it.price : it.rate || 0,
          rate: it.price !== undefined ? it.price : it.rate || 0,
          total: it.total !== undefined ? it.total : it.amount || 0
        }))
      };

      navigate('/quotation/new', { state: { duplicateFrom: duplicatePayload } });
    } catch (err) {
      console.error('Duplicate error:', err);
      showToast('Failed to duplicate quotation', 'error');
    }
  };

  // 4. Print directly from card (navigate to Preview with autoPrint trigger)
  const handlePrint = (quote, e) => {
    e?.stopPropagation();
    navigate(`/quotation/${quote.id || quote.localId}?autoPrint=true`);
  };

  // 4. Delete quotation with confirmation
  const handleDeleteClick = (quote, e) => {
    e?.stopPropagation();
    setQuoteToDelete(quote);
  };

  const confirmDelete = async () => {
    if (!quoteToDelete) return;
    setIsDeleting(true);
    try {
      const res = await deleteQuotation(quoteToDelete.id || quoteToDelete.localId);
      if (res?.success) {
        showToast(`Deleted ${quoteToDelete.quote_no}`, 'success');
        setQuoteToDelete(null);
        await fetchQuotations();
      } else {
        showToast(res?.error || 'Failed to delete quotation', 'error');
      }
    } catch (err) {
      console.error('Delete quotation error:', err);
      showToast('Failed to delete quotation', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="min-h-screen bg-white dark:bg-[#0B1220] flex flex-col pb-24 lg:pb-12 lg:pl-64 transition-colors"
    >
      <Sidebar />
      <Header />
      <PWAInstallBanner />

      {/* Floating Toast Notification */}
      {toast && (
        <div
          className={`fixed top-16 left-1/2 -translate-x-1/2 z-50 text-[13px] font-medium px-4 py-2.5 rounded-full shadow-xl border flex items-center gap-2 animate-fade-in transition-all ${
            toast.type === 'error'
              ? 'bg-rose-900/95 dark:bg-rose-950/95 border-rose-700/80 text-rose-100'
              : 'bg-[#0B1B3F]/95 dark:bg-[#1A2332]/95 border-slate-700/80 text-white'
          }`}
        >
          {toast.type === 'error' ? (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          ) : (
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Hidden offscreen document for direct PDF / WhatsApp generation from list */}
      {exportData &&
        typeof document !== 'undefined' &&
        createPortal(
          <PrintableQuotationDoc
            ref={offscreenDocRef}
            quotation={exportData.quotation}
            profile={exportData.profile}
            isOffscreen={true}
          />,
          document.body
        )}

      <main className="flex-1 w-full max-w-[520px] lg:max-w-5xl xl:max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-3 sm:pt-6 pb-8">
        {/* Reactive Dashboard Stats Section (above search bar) */}
        <div className="mb-4 sm:mb-5">
          <DashboardStatsSection showTopCustomers={false} />
        </div>

        {/* Title, Search & Desktop Actions Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-[20px] sm:text-[24px] font-bold text-[#0B1B3F] dark:text-white tracking-tight">
              Quotations
            </h2>
            <p className="text-[12px] sm:text-[13px] text-[#6B7280] dark:text-gray-400">
              {quotations.length} {quotations.length === 1 ? 'quote' : 'quotes'} listed
            </p>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            {/* Search Bar: constrained to max-w-md on desktop */}
            <div className="relative flex-1 sm:w-72 lg:w-80">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#6B7280] dark:text-gray-400">
                <Search className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search quote or customer..."
                className="w-full pl-10 pr-9 py-2 bg-[#F3F5F9] dark:bg-[#1A2332] border border-transparent dark:border-gray-700/60 focus:border-slate-200 dark:focus:border-gray-600 focus:bg-white dark:focus:bg-[#1A2332] rounded-[10px] text-[14px] text-[#0B1B3F] dark:text-white placeholder-[#6B7280] dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#2F6FED] transition-all min-touch"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#6B7280] dark:text-gray-400 hover:text-[#0B1B3F] dark:hover:text-white active:scale-95 transition-transform min-touch cursor-pointer"
                  aria-label="Clear search"
                >
                  ✕
                </button>
              )}
            </div>

            <button
              onClick={handleRefresh}
              className="w-10 h-10 flex items-center justify-center rounded-[10px] text-[#6B7280] dark:text-gray-400 hover:bg-[#F3F5F9] dark:hover:bg-[#1A2332] hover:text-[#0B1B3F] dark:hover:text-white hover:scale-[1.02] active:scale-95 transition-all duration-150 min-touch shrink-0 cursor-pointer"
              aria-label="Refresh"
              title="Refresh list"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-[#2F6FED]' : ''}`} />
            </button>

            {/* Export to Excel/CSV Button */}
            <button
              type="button"
              onClick={handleExportExcel}
              disabled={isExporting || quotations.length === 0}
              className="inline-flex items-center gap-1.5 h-10 px-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-95 text-white text-[13px] font-semibold rounded-[10px] shadow-xs transition-all duration-150 shrink-0 cursor-pointer"
              title={searchQuery.trim() ? 'Export filtered quotations to Excel (.xlsx)' : 'Export all quotations to Excel (.xlsx)'}
              aria-label="Export to Excel"
            >
              {isExporting ? (
                <RefreshCw className="w-4 h-4 animate-spin text-white" />
              ) : (
                <FileSpreadsheet className="w-4 h-4" />
              )}
              <span>{isExporting ? 'Preparing export...' : 'Export'}</span>
            </button>

            {/* Desktop + New Quote Button */}
            <button
              onClick={() => navigate('/quotation/new')}
              className="hidden sm:inline-flex items-center gap-1.5 h-10 px-4 bg-[#2F6FED] hover:bg-blue-600 hover:scale-[1.02] active:scale-95 hover:shadow-md text-white text-[13px] font-semibold rounded-[10px] shadow-xs transition-all duration-150 shrink-0 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>New Quotation</span>
            </button>
          </div>
        </div>

        {/* Quotation List Skeleton Cards (responsive grid) */}
        {loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3.5 pt-1">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <div
                key={n}
                className="bg-[#F3F5F9] dark:bg-[#1A2332] border border-slate-200/70 dark:border-gray-800 rounded-[14px] p-4 flex flex-col justify-between shadow-xs"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        {/* Quote Number line */}
                        <div className="h-5 w-28 skeleton rounded-[6px]" />
                        {/* Date badge */}
                        <div className="h-4 w-20 skeleton rounded-full" />
                      </div>
                      {/* Customer Name */}
                      <div className="h-4 w-40 skeleton rounded-[6px] mt-1" />
                      {/* Customer Place & item count */}
                      <div className="h-3 w-28 skeleton rounded-[4px]" />
                    </div>
                    {/* Amount badge on right */}
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <div className="h-5 w-24 skeleton rounded-[6px]" />
                      <div className="h-2.5 w-14 skeleton rounded-[4px]" />
                    </div>
                  </div>
                </div>

                {/* Action Icons Row */}
                <div className="mt-4 pt-3 border-t border-slate-200/80 dark:border-gray-700/60 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <div className="w-9 h-9 skeleton rounded-[8px]" />
                    <div className="w-9 h-9 skeleton rounded-[8px]" />
                    <div className="w-9 h-9 skeleton rounded-[8px]" />
                    <div className="w-9 h-9 skeleton rounded-[8px]" />
                  </div>
                  <div className="w-9 h-9 skeleton rounded-[8px]" />
                </div>
              </div>
            ))}
          </div>
        ) : quotations.length === 0 ? (
          <div className="bg-[#F3F5F9] dark:bg-[#1A2332] rounded-[14px] p-10 text-center mt-6 border border-transparent dark:border-gray-800 max-w-md mx-auto">
            <div className="w-12 h-12 bg-white dark:bg-[#0B1220] rounded-full flex items-center justify-center mx-auto mb-3 text-[#2F6FED] shadow-xs">
              <FileText className="w-6 h-6" />
            </div>
            <h3 className="text-[16px] font-bold text-[#0B1B3F] dark:text-white">
              {searchQuery ? 'No quotations match search' : 'No quotations yet'}
            </h3>
            <p className="text-[13px] text-[#6B7280] dark:text-gray-400 mt-1 max-w-[280px] mx-auto">
              {searchQuery
                ? 'Try a different customer name or quotation number.'
                : 'Add your first quotation for Vishakha Industries.'}
            </p>
            {!searchQuery && (
              <button
                onClick={() => navigate('/quotation/new')}
                className="mt-4 inline-flex items-center gap-2 bg-[#2F6FED] text-white px-4 py-2.5 rounded-[10px] text-[14px] font-semibold hover:bg-blue-600 hover:scale-[1.02] active:scale-95 hover:shadow-md transition-all duration-150 min-touch cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add Your First Quotation</span>
              </button>
            )}
          </div>
        ) : (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3.5"
          >
            {quotations.map((quote) => {
              const customerName = quote.customers?.name || 'Customer';
              const customerPlace = quote.customers?.place;
              const identifier = quote.id || quote.localId;
              const isPdfLoading =
                actionLoading?.id === identifier && actionLoading?.type === 'pdf';
              const isShareLoading =
                actionLoading?.id === identifier && actionLoading?.type === 'share';

              return (
                <motion.div
                  key={identifier}
                  variants={cardVariants}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => navigate(`/quotation/${identifier}`)}
                  className="group bg-[#F3F5F9] dark:bg-[#1A2332] hover:bg-slate-100/90 dark:hover:bg-[#202C3F] border border-slate-200/70 dark:border-gray-800 hover:border-slate-300 dark:hover:border-gray-700 hover:shadow-md hover:-translate-y-0.5 rounded-[14px] p-4 flex flex-col justify-between cursor-pointer transition-all duration-200 shadow-xs"
                >
                  {/* Top: Quote Info & Price */}
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[15px] font-bold text-[#0B1B3F] dark:text-white group-hover:text-[#2F6FED] transition-colors">
                            {quote.quote_no}
                          </span>
                          <span className="text-[11px] text-[#6B7280] dark:text-gray-400 flex items-center gap-1 font-medium bg-white dark:bg-[#0B1220] px-2 py-0.5 rounded-full border border-slate-200/60 dark:border-gray-700">
                            <Calendar className="w-3 h-3 text-[#6B7280] dark:text-gray-400" />
                            {formatDate(quote.quote_date)}
                          </span>
                          {quote.synced === false && (
                            <span
                              title="Created or edited offline. Will automatically sync to cloud when connected."
                              className="text-[10px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-300 dark:border-amber-800/80 px-2 py-0.5 rounded-full inline-flex items-center gap-1.5 shrink-0"
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                              Offline — pending sync
                            </span>
                          )}
                        </div>

                        <div className="mt-1 flex items-center gap-1.5 text-[13px] text-[#0B1B3F] dark:text-white font-medium truncate">
                          <User className="w-3.5 h-3.5 text-[#6B7280] dark:text-gray-400 shrink-0" />
                          <span className="truncate">{customerName}</span>
                          {customerPlace && (
                            <span className="text-[12px] text-[#6B7280] dark:text-gray-400 font-normal truncate">
                              • {customerPlace}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="text-right shrink-0 flex flex-col items-end">
                        <span className="text-[16px] font-extrabold text-[#0B1B3F] dark:text-white tracking-tight">
                          {formatCurrency(quote.grand_total)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Bottom: Quick Actions Row ([👁 View] [⬇ PDF] [📤 Share] [📋 Duplicate] [🖨 Print] [🗑 Delete]) */}
                  <div className="mt-3.5 pt-2.5 border-t border-slate-200/80 dark:border-gray-700/60 flex items-center justify-between gap-2 overflow-hidden">
                    <span className="text-[11px] text-[#6B7280] dark:text-gray-400 font-semibold tracking-wide uppercase shrink-0">
                      Actions
                    </span>

                    <div className="quotation-actions-row overflow-x-auto py-0.5">
                      {/* 1. View Button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/quotation/${identifier}`);
                        }}
                        title="View Quotation Preview"
                        aria-label="View Quotation"
                        className="action-icon-btn bg-white dark:bg-[#0B1220] border border-slate-200/80 dark:border-gray-700/80 text-[#6B7280] dark:text-gray-300 hover:text-[#2F6FED] dark:hover:text-blue-400 hover:border-[#2F6FED] dark:hover:border-blue-400 hover:scale-105 active:scale-95 transition-all cursor-pointer shadow-2xs"
                      >
                        <Eye className="w-4 h-4" />
                      </button>

                      {/* 2. Download PDF Button */}
                      <button
                        type="button"
                        disabled={isPdfLoading}
                        onClick={(e) => handleDownloadPdf(quote, e)}
                        title="Download PDF"
                        aria-label="Download PDF"
                        className="action-icon-btn bg-white dark:bg-[#0B1220] border border-slate-200/80 dark:border-gray-700/80 text-[#6B7280] dark:text-gray-300 hover:text-[#2F6FED] dark:hover:text-blue-400 hover:border-[#2F6FED] dark:hover:border-blue-400 hover:scale-105 active:scale-95 transition-all cursor-pointer shadow-2xs disabled:opacity-60"
                      >
                        {isPdfLoading ? (
                          <div className="w-3.5 h-3.5 border-2 border-[#2F6FED]/40 border-t-[#2F6FED] rounded-full animate-spin" />
                        ) : (
                          <Download className="w-4 h-4" />
                        )}
                      </button>

                      {/* 3. Share WhatsApp Button */}
                      <button
                        type="button"
                        disabled={isShareLoading}
                        onClick={(e) => handleShareWhatsApp(quote, e)}
                        title="Share on WhatsApp"
                        aria-label="Share on WhatsApp"
                        className="action-icon-btn bg-white dark:bg-[#0B1220] border border-slate-200/80 dark:border-gray-700/80 text-[#6B7280] dark:text-gray-300 hover:text-emerald-600 dark:hover:text-emerald-400 hover:border-emerald-500 dark:hover:border-emerald-500 hover:scale-105 active:scale-95 transition-all cursor-pointer shadow-2xs disabled:opacity-60"
                      >
                        {isShareLoading ? (
                          <div className="w-3.5 h-3.5 border-2 border-emerald-600/40 border-t-emerald-600 rounded-full animate-spin" />
                        ) : (
                          <Share2 className="w-4 h-4" />
                        )}
                      </button>

                      {/* 4. Duplicate Quotation Button */}
                      <button
                        type="button"
                        onClick={(e) => handleDuplicateQuote(quote, e)}
                        title="Duplicate Quotation (Review before saving)"
                        aria-label="Duplicate Quotation"
                        className="action-icon-btn bg-white dark:bg-[#0B1220] border border-slate-200/80 dark:border-gray-700/80 text-[#6B7280] dark:text-gray-300 hover:text-[#2F6FED] dark:hover:text-blue-400 hover:border-[#2F6FED] dark:hover:border-blue-400 hover:scale-105 active:scale-95 transition-all cursor-pointer shadow-2xs"
                      >
                        <Copy className="w-4 h-4" />
                      </button>

                      {/* 5. Print Button */}
                      <button
                        type="button"
                        onClick={(e) => handlePrint(quote, e)}
                        title="Print Document"
                        aria-label="Print Document"
                        className="action-icon-btn bg-white dark:bg-[#0B1220] border border-slate-200/80 dark:border-gray-700/80 text-[#6B7280] dark:text-gray-300 hover:text-[#2F6FED] dark:hover:text-blue-400 hover:border-[#2F6FED] dark:hover:border-blue-400 hover:scale-105 active:scale-95 transition-all cursor-pointer shadow-2xs"
                      >
                        <Printer className="w-4 h-4" />
                      </button>

                      {/* 6. Delete Button */}
                      <button
                        type="button"
                        onClick={(e) => handleDeleteClick(quote, e)}
                        title="Delete Quotation"
                        aria-label="Delete Quotation"
                        className="action-icon-btn bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200/80 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/40 hover:scale-105 active:scale-95 transition-all cursor-pointer shadow-2xs"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </main>

      {/* Floating '+' button (56px circle) -> New Quotation (Mobile Only) */}
      <motion.button
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: [0.8, 1.1, 1], opacity: 1 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        whileTap={{ scale: 0.95 }}
        onClick={() => navigate('/quotation/new')}
        aria-label="New Quotation"
        title="Create New Quotation"
        className="lg:hidden fixed right-5 bottom-20 z-40 w-[56px] h-[56px] rounded-full bg-[#2F6FED] hover:bg-blue-600 text-white shadow-lg flex items-center justify-center transition-colors duration-150 print:hidden cursor-pointer"
      >
        <Plus className="w-7 h-7 stroke-[2.5]" />
      </motion.button>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {quoteToDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 dark:bg-black/75 backdrop-blur-xs"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="bg-white dark:bg-[#1A2332] border border-transparent dark:border-gray-700 rounded-[14px] p-5 max-w-sm w-full shadow-2xl"
            >
              <h3 className="text-[17px] font-bold text-[#0B1B3F] dark:text-white">
                Delete Quotation?
              </h3>
              <p className="text-[13px] text-[#6B7280] dark:text-gray-400 mt-2 leading-relaxed">
                Delete <span className="font-bold text-[#0B1B3F] dark:text-white">{quoteToDelete.quote_no}</span>? This cannot be undone.
              </p>
              <div className="mt-5 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setQuoteToDelete(null)}
                  className="px-4 py-2 text-[13px] font-medium text-[#6B7280] dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-gray-800 rounded-[10px] active:scale-95 transition-all min-touch"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmDelete}
                  disabled={isDeleting}
                  className="px-4 py-2 text-[13px] font-semibold bg-rose-600 hover:bg-rose-700 hover:scale-[1.02] active:scale-95 text-white rounded-[10px] min-touch flex items-center gap-1 transition-all duration-150 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <BottomNav />
    </motion.div>
  );
}
