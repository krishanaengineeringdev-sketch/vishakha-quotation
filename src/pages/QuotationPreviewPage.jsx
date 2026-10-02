import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { getQuotationById, getCompanyProfile, deleteQuotation, getNextQuoteNo, saveQuotation } from '../services/dataService';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import {
  Download,
  Share2,
  Edit,
  Copy,
  Printer,
  Trash2,
  ArrowLeft,
  Check,
  AlertCircle
} from 'lucide-react';
import html2canvas from 'html2canvas-pro';
import { jsPDF } from 'jspdf';
import { COMPANY_CONFIG } from '../config/companyConfig';
import { formatIndianCurrency, numberToWordsIndian } from '../utils/numberToWords';

export default function QuotationPreviewPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const paperRef = useRef(null);
  const offscreenRef = useRef(null);

  const [quotation, setQuotation] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [q, p] = await Promise.all([
          getQuotationById(id),
          getCompanyProfile()
        ]);
        setQuotation(q);
        setProfile(p);
      } catch (err) {
        console.error('Error loading quotation for preview:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

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

  const formatCurrency = (val) => {
    const num = parseFloat(val) || 0;
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2
    }).format(num);
  };

  // Generate PDF object using html2canvas-pro & jsPDF
  const generatePdfBlob = async () => {
    const targetElement = offscreenRef.current || paperRef.current;
    if (!targetElement) return null;

    const canvas = await html2canvas(targetElement, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      width: 794,
      windowWidth: 794,
      scrollX: 0,
      scrollY: 0
    });

    const pdf = new jsPDF({
      orientation: 'p',
      unit: 'mm',
      format: 'a4'
    });

    // Standard A4 aspect: 210mm x 297mm.
    // At 794px width with scale 2, canvas height is ~2246px for 1123px standard page height.
    // If canvas.height <= 2280px (1140px unscaled), it fits cleanly on a single A4 page.
    const isSinglePage = canvas.height <= 2280;

    if (isSinglePage) {
      // Single page PDF - stretches to fill complete A4 page height
      const imgData = canvas.toDataURL('image/jpeg', 0.98);
      // Place edge-to-edge on A4: x=0, y=0, w=210, h=297 (internal padding provides margins)
      pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297);
    } else {
      // Multi-page slicing for quotations with many items
      const pageCanvasHeight = Math.round((canvas.width * 297) / 210);
      const totalPages = Math.ceil(canvas.height / pageCanvasHeight);

      for (let page = 0; page < totalPages; page++) {
        const srcY = page * pageCanvasHeight;
        const currentSliceHeight = Math.min(pageCanvasHeight, canvas.height - srcY);

        const sliceCanvas = document.createElement('canvas');
        sliceCanvas.width = canvas.width;
        sliceCanvas.height = pageCanvasHeight;

        const ctx = sliceCanvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
        ctx.drawImage(
          canvas,
          0, srcY, canvas.width, currentSliceHeight,
          0, 0, canvas.width, currentSliceHeight
        );

        const sliceData = sliceCanvas.toDataURL('image/jpeg', 0.98);

        if (page > 0) {
          pdf.addPage('a4', 'p');
        }

        pdf.addImage(sliceData, 'JPEG', 0, 0, 210, 297);
      }
    }

    return {
      pdf,
      blob: pdf.output('blob')
    };
  };

  // Download PDF Action
  const handleDownloadPdf = async () => {
    setDownloading(true);
    setFeedbackMsg('');
    try {
      const result = await generatePdfBlob();
      if (result) {
        result.pdf.save(`Vishakha_Quotation_${quotation?.quote_no || 'Quote'}.pdf`);
        setFeedbackMsg('PDF downloaded successfully');
        setTimeout(() => setFeedbackMsg(''), 3000);
      }
    } catch (err) {
      console.error('PDF download error:', err);
      // Fallback to browser print
      window.print();
    } finally {
      setDownloading(false);
    }
  };

  // Share on WhatsApp Action
  const handleShareWhatsApp = async () => {
    setSharing(true);
    setFeedbackMsg('');

    const quoteNo = quotation?.quote_no || 'Quote';
    const custName = quotation?.customers?.name || 'Customer';
    const custPlace = quotation?.customers?.place ? ` (${quotation.customers.place})` : '';
    const dateStr = formatDate(quotation?.quote_date);
    const totalStr = formatIndianCurrency(quotation?.grand_total, 'Rs. ');
    const itemsCount = quotation?.items?.length || 0;

    const companyName = profile?.name || COMPANY_CONFIG.name;
    const phone = profile?.phone || COMPANY_CONFIG.phone;
    const email = profile?.email || COMPANY_CONFIG.email;

    // Summary text for WhatsApp
    const messageLines = [
      `*QUOTATION - ${companyName.toUpperCase()}*`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `📄 *Quote No:* ${quoteNo}`,
      `📅 *Date:* ${dateStr}`,
      `👤 *Customer:* ${custName}${custPlace}`,
      `📦 *Items:* ${itemsCount} line items`,
      `💰 *Grand Total:* ${totalStr}`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `${quotation?.greeting || ''}`,
      ``,
      `Thank you for your business inquiry!`,
      `📞 Contact: ${phone}`,
      `✉️ Email: ${email}`
    ];
    const summaryText = messageLines.filter(Boolean).join('\n');

    try {
      // 1. Try Web Share API with PDF file
      if (navigator.share) {
        const result = await generatePdfBlob();
        if (result?.blob) {
          const file = new File(
            [result.blob],
            `Quotation_${quoteNo}.pdf`,
            { type: 'application/pdf' }
          );

          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
              title: `Quotation ${quoteNo} - ${companyName}`,
              text: summaryText,
              files: [file]
            });
            setSharing(false);
            return;
          }
        }
      }
    } catch (shareErr) {
      // If user cancelled or failed, continue to WhatsApp link fallback
      if (shareErr.name === 'AbortError') {
        setSharing(false);
        return;
      }
      console.warn('Web Share API error, using WhatsApp URL fallback:', shareErr);
    }

    // 2. Fallback to wa.me link
    const waUrl = `https://wa.me/?text=${encodeURIComponent(summaryText)}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');
    setSharing(false);
  };

  // Duplicate Action
  const handleDuplicate = async () => {
    try {
      const nextNo = await getNextQuoteNo();
      const duplicated = await saveQuotation({
        quote_no: nextNo,
        quote_date: new Date().toISOString().split('T')[0],
        customerName: quotation.customers?.name || '',
        customerPlace: quotation.customers?.place || '',
        greeting: quotation.greeting || '',
        closing: quotation.closing || '',
        subtotal: quotation.subtotal,
        discount_percent: quotation.discount_percent || 0,
        discount_amount: quotation.discount_amount || 0,
        gst_percent: quotation.gst_percent || 0,
        gst_amount: quotation.gst_amount || 0,
        grand_total: quotation.grand_total,
        items: (quotation.items || []).map((it) => ({
          description: it.description,
          unit: it.unit || 'Nos',
          qty: it.qty,
          price: it.price,
          total: it.total,
          material_id: it.material_id || null
        }))
      });

      if (duplicated && (duplicated.id || duplicated.localId)) {
        navigate(`/quotation/${duplicated.id || duplicated.localId}`);
        setFeedbackMsg(`Duplicated as ${nextNo}`);
        setTimeout(() => setFeedbackMsg(''), 3000);
      }
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
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-[#0B1B3F]">
        <div className="w-8 h-8 border-3 border-[#2F6FED] border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-[13px] text-[#6B7280]">Loading quotation preview...</p>
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
  const logoUrl = profile?.logo_url || COMPANY_CONFIG.logoUrl;
  const signatureUrl = profile?.signature_url || '';

  const itemsCount = quotation?.items?.length || 0;
  // Fill empty space for quotations with few items so table spans gracefully (5 rows target)
  const emptyRowsCount = itemsCount <= 4 ? 5 - itemsCount : 0;
  // Dynamic padding: generous for 1-2 items, balanced for 3-4, compact for 5+
  const itemRowPadding = itemsCount <= 2 ? 'py-3 sm:py-3.5' : (itemsCount <= 4 ? 'py-2.5 sm:py-3' : 'py-2 sm:py-2.5');
  const offscreenRowPadding = itemsCount <= 2 ? 'py-3.5' : (itemsCount <= 4 ? 'py-2.5' : 'py-2');

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
              disabled={downloading}
              className="flex-1 h-11 bg-[#2F6FED] hover:bg-blue-600 hover:scale-[1.02] active:scale-95 hover:shadow-md text-white text-[13px] font-semibold rounded-[10px] flex items-center justify-center gap-1.5 shadow-xs transition-all duration-150 min-touch cursor-pointer"
            >
              {downloading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Download PDF</span>
                </>
              )}
            </button>

            <button
              onClick={handleShareWhatsApp}
              disabled={sharing}
              className="flex-1 h-11 bg-emerald-600 hover:bg-emerald-700 hover:scale-[1.02] active:scale-95 hover:shadow-md text-white text-[13px] font-semibold rounded-[10px] flex items-center justify-center gap-1.5 shadow-xs transition-all duration-150 min-touch cursor-pointer"
            >
              {sharing ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
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

      {/* Main Document Area (Responsive container on mobile, comfortable centered reading width on desktop) */}
      <main className="flex-1 w-full max-w-2xl xl:max-w-3xl mx-auto p-2 sm:p-6 lg:p-8 print:p-0">
        <div className="w-full overflow-x-hidden print:overflow-visible">
          {/* EXACT PAPER FORMAT: Single-page A4 document */}
          <div
            id="printable-quotation"
            ref={paperRef}
            className="document-card document-page a4-paper bg-white shadow-md hover:shadow-lg transition-shadow print:shadow-none border border-slate-200/80 print:border-none rounded-[12px] print:rounded-none p-5 sm:p-10 text-[#0B1B3F] flex flex-col overflow-x-hidden box-border mx-auto"
            style={{ minHeight: '297mm' }}
          >
            {/* HEADER SECTION */}
            <div className="header-row border-b-2 border-[#2F6FED] pb-4 sm:pb-5 shrink-0">
              {/* Left: Logo image (fixed width) + 'Vishakha' below + Company Details */}
              <div className="flex items-start gap-2.5 sm:gap-4 flex-1 min-w-0">
                <div className="flex flex-col items-center shrink-0 w-[56px] sm:w-[102px]">
                  <div className="w-[56px] h-[56px] sm:w-[102px] sm:h-[102px] print:w-[102px] print:h-[102px] flex items-center justify-center bg-white p-1">
                    <img
                      src={logoUrl}
                      alt={`${companyName} Logo`}
                      className="max-w-full max-h-full object-contain"
                      style={{ objectFit: 'contain' }}
                    />
                  </div>
                  <span className="text-[10px] sm:text-[13px] print:text-[13px] font-extrabold tracking-wider text-[#0B1B3F] mt-0.5 sm:mt-1 uppercase text-center">
                    {COMPANY_CONFIG.shortName}
                  </span>
                </div>

                {/* Company Full Info: flex: 1 1 0, min-width: 0 */}
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

              {/* Top-Right: 'Quotation' label (flex-shrink: 0) */}
              <div className="quotation-badge">
                QUOTATION
              </div>
            </div>

            {/* TO / DETAILS SECTION */}
            <div className="grid grid-cols-2 gap-2 sm:gap-4 py-3.5 sm:py-4 border-b border-slate-200 text-[11px] sm:text-[13px] shrink-0">
              {/* To: Customer Name + Place (Left) */}
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

              {/* Quotation# + Date (Right) */}
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

            {/* ITEMS TABLE (FLEXIBLE: expands to fill middle) */}
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
                  {(quotation.items || []).map((item, index) => (
                    <tr key={item.id || index} className="hover:bg-slate-50">
                      <td className={`px-1 sm:px-2 text-center font-medium text-[#6B7280] border-r border-slate-200 ${itemRowPadding}`}>
                        {item.sl_no || index + 1}
                      </td>
                      <td className={`px-2 sm:px-3 font-medium text-[#0B1B3F] border-r border-slate-200 whitespace-pre-line leading-relaxed break-words ${itemRowPadding}`}>
                        {item.description}
                      </td>
                      <td className={`px-1 sm:px-2 text-center text-[#6B7280] font-semibold border-r border-slate-200 whitespace-nowrap ${itemRowPadding}`}>
                        {item.unit || 'Nos'}
                      </td>
                      <td className={`px-1 sm:px-2 text-center font-semibold border-r border-slate-200 ${itemRowPadding}`}>
                        {item.qty}
                      </td>
                      <td className={`px-1.5 sm:px-3 text-right font-semibold border-r border-slate-200 whitespace-nowrap ${itemRowPadding}`}>
                        {formatIndianCurrency(item.price !== undefined ? item.price : item.rate, '')}
                      </td>
                      <td className={`px-2 sm:px-3 text-right font-bold text-[#0B1B3F] whitespace-nowrap ${itemRowPadding}`}>
                        {formatIndianCurrency(item.total !== undefined ? item.total : item.amount, '')}
                      </td>
                    </tr>
                  ))}

                  {/* Empty rows to visually extend table and prevent blank lower area */}
                  {Array.from({ length: emptyRowsCount }).map((_, idx) => (
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
                {/* TOTALS BREAKDOWN */}
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

                  {/* GRAND TOTAL ROW */}
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

            {/* FOOTER SECTION: 'For, {company_name}' right-aligned, signature image (100x48px), 'AUTHORIZED SIGNATURE' */}
            <div className="mt-auto pt-6 sm:pt-8 flex flex-col items-end text-right shrink-0">
              <span className="text-[13px] font-bold text-[#0B1B3F]">
                For, {companyName}
              </span>

              <div className="w-[100px] h-[48px] my-1.5 flex items-center justify-center">
                {signatureUrl ? (
                  <img
                    src={signatureUrl}
                    alt="Authorized Signature"
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

      {/* HIDDEN OFF-SCREEN A4 ELEMENT FOR HIGH-RES PDF & WHATSAPP GENERATION */}
      <div
        ref={offscreenRef}
        id="offscreen-printable-quotation"
        aria-hidden="true"
        style={{
          position: 'fixed',
          left: '-10000px',
          top: 0,
          width: '794px',
          height: itemsCount > 6 ? 'auto' : '1123px',
          minHeight: '1123px',
          transform: 'none',
          background: '#ffffff',
          zIndex: -9999,
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column'
        }}
        className="document-page p-10 text-[#0B1B3F]"
      >
        {/* HEADER SECTION */}
        <div
          className="header-row border-b-2 border-[#2F6FED] pb-5 shrink-0"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: '12px',
            width: '100%',
            boxSizing: 'border-box'
          }}
        >
          {/* Logo image (fixed width) + Short Name */}
          <div
            className="flex flex-col items-center shrink-0"
            style={{ width: '96px', flexShrink: 0 }}
          >
            <div
              className="flex items-center justify-center bg-white p-1"
              style={{ width: '96px', height: '96px' }}
            >
              <img
                src={logoUrl}
                alt={`${companyName} Logo`}
                className="max-w-full max-h-full object-contain"
                style={{ objectFit: 'contain' }}
              />
            </div>
            <span className="text-[12px] font-extrabold tracking-wider text-[#0B1B3F] mt-1 uppercase text-center">
              {COMPANY_CONFIG.shortName}
            </span>
          </div>

          {/* Header Text Column: flex: 1 1 0, min-width: 0 */}
          <div
            className="header-text-col pt-1"
            style={{
              flex: '1 1 0%',
              minWidth: 0,
              wordBreak: 'break-word',
              overflowWrap: 'anywhere'
            }}
          >
            <h1
              className="text-[20px] font-extrabold text-[#0B1B3F] leading-tight"
              style={{
                wordBreak: 'break-word',
                overflowWrap: 'anywhere',
                margin: 0
              }}
            >
              {companyName}
            </h1>
            {ownerName && (
              <p className="text-[13px] font-semibold text-[#2F6FED] mt-0.5">
                Proprietor: {ownerName}
              </p>
            )}
            <p
              className="text-[12px] text-[#6B7280] leading-snug mt-1"
              style={{
                wordBreak: 'break-word',
                overflowWrap: 'anywhere',
                minWidth: 0
              }}
            >
              {address}
            </p>
            <div
              className="mt-1 text-[12px] text-[#0B1B3F] space-y-0.5 font-medium"
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

          {/* Quotation Badge (flex-shrink: 0) */}
          <div
            className="quotation-badge shrink-0"
            style={{
              flexShrink: 0,
              whiteSpace: 'nowrap',
              padding: '6px 14px',
              fontSize: '13px',
              fontWeight: 800,
              letterSpacing: '0.08em',
              backgroundColor: '#2F6FED',
              color: '#FFFFFF',
              borderRadius: '6px',
              textTransform: 'uppercase',
              maxWidth: 'fit-content'
            }}
          >
            QUOTATION
          </div>
        </div>

        {/* TO / DETAILS SECTION */}
        <div className="grid grid-cols-2 gap-4 py-4 border-b border-slate-200 text-[13px] shrink-0">
          {/* Customer Details */}
          <div className="min-w-0">
            <span className="text-[11px] font-bold text-[#6B7280] uppercase tracking-wider block">
              To,
            </span>
            <p className="text-[15px] font-bold text-[#0B1B3F] mt-0.5" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
              {quotation.customers?.name || 'Customer'}
            </p>
            {quotation.customers?.place && (
              <p className="text-[13px] text-[#6B7280] font-medium mt-0.5" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                {quotation.customers.place}
              </p>
            )}
          </div>

          {/* Quote Number & Date */}
          <div className="text-right min-w-0">
            <div className="space-y-1">
              <p>
                <span className="text-[#6B7280] font-medium">Quote No: </span>
                <span className="font-bold text-[#0B1B3F] text-[15px]">
                  {quotation.quote_no}
                </span>
              </p>
              <p>
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
          <div className="py-3 text-[13px] text-[#0B1B3F] italic font-medium shrink-0">
            {quotation.greeting}
          </div>
        )}

        {/* ITEMS TABLE (FLEXIBLE: expands to fill middle) */}
        <div className="flex-1 flex flex-col justify-start my-4 min-h-[200px]">
          <table className="w-full text-left border-collapse border border-slate-300">
            <thead>
              <tr className="bg-[#F3F5F9] text-[#0B1B3F] text-[12px] font-bold border-b border-slate-300">
                <th className="py-2 px-2 text-center w-10 border-r border-slate-300">S.No</th>
                <th className="py-2 px-3 border-r border-slate-300">Description</th>
                <th className="py-2 px-2 text-center w-16 border-r border-slate-300">Unit</th>
                <th className="py-2 px-2 text-center w-14 border-r border-slate-300">Qty</th>
                <th className="py-2 px-3 text-right w-24 border-r border-slate-300">Rate</th>
                <th className="py-2 px-3 text-right w-28">Amount</th>
              </tr>
            </thead>
            <tbody className="text-[13px] divide-y divide-slate-200">
              {(quotation.items || []).map((item, index) => (
                <tr key={item.id || index}>
                  <td className={`px-2 text-center font-medium text-[#6B7280] border-r border-slate-200 ${offscreenRowPadding}`}>
                    {item.sl_no || index + 1}
                  </td>
                  <td className={`px-3 font-medium text-[#0B1B3F] border-r border-slate-200 whitespace-pre-line leading-relaxed ${offscreenRowPadding}`} style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                    {item.description}
                  </td>
                  <td className={`px-2 text-center text-[#6B7280] font-semibold border-r border-slate-200 whitespace-nowrap ${offscreenRowPadding}`}>
                    {item.unit || 'Nos'}
                  </td>
                  <td className={`px-2 text-center font-semibold border-r border-slate-200 ${offscreenRowPadding}`}>
                    {item.qty}
                  </td>
                  <td className={`px-3 text-right font-semibold border-r border-slate-200 whitespace-nowrap ${offscreenRowPadding}`}>
                    {formatIndianCurrency(item.price !== undefined ? item.price : item.rate, '')}
                  </td>
                  <td className={`px-3 text-right font-bold text-[#0B1B3F] whitespace-nowrap ${offscreenRowPadding}`}>
                    {formatIndianCurrency(item.total !== undefined ? item.total : item.amount, '')}
                  </td>
                </tr>
              ))}

              {/* Empty rows to visually extend table and prevent blank lower area */}
              {Array.from({ length: emptyRowsCount }).map((_, idx) => (
                <tr key={`empty-offscreen-${idx}`} className="border-b border-slate-200/50">
                  <td className={`px-2 text-center text-transparent border-r border-slate-200/50 select-none ${offscreenRowPadding}`}>&nbsp;</td>
                  <td className={`px-3 text-transparent border-r border-slate-200/50 select-none ${offscreenRowPadding}`}>&nbsp;</td>
                  <td className={`px-2 text-center text-transparent border-r border-slate-200/50 select-none ${offscreenRowPadding}`}>&nbsp;</td>
                  <td className={`px-2 text-center text-transparent border-r border-slate-200/50 select-none ${offscreenRowPadding}`}>&nbsp;</td>
                  <td className={`px-3 text-right text-transparent border-r border-slate-200/50 select-none ${offscreenRowPadding}`}>&nbsp;</td>
                  <td className={`px-3 text-right text-transparent select-none ${offscreenRowPadding}`}>&nbsp;</td>
                </tr>
              ))}
            </tbody>
            {/* TOTALS BREAKDOWN */}
            <tfoot>
              {(parseFloat(quotation.discount_amount) > 0 || parseFloat(quotation.gst_amount) > 0) && (
                <tr className="bg-[#F3F5F9]/60 border-t border-slate-200 text-[12px]">
                  <td colSpan={5} className="py-2 px-3 text-right font-semibold text-[#6B7280]">
                    Subtotal (₹)
                  </td>
                  <td className="py-2 px-3 text-right font-bold text-[#0B1B3F] whitespace-nowrap">
                    {formatIndianCurrency(quotation.subtotal || quotation.grand_total, '')}
                  </td>
                </tr>
              )}

              {parseFloat(quotation.discount_amount) > 0 && (
                <tr className="bg-[#F3F5F9]/60 text-[12px]">
                  <td colSpan={5} className="py-2 px-3 text-right font-semibold text-rose-600">
                    Discount ({quotation.discount_percent}%)
                  </td>
                  <td className="py-2 px-3 text-right font-semibold text-rose-600 whitespace-nowrap">
                    - {formatIndianCurrency(quotation.discount_amount, '')}
                  </td>
                </tr>
              )}

              {parseFloat(quotation.gst_amount) > 0 && (
                <tr className="bg-[#F3F5F9]/60 text-[12px]">
                  <td colSpan={5} className="py-2 px-3 text-right font-semibold text-emerald-700">
                    GST ({quotation.gst_percent}%)
                  </td>
                  <td className="py-2 px-3 text-right font-semibold text-emerald-700 whitespace-nowrap">
                    + {formatIndianCurrency(quotation.gst_amount, '')}
                  </td>
                </tr>
              )}

              {/* GRAND TOTAL ROW */}
              <tr className="bg-[#F3F5F9] border-t-2 border-slate-300">
                <td colSpan={5} className="py-3 px-4 text-right font-extrabold text-[14px] text-[#0B1B3F]">
                  GRAND TOTAL (₹)
                </td>
                <td className="py-3 px-3 text-right font-extrabold text-[16px] text-[#2F6FED] whitespace-nowrap">
                  {formatIndianCurrency(quotation.grand_total, '₹ ')}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* AMOUNT IN WORDS */}
        <div className="mt-2 py-2 px-3 bg-[#F3F5F9] border border-slate-200/60 rounded-[8px] text-[12px] text-[#0B1B3F] shrink-0">
          <span className="text-[#6B7280] font-medium mr-1.5">Amount in Words:</span>
          <span className="font-bold italic">{numberToWordsIndian(quotation.grand_total)}</span>
        </div>

        {/* CLOSING LINE */}
        {quotation.closing && (
          <div className="mt-3 text-[12px] text-[#0B1B3F] italic leading-relaxed shrink-0">
            {quotation.closing}
          </div>
        )}

        {/* FOOTER SECTION (Pushed to bottom via mt-auto) */}
        <div className="mt-auto pt-8 flex flex-col items-end text-right shrink-0">
          <span className="text-[13px] font-bold text-[#0B1B3F]">
            For, {companyName}
          </span>

          <div className="w-[100px] h-[48px] my-1.5 flex items-center justify-center">
            {signatureUrl ? (
              <img
                src={signatureUrl}
                alt="Authorized Signature"
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
