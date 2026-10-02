import React, { forwardRef } from 'react';
import html2canvas from 'html2canvas-pro';
import { jsPDF } from 'jspdf';
import { COMPANY_CONFIG } from '../config/companyConfig';
import { formatIndianCurrency, numberToWordsIndian } from '../utils/numberToWords';

export function formatDate(dateStr) {
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
}

/**
 * Generate PDF blob & jsPDF instance from a DOM element
 */
export async function generateQuotationPdf(targetElement) {
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

  const isSinglePage = canvas.height <= 2280;

  if (isSinglePage) {
    const imgData = canvas.toDataURL('image/jpeg', 0.98);
    pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297);
  } else {
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
}

/**
 * Share quotation on WhatsApp via Web Share API or wa.me fallback
 */
export async function shareQuotationWhatsApp({ quotation, profile, targetElement }) {
  if (!quotation) return;

  const quoteNo = quotation?.quote_no || 'Quote';
  const custName = quotation?.customers?.name || 'Customer';
  const custPlace = quotation?.customers?.place ? ` (${quotation.customers.place})` : '';
  const dateStr = formatDate(quotation?.quote_date);
  const totalStr = formatIndianCurrency(quotation?.grand_total, 'Rs. ');
  const itemsCount = quotation?.items?.length || 0;

  const companyName = profile?.name || COMPANY_CONFIG.name;
  const phone = profile?.phone || COMPANY_CONFIG.phone;
  const email = profile?.email || COMPANY_CONFIG.email;

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
    if (navigator.share && targetElement) {
      const result = await generateQuotationPdf(targetElement);
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
          return { method: 'web-share', success: true };
        }
      }
    }
  } catch (err) {
    if (err.name === 'AbortError') {
      return { method: 'cancelled', success: false };
    }
    console.warn('Web Share failed, using wa.me fallback:', err);
  }

  // Fallback to wa.me link
  const waUrl = `https://wa.me/?text=${encodeURIComponent(summaryText)}`;
  window.open(waUrl, '_blank', 'noopener,noreferrer');
  return { method: 'wa-url', success: true };
}

/**
 * Clean Document Template Component for high-res PDF generation & print
 */
export const PrintableQuotationDoc = forwardRef(function PrintableQuotationDoc(
  { quotation, profile, isOffscreen = true },
  ref
) {
  if (!quotation) return null;

  const companyName = profile?.name || COMPANY_CONFIG.name;
  const ownerName = profile?.owner_name || COMPANY_CONFIG.ownerName;
  const address = profile?.address || COMPANY_CONFIG.address;
  const phone = profile?.phone || COMPANY_CONFIG.phone;
  const email = profile?.email || COMPANY_CONFIG.email;
  const logoUrl = profile?.logo_url || COMPANY_CONFIG.logoUrl;
  const signatureUrl = profile?.signature_url || '';

  const itemsCount = quotation?.items?.length || 0;
  const emptyRowsCount = itemsCount <= 4 ? 5 - itemsCount : 0;
  const rowPadding = itemsCount <= 2 ? 'py-3.5' : (itemsCount <= 4 ? 'py-2.5' : 'py-2');

  const containerStyle = isOffscreen
    ? {
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
      }
    : {
        width: '794px',
        minHeight: '1123px',
        background: '#ffffff',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column'
      };

  return (
    <div
      ref={ref}
      style={containerStyle}
      className="document-page p-10 text-[#0B1B3F]"
      aria-hidden={isOffscreen ? 'true' : undefined}
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

        {/* Header Text Column */}
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

        {/* Quotation Badge */}
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

      {/* ITEMS TABLE */}
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
                <td className={`px-2 text-center font-medium text-[#6B7280] border-r border-slate-200 ${rowPadding}`}>
                  {item.sl_no || index + 1}
                </td>
                <td className={`px-3 font-medium text-[#0B1B3F] border-r border-slate-200 whitespace-pre-line leading-relaxed ${rowPadding}`} style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                  {item.description}
                </td>
                <td className={`px-2 text-center text-[#6B7280] font-semibold border-r border-slate-200 whitespace-nowrap ${rowPadding}`}>
                  {item.unit || 'Nos'}
                </td>
                <td className={`px-2 text-center font-semibold border-r border-slate-200 ${rowPadding}`}>
                  {item.qty}
                </td>
                <td className={`px-3 text-right font-semibold border-r border-slate-200 whitespace-nowrap ${rowPadding}`}>
                  {formatIndianCurrency(item.price !== undefined ? item.price : item.rate, '')}
                </td>
                <td className={`px-3 text-right font-bold text-[#0B1B3F] whitespace-nowrap ${rowPadding}`}>
                  {formatIndianCurrency(item.total !== undefined ? item.total : item.amount, '')}
                </td>
              </tr>
            ))}

            {Array.from({ length: emptyRowsCount }).map((_, idx) => (
              <tr key={`empty-${idx}`} className="border-b border-slate-200/50">
                <td className={`px-2 text-center text-transparent border-r border-slate-200/50 select-none ${rowPadding}`}>&nbsp;</td>
                <td className={`px-3 text-transparent border-r border-slate-200/50 select-none ${rowPadding}`}>&nbsp;</td>
                <td className={`px-2 text-center text-transparent border-r border-slate-200/50 select-none ${rowPadding}`}>&nbsp;</td>
                <td className={`px-2 text-center text-transparent border-r border-slate-200/50 select-none ${rowPadding}`}>&nbsp;</td>
                <td className={`px-3 text-right text-transparent border-r border-slate-200/50 select-none ${rowPadding}`}>&nbsp;</td>
                <td className={`px-3 text-right text-transparent select-none ${rowPadding}`}>&nbsp;</td>
              </tr>
            ))}
          </tbody>
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

      {/* FOOTER SECTION */}
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
  );
});
