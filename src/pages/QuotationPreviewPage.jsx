import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  getQuotationById,
  getCompanyProfile,
  deleteQuotation,
  getNextQuoteNo,
  saveQuotation
} from '../services/dataService';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import {
  Download,
  Share2,
  Edit,
  Copy,
  Printer,
  Trash2,
  Check,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { COMPANY_CONFIG } from '../config/companyConfig';
import { formatIndianCurrency, numberToWordsIndian } from '../utils/numberToWords';
import {
  PrintableQuotationDoc,
  generateQuotationPdf,
  urlToBase64,
  buildWhatsAppSummaryText,
  fallbackDownloadAndWhatsApp
} from '../components/PrintableQuotationDoc';

export default function QuotationPreviewPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const paperRef = useRef(null);
  const offscreenRef = useRef(null);

  const [quotation, setQuotation] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // Cached base64 images for capture
  const [base64Logo, setBase64Logo] = useState('');
  const [base64Signature, setBase64Signature] = useState('');

  // Cached PDF Blob & state for instant gesture-compliant sharing
  const [cachedPdfResult, setCachedPdfResult] = useState(null); // { pdf, blob }
  const [isPreparingPdf, setIsPreparingPdf] = useState(false);
  const isGeneratingRef = useRef(false);

  const [feedbackMsg, setFeedbackMsg] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Load quotation & profile
  useEffect(() => {
    let isMounted = true;
    async function load() {
      try {
        const [q, p] = await Promise.all([
          getQuotationById(id),
          getCompanyProfile()
        ]);
        if (isMounted) {
          setQuotation(q);
          setProfile(p);
        }
      } catch (err) {
        console.error('Error loading quotation for preview:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    load();

    const handleFocus = async () => {
      try {
        const p = await getCompanyProfile();
        if (isMounted && p) {
          setProfile((prev) => ({ ...prev, ...p }));
        }
      } catch (e) {}
    };

    window.addEventListener('focus', handleFocus);
    window.addEventListener('visibilitychange', handleFocus);

    return () => {
      isMounted = false;
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('visibilitychange', handleFocus);
    };
  }, [id]);

  // Convert logo and signature to Base64 once to eliminate CORS taint & load race
  useEffect(() => {
    let active = true;
    async function convertImages() {
      try {
        const logoSrc = profile?.logo_url || COMPANY_CONFIG.logoUrl;
        const sigSrc = profile?.signature_url || '';
        const [b64Logo, b64Sig] = await Promise.all([
          urlToBase64(logoSrc),
          sigSrc ? urlToBase64(sigSrc) : Promise.resolve('')
        ]);
        if (active) {
          setBase64Logo(b64Logo);
          setBase64Signature(b64Sig);
        }
      } catch (e) {
        console.warn('Image base64 conversion warning:', e);
      }
    }
    if (profile) {
      convertImages();
    }
    return () => {
      active = false;
    };
  }, [profile]);

  // Pre-generate PDF Blob in advance and cache it
  const prepareAndCachePdf = useCallback(async () => {
    if (!quotation || !profile || !offscreenRef.current || isGeneratingRef.current) {
      return;
    }
    isGeneratingRef.current = true;
    setIsPreparingPdf(true);
    try {
      const result = await generateQuotationPdf(offscreenRef.current);
      if (result) {
        setCachedPdfResult(result);
      }
    } catch (err) {
      console.error('Failed to pre-generate PDF:', err);
    } finally {
      setIsPreparingPdf(false);
      isGeneratingRef.current = false;
    }
  }, [quotation, profile]);

  // Invalidate and re-generate whenever quotation, profile, or assets change
  useEffect(() => {
    if (quotation && profile) {
      const timer = setTimeout(() => {
        prepareAndCachePdf();
      }, 120);
      return () => clearTimeout(timer);
    }
  }, [quotation, profile, base64Logo, base64Signature, prepareAndCachePdf]);

  // Auto-print if opened with ?autoPrint=true
  useEffect(() => {
    if (searchParams.get('autoPrint') === 'true' && quotation && profile && !loading) {
      const timer = setTimeout(() => {
        window.print();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [searchParams, quotation, profile, loading]);

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

  // Instant Download PDF from pre-generated cache
  const handleDownloadPdf = () => {
    if (isPreparingPdf) return;

    if (cachedPdfResult?.pdf) {
      cachedPdfResult.pdf.save(`Vishakha_Quotation_${quotation?.quote_no || 'Quote'}.pdf`);
      setFeedbackMsg('PDF downloaded successfully');
      setTimeout(() => setFeedbackMsg(''), 3000);
    } else {
      setIsPreparingPdf(true);
      prepareAndCachePdf().then(() => {
        if (cachedPdfResult?.pdf) {
          cachedPdfResult.pdf.save(`Vishakha_Quotation_${quotation?.quote_no || 'Quote'}.pdf`);
        }
      });
    }
  };

  // Immediate Web Share with ZERO await before navigator.share
  const handleShareWhatsApp = () => {
    if (isPreparingPdf || !cachedPdfResult?.blob) {
      setFeedbackMsg('Please wait, preparing PDF...');
      setTimeout(() => setFeedbackMsg(''), 2500);
      return;
    }

    const quoteNo = quotation?.quote_no || 'Quote';
    const companyName = profile?.name || COMPANY_CONFIG.name;
    const summaryText = buildWhatsAppSummaryText(quotation, profile);
    const file = new File(
      [cachedPdfResult.blob],
      `Vishakha_Quotation_${quoteNo}.pdf`,
      { type: 'application/pdf' }
    );

    // Call navigator.share IMMEDIATELY within the active user gesture tick
    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      navigator.share({
        title: `Quotation ${quoteNo} - ${companyName}`,
        text: summaryText,
        files: [file]
      }).then(() => {
        setFeedbackMsg('Quotation shared successfully');
        setTimeout(() => setFeedbackMsg(''), 3000);
      }).catch((shareErr) => {
        if (shareErr.name === 'AbortError') {
          return;
        }
        console.warn('Web Share failed, using download + WhatsApp fallback:', shareErr);
        fallbackDownloadAndWhatsApp(summaryText, cachedPdfResult, quoteNo);
        setFeedbackMsg('PDF downloaded & WhatsApp opened');
        setTimeout(() => setFeedbackMsg(''), 3500);
      });
      return;
    }

    // Fallback if canShare fails (desktop browsers, or unsupported file sharing)
    fallbackDownloadAndWhatsApp(summaryText, cachedPdfResult, quoteNo);
    setFeedbackMsg('PDF downloaded & WhatsApp opened');
    setTimeout(() => setFeedbackMsg(''), 3500);
  };

  // Duplicate Action: Pre-fill New Quotation form (don't auto-save, let user review first)
  const handleDuplicate = async () => {
    try {
      const nextNo = await getNextQuoteNo();
      const duplicatePayload = {
        originalQuoteNo: quotation.quote_no,
        quote_no: nextNo,
        quote_date: new Date().toISOString().split('T')[0],
        customerName: quotation.customers?.name || '',
        customerPlace: quotation.customers?.place || '',
        greeting: quotation.greeting || '',
        closing: quotation.closing || '',
        discount_percent: quotation.discount_percent || 0,
        gst_percent: quotation.gst_percent || 0,
        items: (quotation.items || []).map((it) => ({
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
      alert('Failed to duplicate quotation.');
    }
  };

  const handleDelete = async () => {
    try {
      await deleteQuotation(quotation.id);
      navigate('/');
    } catch (err) {
      console.error('Delete error:', err);
      alert('Failed to delete quotation.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F3F5F9] dark:bg-[#0B1220] flex flex-col pb-20 lg:pl-64 transition-colors">
        <Sidebar />
        <Header title="Quotation Preview" showBack={true} onBack={() => navigate('/')} />

        {/* Toolbar Skeleton */}
        <div className="bg-white dark:bg-[#1A2332] border-b border-slate-200 dark:border-gray-800 px-4 py-3 sticky top-[57px] z-30 shadow-xs">
          <div className="max-w-2xl xl:max-w-3xl mx-auto flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1 max-w-sm">
              <div className="h-11 flex-1 skeleton rounded-[10px]" />
              <div className="h-11 flex-1 skeleton rounded-[10px]" />
            </div>
            <div className="flex items-center gap-2">
              <div className="h-11 w-11 skeleton rounded-[10px]" />
              <div className="h-11 w-11 skeleton rounded-[10px]" />
              <div className="h-11 w-11 skeleton rounded-[10px]" />
            </div>
          </div>
        </div>

        {/* Paper Skeleton */}
        <main className="flex-1 max-w-2xl xl:max-w-3xl w-full mx-auto p-4 sm:p-6 my-4 bg-white dark:bg-[#1A2332] rounded-[16px] shadow-sm border border-slate-200/80 dark:border-gray-800 space-y-6">
          <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-100 dark:border-gray-800">
            <div className="w-16 h-16 skeleton rounded-[10px]" />
            <div className="space-y-2 text-right">
              <div className="h-6 w-48 skeleton rounded-[6px] ml-auto" />
              <div className="h-3.5 w-60 skeleton rounded-[4px] ml-auto" />
              <div className="h-3 w-40 skeleton rounded-[4px] ml-auto" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 p-4 rounded-[12px] bg-slate-50 dark:bg-[#0B1220]/60">
            <div className="space-y-2">
              <div className="h-3 w-20 skeleton rounded-[4px]" />
              <div className="h-4 w-36 skeleton rounded-[5px]" />
              <div className="h-3 w-28 skeleton rounded-[4px]" />
            </div>
            <div className="space-y-2 text-right">
              <div className="h-3 w-20 skeleton rounded-[4px] ml-auto" />
              <div className="h-4 w-32 skeleton rounded-[5px] ml-auto" />
              <div className="h-3 w-24 skeleton rounded-[4px] ml-auto" />
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <div className="h-8 w-full skeleton rounded-[8px]" />
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-10 w-full skeleton rounded-[6px]" />
            ))}
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-100 dark:border-gray-800">
            <div className="w-56 space-y-2">
              <div className="h-4 w-full skeleton rounded-[4px]" />
              <div className="h-4 w-full skeleton rounded-[4px]" />
              <div className="h-6 w-full skeleton rounded-[6px]" />
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!quotation) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center">
        <AlertCircle className="w-12 h-12 text-rose-500 mb-3" />
        <h2 className="text-[18px] font-bold text-[#0B1B3F]">Quotation Not Found</h2>
        <button
          onClick={() => navigate('/')}
          className="mt-4 px-4 py-2 bg-[#2F6FED] text-white rounded-[10px] text-[14px] font-semibold"
        >
          Return to List
        </button>
      </div>
    );
  }

  const companyName = profile?.name || COMPANY_CONFIG.name;
  const ownerName = profile?.owner_name || COMPANY_CONFIG.ownerName;
  const address = profile?.address || COMPANY_CONFIG.address;
  const phone = profile?.phone || COMPANY_CONFIG.phone;
  const email = profile?.email || COMPANY_CONFIG.email;
  const logoUrl = base64Logo || profile?.logo_url || COMPANY_CONFIG.logoUrl;
  const signatureUrl = base64Signature || profile?.signature_url || '';

  const itemsCount = quotation?.items?.length || 0;
  const emptyRowsCount = itemsCount <= 4 ? 5 - itemsCount : 0;
  const itemRowPadding = itemsCount <= 2 ? 'py-3 sm:py-3.5' : (itemsCount <= 4 ? 'py-2.5 sm:py-3' : 'py-2 sm:py-2.5');

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="min-h-screen bg-[#F3F5F9] print:bg-white text-[#0B1B3F] flex flex-col pb-20 print:pb-0 lg:pl-64 print:pl-0 transition-colors"
    >
      <Sidebar />
      {/* Top Header / App Bar (Hidden on print) */}
      <Header
        title={quotation.quote_no}
        showBack={true}
        onBack={() => navigate('/')}
      />

      {/* Full-screen Loading Overlay for document preparation */}
      {isPreparingPdf && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 dark:bg-black/75 backdrop-blur-xs flex flex-col items-center justify-center p-4">
          <div className="bg-white dark:bg-[#1A2332] rounded-[16px] p-6 shadow-2xl flex flex-col items-center gap-3 max-w-xs text-center border border-slate-100 dark:border-gray-800">
            <div className="w-10 h-10 border-3 border-[#2F6FED] border-t-transparent rounded-full animate-spin" />
            <div className="text-[15px] font-bold text-[#0B1B3F] dark:text-white">
              Preparing your document...
            </div>
            <p className="text-[12px] text-[#6B7280] dark:text-gray-400">
              Generating high-resolution print PDF. Please wait a moment.
            </p>
          </div>
        </div>
      )}

      {/* Feedback Toast */}
      {feedbackMsg && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-[#0B1B3F] text-white text-[13px] font-medium px-4 py-2 rounded-full shadow-lg flex items-center gap-2 print:hidden animate-fade-in">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{feedbackMsg}</span>
        </div>
      )}

      {/* Action Buttons Toolbar (Sticky under header, print:hidden) */}
      <div className="bg-white border-b border-slate-200 px-4 py-3 sticky top-[57px] z-30 print:hidden shadow-xs">
        <div className="max-w-2xl xl:max-w-3xl mx-auto flex flex-wrap items-center justify-between gap-2.5">
          {/* Primary Actions: Download PDF & WhatsApp */}
          <div className="flex items-center gap-2 flex-1 min-w-[240px]">
            <button
              onClick={handleDownloadPdf}
              disabled={isPreparingPdf || !cachedPdfResult}
              className="flex-1 h-11 bg-[#2F6FED] hover:bg-blue-600 disabled:opacity-60 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-95 text-white text-[13px] font-semibold rounded-[10px] flex items-center justify-center gap-1.5 shadow-xs transition-all duration-150 min-touch cursor-pointer"
            >
              {isPreparingPdf ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  <span>Generating PDF...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Download PDF</span>
                </>
              )}
            </button>

            <button
              onClick={handleShareWhatsApp}
              disabled={isPreparingPdf || !cachedPdfResult}
              className="flex-1 h-11 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-95 text-white text-[13px] font-semibold rounded-[10px] flex items-center justify-center gap-1.5 shadow-xs transition-all duration-150 min-touch cursor-pointer"
            >
              {isPreparingPdf ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  <span>Preparing...</span>
                </>
              ) : (
                <>
                  <Share2 className="w-4 h-4" />
                  <span>WhatsApp</span>
                </>
              )}
            </button>
          </div>

          {/* Secondary Actions: Edit, Duplicate, Print, Delete */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => navigate(`/quotation/${quotation.id}/edit`)}
              title="Edit Quotation"
              className="h-11 px-3 bg-[#F3F5F9] hover:bg-slate-200 hover:scale-105 active:scale-95 text-[#0B1B3F] text-[13px] font-medium rounded-[10px] flex items-center gap-1.5 transition-all duration-150 min-touch cursor-pointer"
            >
              <Edit className="w-4 h-4" />
              <span className="hidden sm:inline">Edit</span>
            </button>

            <button
              onClick={handleDuplicate}
              title="Duplicate Quotation"
              className="h-11 px-3 bg-[#F3F5F9] hover:bg-slate-200 hover:scale-105 active:scale-95 text-[#0B1B3F] text-[13px] font-medium rounded-[10px] flex items-center gap-1.5 transition-all duration-150 min-touch cursor-pointer"
            >
              <Copy className="w-4 h-4" />
              <span className="hidden sm:inline">Duplicate</span>
            </button>

            <button
              onClick={() => window.print()}
              title="Print Document"
              className="h-11 px-3 bg-[#F3F5F9] hover:bg-slate-200 hover:scale-105 active:scale-95 text-[#0B1B3F] text-[13px] font-medium rounded-[10px] flex items-center gap-1.5 transition-all duration-150 min-touch cursor-pointer"
            >
              <Printer className="w-4 h-4" />
            </button>

            <button
              onClick={() => setShowDeleteModal(true)}
              title="Delete Quotation"
              className="h-11 px-3 bg-rose-50 hover:bg-rose-100 hover:scale-105 active:scale-95 text-rose-600 rounded-[10px] flex items-center justify-center transition-all duration-150 min-touch cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Document Area: Responsive on-screen preview */}
      <main className="flex-1 w-full max-w-2xl xl:max-w-3xl mx-auto p-2 sm:p-6 lg:p-8 print:p-0">
        <div className="w-full overflow-x-hidden print:overflow-visible">
          {/* On-screen A4 Document Card */}
          <div
            id="printable-quotation"
            ref={paperRef}
            className="document-card document-page a4-paper bg-white shadow-md hover:shadow-lg transition-shadow print:shadow-none border border-slate-200/80 print:border-none rounded-[12px] print:rounded-none p-5 sm:p-10 text-[#0B1B3F] flex flex-col overflow-x-hidden box-border mx-auto"
            style={{ minHeight: '297mm' }}
          >
            {/* HEADER SECTION */}
            <div className="header-row border-b-2 border-[#2F6FED] pb-4 sm:pb-5 shrink-0">
              <div className="flex items-start gap-2.5 sm:gap-4 flex-1 min-w-0">
                <div className="flex flex-col items-center shrink-0 w-[56px] sm:w-[102px]">
                  <div className="w-[56px] h-[56px] sm:w-[102px] sm:h-[102px] print:w-[102px] print:h-[102px] flex items-center justify-center bg-white p-1">
                    <img
                      src={logoUrl}
                      alt={`${companyName} Logo`}
                      crossOrigin="anonymous"
                      width="102"
                      height="102"
                      className="max-w-full max-h-full object-contain"
                      style={{ objectFit: 'contain' }}
                    />
                  </div>
                  <span className="text-[10px] sm:text-[13px] print:text-[13px] font-extrabold tracking-wider text-[#0B1B3F] mt-0.5 sm:mt-1 uppercase text-center">
                    {COMPANY_CONFIG.shortName}
                  </span>
                </div>

                <div
                  className="header-text-col pt-0.5 sm:pt-1 min-w-0"
                  style={{
                    flex: '1 1 0%',
                    minWidth: 0,
                    wordBreak: 'break-word',
                    overflowWrap: 'anywhere'
                  }}
                >
                  <h1
                    className="text-[15px] sm:text-[20px] print:text-[20px] font-extrabold text-[#0B1B3F] leading-tight"
                    style={{
                      wordBreak: 'break-word',
                      overflowWrap: 'anywhere',
                      margin: 0
                    }}
                  >
                    {companyName}
                  </h1>
                  {ownerName && (
                    <p className="text-[11px] sm:text-[13px] print:text-[13px] font-medium text-[#2F6FED] mt-0.5">
                      Proprietor: {ownerName}
                    </p>
                  )}
                  <p
                    className="text-[10px] sm:text-[12px] print:text-[12px] text-[#6B7280] leading-snug mt-0.5 sm:mt-1"
                    style={{
                      wordBreak: 'break-word',
                      overflowWrap: 'anywhere',
                      minWidth: 0
                    }}
                  >
                    {address}
                  </p>
                  <div
                    className="mt-0.5 sm:mt-1 text-[10px] sm:text-[12px] print:text-[12px] text-[#0B1B3F] space-y-0.5 font-medium"
                    style={{
                      wordBreak: 'break-word',
                      overflowWrap: 'anywhere',
                      minWidth: 0
                    }}
                  >
                    {phone && <p style={{ margin: '1px 0' }}>Ph: {phone}</p>}
                    {email && (
                      <p
                        style={{
                          margin: '1px 0',
                          wordBreak: 'break-word',
                          overflowWrap: 'anywhere',
                          minWidth: 0
                        }}
                      >
                        Email: {email}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="quotation-badge">
                QUOTATION
              </div>
            </div>

            {/* TO / DETAILS SECTION */}
            <div className="grid grid-cols-2 gap-2 sm:gap-4 py-3.5 sm:py-4 border-b border-slate-200 text-[11px] sm:text-[13px] shrink-0">
              <div className="min-w-0">
                <span className="text-[10px] sm:text-[11px] font-bold text-[#6B7280] uppercase tracking-wider block">
                  To,
                </span>
                <p className="text-[13px] sm:text-[15px] font-bold text-[#0B1B3F] mt-0.5 truncate">
                  {quotation.customers?.name || 'Customer'}
                </p>
                {quotation.customers?.place && (
                  <p className="text-[11px] sm:text-[13px] text-[#6B7280] font-medium truncate">
                    {quotation.customers.place}
                  </p>
                )}
              </div>

              <div className="text-right min-w-0">
                <div className="space-y-0.5 sm:space-y-1">
                  <p className="truncate">
                    <span className="text-[#6B7280] font-medium">Quote No: </span>
                    <span className="font-bold text-[#0B1B3F] text-[13px] sm:text-[15px]">
                      {quotation.quote_no}
                    </span>
                  </p>
                  <p className="truncate">
                    <span className="text-[#6B7280] font-medium">Date: </span>
                    <span className="font-semibold text-[#0B1B3F]">
                      {formatDate(quotation.quote_date)}
                    </span>
                  </p>
                </div>
              </div>
            </div>

            {/* GREETING TEXT */}
            {quotation.greeting && (
              <div className="py-2.5 sm:py-3 text-[12px] sm:text-[13px] text-[#0B1B3F] italic font-medium shrink-0">
                {quotation.greeting}
              </div>
            )}

            {/* ITEMS TABLE */}
            <div className="flex-1 flex flex-col justify-start my-3 sm:my-4 min-h-[200px]">
              <table className="w-full text-left border-collapse border border-slate-300">
                <thead>
                  <tr className="bg-[#F3F5F9] text-[#0B1B3F] text-[10px] sm:text-[12px] font-bold border-b border-slate-300">
                    <th className="py-2 px-1 sm:px-2 text-center w-8 sm:w-10 border-r border-slate-300">S.No</th>
                    <th className="py-2 px-2 sm:px-3 border-r border-slate-300">Description</th>
                    <th className="py-2 px-1 sm:px-2 text-center w-12 sm:w-14 border-r border-slate-300">Unit</th>
                    <th className="py-2 px-1 sm:px-2 text-center w-10 sm:w-14 border-r border-slate-300">Qty</th>
                    <th className="py-2 px-1.5 sm:px-3 text-right w-16 sm:w-22 border-r border-slate-300">Rate</th>
                    <th className="py-2 px-2 sm:px-3 text-right w-20 sm:w-28">Amount</th>
                  </tr>
                </thead>
                <tbody className="text-[11px] sm:text-[13px] divide-y divide-slate-200">
                  {(() => {
                    console.log('[Preview] Quotation items:', quotation?.items);
                    return null;
                  })()}

                  {(quotation.items || []).map((item, index) => (
                    <tr key={item.id || index} className="hover:bg-slate-50">
                      <td className={`px-1 sm:px-2 text-center font-medium text-[#6B7280] border-r border-slate-200 ${itemRowPadding}`}>
                        {item.sl_no || index + 1}
                      </td>
                      <td className={`px-2 sm:px-3 font-medium text-[#0B1B3F] border-r border-slate-200 whitespace-pre-line leading-relaxed break-words ${itemRowPadding}`}>
                        {item.description || item.name || item.desc || '—'}
                      </td>
                      <td className={`px-1 sm:px-2 text-center text-[#6B7280] font-semibold border-r border-slate-200 whitespace-nowrap ${itemRowPadding}`}>
                        {item.unit || item.uom || 'Nos'}
                      </td>
                      <td className={`px-1 sm:px-2 text-center font-semibold border-r border-slate-200 ${itemRowPadding}`}>
                        {item.qty !== undefined && item.qty !== null ? item.qty : (item.quantity ?? 1)}
                      </td>
                      <td className={`px-1.5 sm:px-3 text-right font-semibold border-r border-slate-200 whitespace-nowrap ${itemRowPadding}`}>
                        {formatIndianCurrency(item.price !== undefined && item.price !== null ? item.price : item.rate, '')}
                      </td>
                      <td className={`px-2 sm:px-3 text-right font-bold text-[#0B1B3F] whitespace-nowrap ${itemRowPadding}`}>
                        {formatIndianCurrency(item.total !== undefined && item.total !== null ? item.total : item.amount, '')}
                      </td>
                    </tr>
                  ))}

                  {(!quotation.items || quotation.items.length === 0) && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400 font-medium italic">
                        No line items found for this quotation.
                      </td>
                    </tr>
                  )}

                  {itemsCount > 0 && Array.from({ length: emptyRowsCount }).map((_, idx) => (
                    <tr key={`empty-row-${idx}`} className="border-b border-slate-200/50">
                      <td className={`px-1 sm:px-2 text-center text-transparent border-r border-slate-200/50 select-none ${itemRowPadding}`}>&nbsp;</td>
                      <td className={`px-2 sm:px-3 text-transparent border-r border-slate-200/50 select-none ${itemRowPadding}`}>&nbsp;</td>
                      <td className={`px-1 sm:px-2 text-center text-transparent border-r border-slate-200/50 select-none ${itemRowPadding}`}>&nbsp;</td>
                      <td className={`px-1 sm:px-2 text-center text-transparent border-r border-slate-200/50 select-none ${itemRowPadding}`}>&nbsp;</td>
                      <td className={`px-1.5 sm:px-3 text-right text-transparent border-r border-slate-200/50 select-none ${itemRowPadding}`}>&nbsp;</td>
                      <td className={`px-2 sm:px-3 text-right text-transparent select-none ${itemRowPadding}`}>&nbsp;</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  {(parseFloat(quotation.discount_amount) > 0 || parseFloat(quotation.gst_amount) > 0) && (
                    <tr className="bg-[#F3F5F9]/60 border-t border-slate-200 text-[11px] sm:text-[12px]">
                      <td colSpan={5} className="py-2 px-2 sm:px-3 text-right font-semibold text-[#6B7280]">
                        Subtotal (₹)
                      </td>
                      <td className="py-2 px-2 sm:px-3 text-right font-bold text-[#0B1B3F] whitespace-nowrap">
                        {formatIndianCurrency(quotation.subtotal || quotation.grand_total, '')}
                      </td>
                    </tr>
                  )}

                  {parseFloat(quotation.discount_amount) > 0 && (
                    <tr className="bg-[#F3F5F9]/60 text-[11px] sm:text-[12px]">
                      <td colSpan={5} className="py-2 px-2 sm:px-3 text-right font-semibold text-rose-600">
                        Discount ({quotation.discount_percent}%)
                      </td>
                      <td className="py-2 px-2 sm:px-3 text-right font-semibold text-rose-600 whitespace-nowrap">
                        - {formatIndianCurrency(quotation.discount_amount, '')}
                      </td>
                    </tr>
                  )}

                  {parseFloat(quotation.gst_amount) > 0 && (
                    <tr className="bg-[#F3F5F9]/60 text-[11px] sm:text-[12px]">
                      <td colSpan={5} className="py-2 px-2 sm:px-3 text-right font-semibold text-emerald-700">
                        GST ({quotation.gst_percent}%)
                      </td>
                      <td className="py-2 px-2 sm:px-3 text-right font-semibold text-emerald-700 whitespace-nowrap">
                        + {formatIndianCurrency(quotation.gst_amount, '')}
                      </td>
                    </tr>
                  )}

                  <tr className="bg-[#F3F5F9] border-t-2 border-slate-300">
                    <td colSpan={5} className="py-2.5 sm:py-3 px-3 sm:px-4 text-right font-extrabold text-[12px] sm:text-[14px] text-[#0B1B3F]">
                      GRAND TOTAL (₹)
                    </td>
                    <td className="py-2.5 sm:py-3 px-2 sm:px-3 text-right font-extrabold text-[13px] sm:text-[16px] text-[#2F6FED] whitespace-nowrap">
                      {formatIndianCurrency(quotation.grand_total, '₹ ')}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* AMOUNT IN WORDS */}
            <div className="mt-2 py-2 px-3.5 bg-[#F3F5F9] border border-slate-200/60 rounded-[8px] text-[11px] sm:text-[12px] text-[#0B1B3F] shrink-0">
              <span className="text-[#6B7280] font-medium mr-1.5">Amount in Words:</span>
              <span className="font-bold italic">{numberToWordsIndian(quotation.grand_total)}</span>
            </div>

            {/* CLOSING LINE */}
            {quotation.closing && (
              <div className="mt-3 text-[12px] sm:text-[13px] text-[#0B1B3F] italic leading-relaxed shrink-0">
                {quotation.closing}
              </div>
            )}

            {/* FOOTER SECTION */}
            <div className="mt-auto pt-6 sm:pt-8 flex flex-col items-end text-right shrink-0">
              <span className="text-[13px] font-bold text-[#0B1B3F]">
                For, {companyName}
              </span>

              <div className="w-[100px] h-[48px] my-1.5 flex items-center justify-center">
                {signatureUrl ? (
                  <img
                    src={signatureUrl}
                    alt="Authorized Signature"
                    crossOrigin="anonymous"
                    width="100"
                    height="48"
                    className="w-full h-full object-contain"
                    style={{ width: '100px', height: '48px', objectFit: 'contain' }}
                  />
                ) : (
                  <div className="w-full h-full border-b border-dashed border-slate-300 flex items-center justify-center text-[10px] text-[#6B7280]">
                    [Signature]
                  </div>
                )}
              </div>

              <span className="text-[11px] font-bold text-[#6B7280] tracking-wider uppercase">
                AUTHORIZED SIGNATURE
              </span>
            </div>
          </div>
        </div>
      </main>

      {/* OFF-SCREEN CAPTURE ELEMENT:
          Rendered into document.body via Portal to guarantee NO parent transform/zoom interferes,
          with position: fixed, left: -10000px, width: 794px, visibility: visible. */}
      {typeof document !== 'undefined' &&
        createPortal(
          <PrintableQuotationDoc
            ref={offscreenRef}
            quotation={quotation}
            profile={profile}
            logoBase64={base64Logo}
            signatureBase64={base64Signature}
            isOffscreen={true}
          />,
          document.body
        )}

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs print:hidden"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="bg-white rounded-[12px] p-5 max-w-sm w-full shadow-xl"
            >
              <h3 className="text-[17px] font-bold text-[#0B1B3F]">
                Delete Quotation?
              </h3>
              <p className="text-[13px] text-[#6B7280] mt-1.5 leading-relaxed">
                Are you sure you want to delete quotation <span className="font-bold text-[#0B1B3F]">{quotation.quote_no}</span>? This action cannot be undone.
              </p>
              <div className="mt-4 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(false)}
                  className="px-4 py-2 text-[13px] font-medium text-[#6B7280] hover:bg-slate-100 rounded-[10px] active:scale-95 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  className="px-4 py-2 text-[13px] font-semibold bg-rose-600 hover:bg-rose-700 hover:scale-[1.02] active:scale-95 text-white rounded-[10px] shadow-xs transition-all duration-150 cursor-pointer"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
