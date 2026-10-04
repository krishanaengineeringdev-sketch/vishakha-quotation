import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  getQuotationById,
  saveQuotation,
  getNextQuoteNo,
  getCustomers,
  getCompanyProfile,
  getMaterials,
  generateUuid
} from '../services/dataService';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import CustomDropdown from '../components/CustomDropdown';
import { formatIndianCurrency, numberToWordsIndian } from '../utils/numberToWords';
import {
  Plus,
  Trash2,
  Calendar,
  User,
  MapPin,
  Hash,
  AlertCircle,
  Save,
  Package,
  Search,
  X,
  Minus,
  Check,
  FileText,
  Tag,
  Percent,
  Layers,
  ChevronDown,
  Copy
} from 'lucide-react';

const STANDARD_UNITS = ['Nos', 'Kg', 'Meter', 'Sq.ft', 'Set', 'Ltr', 'Box', 'Custom'];
const GST_PRESETS = [
  { label: '0% (Exempt)', value: 0 },
  { label: '5% GST', value: 5 },
  { label: '12% GST', value: 12 },
  { label: '18% GST', value: 18 },
  { label: '28% GST', value: 28 }
];

function MaterialThumbnail({ src, alt, className = 'w-10 h-10' }) {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [src]);

  if (!src || hasError) {
    return (
      <div className={`${className} rounded-[8px] overflow-hidden bg-slate-100 dark:bg-gray-800 border border-slate-200/80 dark:border-gray-700 shrink-0 flex items-center justify-center shadow-2xs`}>
        <Package className="w-5 h-5 text-[#6B7280] dark:text-gray-400" />
      </div>
    );
  }

  return (
    <div className={`${className} rounded-[8px] overflow-hidden bg-slate-100 dark:bg-gray-800 border border-slate-200/80 dark:border-gray-700 shrink-0 flex items-center justify-center shadow-2xs`}>
      <img
        src={src}
        alt={alt || ''}
        className="w-full h-full object-cover"
        loading="lazy"
        onError={() => setHasError(true)}
      />
    </div>
  );
}

export default function CreateEditQuotationPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const duplicateData = location.state?.duplicateFrom;
  const isEdit = Boolean(id);

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [existingCustomers, setExistingCustomers] = useState([]);
  const [filteredCustomerSuggestions, setFilteredCustomerSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Form Fields
  const [quoteNo, setQuoteNo] = useState('');
  const [quoteDate, setQuoteDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [customerName, setCustomerName] = useState('');
  const [customerPlace, setCustomerPlace] = useState('');
  const [greeting, setGreeting] = useState('');
  const [closing, setClosing] = useState('');

  // Line Items
  const [items, setItems] = useState(() => [
    { id: generateUuid(), material_id: null, description: '', unit: 'Nos', qty: 1, price: 0, total: 0 }
  ]);

  // Tax and Discount State
  const [discountPercent, setDiscountPercent] = useState(0);
  const [gstPercent, setGstPercent] = useState(0);

  // Materials Catalog & Picker Modal State
  const [materialsList, setMaterialsList] = useState([]);
  const [showMaterialPicker, setShowMaterialPicker] = useState(false);
  const [materialPickerSearch, setMaterialPickerSearch] = useState('');
  const [pickerCategory, setPickerCategory] = useState('All');
  const [loadingMaterials, setLoadingMaterials] = useState(false);

  // Load defaults or existing quotation
  useEffect(() => {
    async function loadData() {
      try {
        const [profile, customersList, materials] = await Promise.all([
          getCompanyProfile(),
          getCustomers(),
          getMaterials()
        ]);

        setExistingCustomers(customersList || []);
        setMaterialsList(materials || []);

        if (isEdit) {
          const q = await getQuotationById(id);
          if (q) {
            setQuoteNo(q.quote_no || '');
            setQuoteDate(q.quote_date || new Date().toISOString().split('T')[0]);
            setCustomerName(q.customers?.name || '');
            setCustomerPlace(q.customers?.place || '');
            setGreeting(q.greeting || profile?.default_greeting || '');
            setClosing(q.closing || profile?.default_closing || '');
            setDiscountPercent(parseFloat(q.discount_percent) || 0);
            setGstPercent(parseFloat(q.gst_percent) || 0);

            if (q.items && q.items.length > 0) {
              setItems(
                q.items.map((it, idx) => {
                  const qVal = parseFloat(it.qty) || 1;
                  const pVal = parseFloat(it.price !== undefined ? it.price : it.rate) || 0;
                  const tVal = parseFloat(it.total !== undefined ? it.total : it.amount) || Math.round(qVal * pVal * 100) / 100;
                  return {
                    id: it.id || String(idx + 1),
                    material_id: it.material_id || null,
                    description: it.description || it.name || '',
                    unit: it.unit || 'Nos',
                    qty: qVal,
                    price: pVal,
                    rate: pVal,
                    total: tVal
                  };
                })
              );
            }
          } else {
            setErrorMessage('Quotation not found.');
          }
        } else if (duplicateData) {
          // Duplicated / Repeat Quote: prefill from existing quote with new number and today's date
          const nextNo = duplicateData.quote_no || (await getNextQuoteNo());
          setQuoteNo(nextNo);
          setQuoteDate(new Date().toISOString().split('T')[0]);
          setCustomerName(duplicateData.customerName || '');
          setCustomerPlace(duplicateData.customerPlace || '');
          setGreeting(
            duplicateData.greeting ||
              profile?.default_greeting ||
              'Dear Sir/Mam, Thank you for your valuable inquiry. We are pleased to quote as below:'
          );
          setClosing(
            duplicateData.closing ||
              profile?.default_closing ||
              'We hope you find our offer to be in line with your requirement.'
          );
          setDiscountPercent(parseFloat(duplicateData.discount_percent) || 0);
          setGstPercent(parseFloat(duplicateData.gst_percent) || 0);

          if (duplicateData.items && duplicateData.items.length > 0) {
            setItems(
              duplicateData.items.map((it, idx) => {
                const qVal = parseFloat(it.qty) || 1;
                const pVal =
                  parseFloat(it.price !== undefined ? it.price : it.rate) || 0;
                const tVal =
                  parseFloat(it.total !== undefined ? it.total : it.amount) ||
                  Math.round(qVal * pVal * 100) / 100;
                return {
                  id: generateUuid(),
                  material_id: it.material_id || null,
                  description: it.description || it.name || '',
                  unit: it.unit || 'Nos',
                  qty: qVal,
                  price: pVal,
                  rate: pVal,
                  total: tVal
                };
              })
            );
          }
        } else {
          // New quote defaults
          const nextNo = await getNextQuoteNo();
          setQuoteNo(nextNo);
          setGreeting(
            profile?.default_greeting ||
              'Dear Sir/Mam, Thank you for your valuable inquiry. We are pleased to quote as below:'
          );
          setClosing(
            profile?.default_closing ||
              'We hope you find our offer to be in line with your requirement.'
          );
        }
      } catch (err) {
        console.error('Error loading quote data:', err);
        setErrorMessage('Failed to load initial data.');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [id, isEdit, duplicateData]);

  // Refresh materials catalog when opening picker
  const handleOpenMaterialPicker = async () => {
    setMaterialPickerSearch('');
    setPickerCategory('All');
    setShowMaterialPicker(true);
    setLoadingMaterials(true);
    try {
      const data = await getMaterials();
      setMaterialsList(data || []);
    } catch (err) {
      console.error('Failed to refresh materials:', err);
    } finally {
      setLoadingMaterials(false);
    }
  };

  // Customer Autocomplete Filter
  const handleCustomerNameChange = (val) => {
    setCustomerName(val);
    if (!val.trim()) {
      setFilteredCustomerSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    const matches = existingCustomers.filter((c) =>
      c.name.toLowerCase().includes(val.toLowerCase())
    );
    setFilteredCustomerSuggestions(matches);
    setShowSuggestions(matches.length > 0);
  };

  const handleSelectCustomer = (cust) => {
    setCustomerName(cust.name);
    if (cust.place) setCustomerPlace(cust.place);
    setShowSuggestions(false);
  };

  // Line item change handlers
  const handleItemChange = (index, field, value) => {
    setItems((prev) => {
      const updated = [...prev];
      const current = { ...updated[index] };

      if (field === 'description') {
        current.description = value;
      } else if (field === 'unit') {
        current.unit = value;
      } else if (field === 'qty') {
        current.qty = value;
        const q = parseFloat(value) || 0;
        const p = parseFloat(current.price) || 0;
        current.total = Math.round(q * p * 100) / 100;
      } else if (field === 'price') {
        current.price = value;
        const q = parseFloat(current.qty) || 0;
        const p = parseFloat(value) || 0;
        current.total = Math.round(q * p * 100) / 100;
      }

      updated[index] = current;
      return updated;
    });
  };

  // Quantity stepper (+ / - buttons)
  const handleQtyStep = (index, delta) => {
    setItems((prev) => {
      const updated = [...prev];
      const current = { ...updated[index] };
      const currentQty = parseFloat(current.qty) || 0;
      const newQty = Math.max(1, Math.round((currentQty + delta) * 100) / 100);
      current.qty = newQty;
      const p = parseFloat(current.price) || 0;
      current.total = Math.round(newQty * p * 100) / 100;
      updated[index] = current;
      return updated;
    });
  };

  // Add a blank custom item
  const handleAddCustomItem = () => {
    setItems((prev) => [
      ...prev,
      {
        id: generateUuid(),
        material_id: null,
        description: '',
        unit: 'Nos',
        qty: 1,
        price: 0,
        rate: 0,
        total: 0
      }
    ]);
  };

  // Add material snapshot from catalog
  const handleSelectMaterial = (material) => {
    const priceVal = parseFloat(material.rate) || 0;

    const newItem = {
      id: generateUuid(),
      material_id: material.id || null,
      description: material.name || '',
      unit: material.unit || 'Nos',
      qty: 1,
      price: priceVal,
      rate: priceVal,
      total: priceVal
    };

    setItems((prev) => {
      // If there is only 1 item and it is blank, replace it
      if (
        prev.length === 1 &&
        !prev[0].description.trim() &&
        (parseFloat(prev[0].price) || 0) === 0 &&
        !prev[0].material_id
      ) {
        return [newItem];
      }
      return [...prev, newItem];
    });

    setShowMaterialPicker(false);
  };

  const handleDeleteItem = (index) => {
    if (items.length === 1) {
      // Clear instead of removing last row
      setItems([
        {
          id: generateUuid(),
          material_id: null,
          description: '',
          unit: 'Nos',
          qty: 1,
          price: 0,
          rate: 0,
          total: 0
        }
      ]);
      return;
    }
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Extract unique categories from materialsList
  const pickerCategories = useMemo(() => {
    const set = new Set();
    materialsList.forEach((m) => {
      if (m.category && m.category.trim()) {
        set.add(m.category.trim());
      }
    });
    return set.size > 0 ? ['All', ...Array.from(set).sort((a, b) => a.localeCompare(b))] : [];
  }, [materialsList]);

  // Filter materials in picker by search and category
  const filteredMaterials = materialsList.filter((m) => {
    if (pickerCategory !== 'All') {
      const itemCat = (m.category || '').toLowerCase().trim();
      if (itemCat !== pickerCategory.toLowerCase().trim()) return false;
    }

    const q = materialPickerSearch.toLowerCase().trim();
    if (!q) return true;
    return (
      (m.name || '').toLowerCase().includes(q) ||
      (m.code || m.hsn || '').toLowerCase().includes(q) ||
      (m.unit || '').toLowerCase().includes(q) ||
      (m.category || '').toLowerCase().includes(q) ||
      (m.description || '').toLowerCase().includes(q)
    );
  });

  // Calculate live Grand Total, Subtotal, Discount, GST
  const subtotal = items.reduce(
    (sum, it) => sum + (parseFloat(it.total) || 0),
    0
  );

  const discountRate = parseFloat(discountPercent) || 0;
  const discountAmount = Math.round(((subtotal * discountRate) / 100) * 100) / 100;
  const taxableAmount = Math.max(0, subtotal - discountAmount);

  const gstRate = parseFloat(gstPercent) || 0;
  const gstAmount = Math.round(((taxableAmount * gstRate) / 100) * 100) / 100;

  const grandTotal = Math.round((taxableAmount + gstAmount) * 100) / 100;
  const amountInWords = numberToWordsIndian(grandTotal);

  const handleSave = async (e) => {
    e?.preventDefault();
    setErrorMessage('');

    if (!quoteNo.trim()) {
      setErrorMessage('Quotation number is required.');
      return;
    }

    if (!customerName.trim()) {
      setErrorMessage('Customer name is required.');
      return;
    }

    const validItems = items.filter(
      (it) => it.description.trim() && parseFloat(it.qty) > 0
    );

    if (validItems.length === 0) {
      setErrorMessage('Please add at least one item with a description and quantity > 0.');
      return;
    }

    setSaving(true);

    try {
      const saved = await saveQuotation({
        id: isEdit ? id : null,
        quote_no: quoteNo.trim(),
        quote_date: quoteDate,
        customerName: customerName.trim(),
        customerPlace: customerPlace.trim(),
        greeting,
        closing,
        subtotal,
        discount_percent: discountRate,
        discount_amount: discountAmount,
        gst_percent: gstRate,
        gst_amount: gstAmount,
        grand_total: grandTotal,
        items: validItems
      });

      if (saved && (saved.id || saved.localId)) {
        navigate(`/quotation/${saved.id || saved.localId}`);
      } else {
        navigate('/');
      }
    } catch (err) {
      console.error('Error saving quotation:', err);
      setErrorMessage(err.message || 'Failed to save quotation. Please try again.');
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F3F5F9] dark:bg-[#0B1220] flex flex-col pb-32 lg:pb-12 lg:pl-64 transition-colors">
        <Sidebar />
        <Header title={isEdit ? 'Edit Quotation' : 'New Quotation'} showBack={true} onBack={() => navigate('/')} />

        <main className="flex-1 w-full max-w-[520px] lg:max-w-4xl xl:max-w-5xl mx-auto px-4 sm:px-6 pt-4 pb-12 space-y-4">
          {/* Card 1: Quotation Details */}
          <div className="bg-white dark:bg-[#1A2332] rounded-[14px] p-4 border border-slate-200/80 dark:border-gray-800 space-y-3">
            <div className="h-5 w-36 skeleton rounded-[6px]" />
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-1">
              <div className="h-10 skeleton rounded-[10px]" />
              <div className="h-10 skeleton rounded-[10px]" />
              <div className="h-10 skeleton rounded-[10px] col-span-2 sm:col-span-1" />
            </div>
          </div>

          {/* Card 2: Customer Info */}
          <div className="bg-white dark:bg-[#1A2332] rounded-[14px] p-4 border border-slate-200/80 dark:border-gray-800 space-y-3">
            <div className="h-5 w-40 skeleton rounded-[6px]" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="h-10 skeleton rounded-[10px]" />
              <div className="h-10 skeleton rounded-[10px]" />
              <div className="h-10 skeleton rounded-[10px]" />
              <div className="h-10 skeleton rounded-[10px]" />
            </div>
          </div>

          {/* Card 3: Line Items */}
          <div className="bg-white dark:bg-[#1A2332] rounded-[14px] p-4 border border-slate-200/80 dark:border-gray-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="h-5 w-32 skeleton rounded-[6px]" />
              <div className="h-8 w-28 skeleton rounded-[8px]" />
            </div>
            <div className="space-y-2 pt-1">
              {[1, 2, 3].map((n) => (
                <div key={n} className="h-14 skeleton rounded-[10px]" />
              ))}
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="min-h-screen bg-[#F3F5F9] dark:bg-[#0B1220] flex flex-col pb-32 lg:pb-12 lg:pl-64 transition-colors"
    >
      <Sidebar />
      <Header
        title={isEdit ? 'Edit Quotation' : 'New Quotation'}
        showBack={true}
        onBack={() => navigate(-1)}
      />

      <main className="flex-1 max-w-[520px] lg:max-w-5xl xl:max-w-6xl w-full mx-auto px-3 sm:px-6 lg:px-8 pt-3 sm:pt-6 pb-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Form Details & Items */}
          <div className="lg:col-span-7 xl:col-span-8 space-y-4">
            {errorMessage && (
              <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-[10px] flex items-start gap-2.5 text-rose-700 dark:text-rose-300 text-[13px]">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            {duplicateData && (
              <div className="p-3.5 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 rounded-[10px] flex items-center justify-between text-blue-900 dark:text-blue-200 text-[13px] shadow-xs">
                <div className="flex items-center gap-2.5">
                  <Copy className="w-4 h-4 shrink-0 text-[#2F6FED] dark:text-blue-400" />
                  <span>
                    Duplicated from <strong>{duplicateData.originalQuoteNo || 'previous quotation'}</strong>. Pre-filled with items and details. New quote number and today's date assigned.
                  </span>
                </div>
              </div>
            )}

            {/* Top Card: Quotation Metadata */}
            <section className="bg-white dark:bg-[#1A2332] rounded-[14px] p-4 space-y-3.5 border border-slate-200 dark:border-gray-700/60 shadow-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[13px] font-semibold text-[#0B1B3F] dark:text-white mb-1">
                Quote No. *
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#6B7280] dark:text-gray-400">
                  <Hash className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  value={quoteNo}
                  onChange={(e) => setQuoteNo(e.target.value)}
                  placeholder="Quote-101"
                  className="w-full pl-9 pr-3 py-2 bg-[#F3F5F9] dark:bg-[#0B1220] focus:bg-white dark:focus:bg-[#0B1220] border border-slate-200 dark:border-gray-700 rounded-[10px] text-[15px] font-bold text-[#0B1B3F] dark:text-white placeholder-[#6B7280] dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#2F6FED] transition-all min-touch"
                />
              </div>
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#0B1B3F] dark:text-white mb-1">
                Date *
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#6B7280] dark:text-gray-400">
                  <Calendar className="w-4 h-4" />
                </div>
                <input
                  type="date"
                  required
                  value={quoteDate}
                  onChange={(e) => setQuoteDate(e.target.value)}
                  className="w-full pl-9 pr-2 py-2 bg-[#F3F5F9] dark:bg-[#0B1220] focus:bg-white dark:focus:bg-[#0B1220] border border-slate-200 dark:border-gray-700 rounded-[10px] text-[15px] text-[#0B1B3F] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#2F6FED] transition-all min-touch"
                />
              </div>
            </div>
          </div>

          {/* Customer Details */}
          <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-gray-700/60">
            <div className="relative">
              <label className="block text-[13px] font-semibold text-[#0B1B3F] dark:text-white mb-1">
                Customer Name *
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#6B7280] dark:text-gray-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => handleCustomerNameChange(e.target.value)}
                  onFocus={() => {
                    if (customerName.trim() && filteredCustomerSuggestions.length > 0) {
                      setShowSuggestions(true);
                    }
                  }}
                  placeholder="e.g. Apex Engineering Works"
                  className="w-full pl-9 pr-3 py-2 bg-[#F3F5F9] dark:bg-[#0B1220] focus:bg-white dark:focus:bg-[#0B1220] border border-slate-200 dark:border-gray-700 rounded-[10px] text-[15px] text-[#0B1B3F] dark:text-white placeholder-[#6B7280] dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#2F6FED] transition-all min-touch"
                />
              </div>

              {/* Suggestions Dropdown */}
              {showSuggestions && filteredCustomerSuggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 z-30 bg-white dark:bg-[#1A2332] border border-slate-200 dark:border-gray-700 rounded-[10px] shadow-lg max-h-48 overflow-y-auto">
                  {filteredCustomerSuggestions.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => handleSelectCustomer(c)}
                      className="w-full text-left px-3.5 py-2.5 hover:bg-[#F3F5F9] dark:hover:bg-[#202C3F] border-b border-slate-100 dark:border-gray-700/60 last:border-0 flex items-center justify-between text-[13px] text-[#0B1B3F] dark:text-white"
                    >
                      <span className="font-medium">{c.name}</span>
                      {c.place && <span className="text-[12px] text-[#6B7280] dark:text-gray-400">{c.place}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#0B1B3F] dark:text-white mb-1">
                Customer Place / City
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#6B7280] dark:text-gray-400">
                  <MapPin className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={customerPlace}
                  onChange={(e) => setCustomerPlace(e.target.value)}
                  placeholder="e.g. Chinnavedapatti, Coimbatore"
                  className="w-full pl-9 pr-3 py-2 bg-[#F3F5F9] dark:bg-[#0B1220] focus:bg-white dark:focus:bg-[#0B1220] border border-slate-200 dark:border-gray-700 rounded-[10px] text-[15px] text-[#0B1B3F] dark:text-white placeholder-[#6B7280] dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#2F6FED] transition-all min-touch"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Greeting Section */}
        <section className="bg-white dark:bg-[#1A2332] rounded-[14px] p-3.5 border border-slate-200 dark:border-gray-700/60 shadow-xs">
          <label className="block text-[13px] font-semibold text-[#0B1B3F] dark:text-white mb-1">
            Greeting / Opening Note
          </label>
          <textarea
            rows={2}
            value={greeting}
            onChange={(e) => setGreeting(e.target.value)}
            className="w-full px-3 py-2 bg-[#F3F5F9] dark:bg-[#0B1220] focus:bg-white dark:focus:bg-[#0B1220] border border-slate-200 dark:border-gray-700 rounded-[10px] text-[13px] text-[#0B1B3F] dark:text-white placeholder-[#6B7280] dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#2F6FED] transition-all"
          />
        </section>

        {/* Line Items Section */}
        <section className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-baseline gap-2">
              <h3 className="text-[16px] font-bold text-[#0B1B3F] dark:text-white leading-none">
                Line Items ({items.length})
              </h3>
              <span className="text-[11px] text-[#6B7280] dark:text-gray-400 hidden xs:inline">
                (Qty × Rate = Amount)
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleOpenMaterialPicker}
                className="h-8.5 px-3 bg-[#2F6FED] hover:bg-blue-600 active:scale-95 text-white text-[12px] font-semibold rounded-[8px] flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
              >
                <Package className="w-3.5 h-3.5" />
                <span>Add Material</span>
              </button>
              <button
                type="button"
                onClick={handleAddCustomItem}
                className="h-8.5 px-2.5 bg-white dark:bg-[#1A2332] hover:bg-slate-50 dark:hover:bg-[#202C3F] border border-slate-200 dark:border-gray-700 text-[#0B1B3F] dark:text-white text-[12px] font-semibold rounded-[8px] flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Custom</span>
              </button>
            </div>
          </div>

          {/* Desktop Table Column Headers (exact match with item-row-grid) */}
          <div className="hidden lg:grid item-row-grid px-4 py-1.5 border border-transparent text-[11px] font-bold text-[#6B7280] dark:text-gray-400 uppercase tracking-wider">
            <span className="text-center">#</span>
            <span>Description</span>
            <span>Unit</span>
            <span className="text-center">Qty</span>
            <span className="text-right">Rate (₹)</span>
            <span className="text-right">Amount</span>
            <span></span>
          </div>

          {/* Items Cards */}
          <div className="space-y-3">
            <AnimatePresence initial={false}>
              {items.map((item, index) => {
                const isCustomUnit = !STANDARD_UNITS.filter((u) => u !== 'Custom').includes(item.unit);
                return (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0, y: -12, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{
                      opacity: 0,
                      scale: 0.95,
                      height: 0,
                      overflow: 'hidden',
                      marginTop: 0,
                      marginBottom: 0,
                      paddingTop: 0,
                      paddingBottom: 0,
                      borderWidth: 0,
                      transition: { duration: 0.2, ease: 'easeOut' }
                    }}
                    transition={{ duration: 0.2, ease: 'easeOut' }}
                    className="bg-white dark:bg-[#1A2332] border border-slate-200 dark:border-gray-700/60 rounded-[14px] p-3.5 lg:px-4 lg:py-3 space-y-3 shadow-xs hover:border-slate-300 dark:hover:border-gray-600 transition-colors overflow-hidden"
                  >
                  {/* MOBILE VIEW (< 1024px): Stacked layout */}
                  <div className="lg:hidden space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-[#F3F5F9] dark:bg-[#0B1220] border border-slate-200 dark:border-gray-700 text-[#0B1B3F] dark:text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                          {index + 1}
                        </span>
                        <span className="text-[13px] font-bold text-[#0B1B3F] dark:text-white">
                          Item #{index + 1}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDeleteItem(index)}
                        aria-label={`Delete item ${index + 1}`}
                        className="w-8 h-8 flex items-center justify-center rounded-[8px] text-[#6B7280] dark:text-gray-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors min-touch cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Description / Item Name */}
                    <div>
                      <label className="block text-[11px] font-medium text-[#6B7280] dark:text-gray-400 mb-1">
                        Description / Material Name *
                      </label>
                      <textarea
                        rows={2}
                        value={item.description}
                        onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                        placeholder="e.g. Mild Steel Flange 25mm Class 150..."
                        className="w-full px-3 py-2 bg-[#F3F5F9] dark:bg-[#0B1220] focus:bg-white dark:focus:bg-[#0B1220] border border-slate-200 dark:border-gray-700 rounded-[10px] text-[13px] text-[#0B1B3F] dark:text-white placeholder-[#9CA3AF] dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#2F6FED] transition-all"
                      />
                    </div>

                    {/* Controls Grid: Unit, Qty Stepper, Rate */}
                    <div className="grid grid-cols-12 gap-2 items-end">
                      <div className="col-span-3">
                        <label className="block text-[11px] font-medium text-[#6B7280] dark:text-gray-400 mb-1">
                          Unit
                        </label>
                        <CustomDropdown
                          value={isCustomUnit ? 'Custom' : item.unit}
                          onChange={(val) => {
                            handleItemChange(index, 'unit', val === 'Custom' ? '' : val);
                          }}
                          options={STANDARD_UNITS}
                          buttonClassName="h-9 px-2 py-1 text-[12px] font-semibold rounded-[8px]"
                          menuClassName="min-w-[120px]"
                        />
                      </div>

                      <div className="col-span-4">
                        <label className="block text-[11px] font-medium text-[#6B7280] dark:text-gray-400 mb-1 text-center">
                          Quantity
                        </label>
                        <div className="flex items-center border border-slate-200 dark:border-gray-700 rounded-[8px] bg-[#F3F5F9] dark:bg-[#0B1220] overflow-hidden">
                          <button
                            type="button"
                            onClick={() => handleQtyStep(index, -1)}
                            className="w-7 h-9 flex items-center justify-center bg-slate-100 dark:bg-gray-800 hover:bg-slate-200 dark:hover:bg-gray-700 text-[#0B1B3F] dark:text-white font-bold transition-colors min-touch cursor-pointer"
                            title="Decrease qty"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <input
                            type="number"
                            inputMode="decimal"
                            step="any"
                            min="0"
                            value={item.qty}
                            onChange={(e) => handleItemChange(index, 'qty', e.target.value)}
                            className="w-full min-w-0 py-1.5 bg-transparent text-[13px] font-bold text-[#0B1B3F] dark:text-white text-center focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => handleQtyStep(index, 1)}
                            className="w-7 h-9 flex items-center justify-center bg-slate-100 dark:bg-gray-800 hover:bg-slate-200 dark:hover:bg-gray-700 text-[#0B1B3F] dark:text-white font-bold transition-colors min-touch cursor-pointer"
                            title="Increase qty"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="col-span-5">
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[11px] font-medium text-[#6B7280] dark:text-gray-400">
                            Rate (₹)
                          </label>
                        </div>
                        <input
                          type="number"
                          inputMode="decimal"
                          step="any"
                          min="0"
                          value={item.price}
                          onChange={(e) => handleItemChange(index, 'price', e.target.value)}
                          placeholder="0.00"
                          className="w-full px-2 py-2 bg-[#F3F5F9] dark:bg-[#0B1220] focus:bg-white dark:focus:bg-[#0B1220] border border-slate-200 dark:border-gray-700 rounded-[8px] text-[13px] font-bold text-[#0B1B3F] dark:text-white text-right focus:outline-none focus:ring-2 focus:ring-[#2F6FED] min-touch"
                        />
                      </div>
                    </div>

                    {isCustomUnit && (
                      <div>
                        <label className="block text-[11px] font-medium text-[#6B7280] dark:text-gray-400 mb-1">
                          Enter Custom Unit Name
                        </label>
                        <input
                          type="text"
                          value={item.unit}
                          onChange={(e) => handleItemChange(index, 'unit', e.target.value)}
                          placeholder="e.g. Coil, Roll, Bag..."
                          className="w-full px-2.5 py-1.5 bg-[#F3F5F9] dark:bg-[#0B1220] border border-slate-200 dark:border-gray-700 rounded-[8px] text-[12px] text-[#0B1B3F] dark:text-white"
                        />
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-gray-700/60 text-[12px]">
                      <span className="text-[#6B7280] dark:text-gray-400">
                        {item.qty} {item.unit || 'Nos'} × {formatIndianCurrency(item.price, '₹')}
                      </span>
                      <div className="text-right">
                        <span className="text-[11px] text-[#6B7280] dark:text-gray-400 mr-1.5">Amount:</span>
                        <span className="font-extrabold text-[#0B1B3F] dark:text-white text-[14px]">
                          {formatIndianCurrency(item.total, 'Rs. ')}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* DESKTOP VIEW (>= 1024px): Exact CSS Grid Shared with Table Header */}
                  <div className="hidden lg:grid item-row-grid">
                    {/* # Column (32px) */}
                    <div className="flex items-center justify-center">
                      <span className="w-7 h-7 rounded-full bg-[#F3F5F9] dark:bg-[#0B1220] border border-slate-200 dark:border-gray-700 text-[#0B1B3F] dark:text-white text-[12px] font-bold flex items-center justify-center">
                        {index + 1}
                      </span>
                    </div>

                    {/* Description Column (1fr) */}
                    <div>
                      <input
                        type="text"
                        value={item.description}
                        onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                        placeholder="Description / Material name *"
                        className="w-full h-9 px-3 py-1.5 bg-[#F3F5F9] dark:bg-[#0B1220] focus:bg-white dark:focus:bg-[#0B1220] border border-slate-200 dark:border-gray-700 rounded-[8px] text-[13px] text-[#0B1B3F] dark:text-white placeholder-[#9CA3AF] dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#2F6FED]"
                      />
                    </div>

                    {/* Unit Column (90px) */}
                    <div>
                      <CustomDropdown
                        value={isCustomUnit ? 'Custom' : item.unit}
                        onChange={(val) => {
                          handleItemChange(index, 'unit', val === 'Custom' ? '' : val);
                        }}
                        options={STANDARD_UNITS}
                        buttonClassName="h-9 px-2 py-1 text-[12px] font-semibold rounded-[8px]"
                        menuClassName="min-w-[120px]"
                      />
                    </div>

                    {/* Qty Stepper Column (110px) - Matching Rate Height (h-9) */}
                    <div className="h-9 flex items-center border border-slate-200 dark:border-gray-700 rounded-[8px] bg-[#F3F5F9] dark:bg-[#0B1220] overflow-hidden">
                      <button
                        type="button"
                        onClick={() => handleQtyStep(index, -1)}
                        className="w-7 h-full flex items-center justify-center bg-slate-100 dark:bg-gray-800 hover:bg-slate-200 dark:hover:bg-gray-700 text-[#0B1B3F] dark:text-white font-bold transition-colors cursor-pointer shrink-0"
                        title="Decrease qty"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <input
                        type="number"
                        inputMode="decimal"
                        step="any"
                        min="0"
                        value={item.qty}
                        onChange={(e) => handleItemChange(index, 'qty', e.target.value)}
                        className="w-full h-full min-w-0 py-0 bg-transparent text-[13px] font-bold text-[#0B1B3F] dark:text-white text-center focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => handleQtyStep(index, 1)}
                        className="w-7 h-full flex items-center justify-center bg-slate-100 dark:bg-gray-800 hover:bg-slate-200 dark:hover:bg-gray-700 text-[#0B1B3F] dark:text-white font-bold transition-colors cursor-pointer shrink-0"
                        title="Increase qty"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Rate Column (100px) - Matching Qty Stepper Height (h-9) */}
                    <div>
                      <input
                        type="number"
                        inputMode="decimal"
                        step="any"
                        min="0"
                        value={item.price}
                        onChange={(e) => handleItemChange(index, 'price', e.target.value)}
                        placeholder="0.00"
                        className="w-full h-9 px-2.5 py-1.5 bg-[#F3F5F9] dark:bg-[#0B1220] focus:bg-white dark:focus:bg-[#0B1220] border border-slate-200 dark:border-gray-700 rounded-[8px] text-[13px] font-bold text-[#0B1B3F] dark:text-white text-right focus:outline-none focus:ring-2 focus:ring-[#2F6FED]"
                      />
                    </div>

                    {/* Amount Column (90px) */}
                    <div className="h-9 flex items-center justify-end text-right">
                      <span className="font-extrabold text-[#0B1B3F] dark:text-white text-[13.5px] truncate">
                        {formatIndianCurrency(item.total, '₹')}
                      </span>
                    </div>

                    {/* Delete Column (24px) - Clean 24px icon button fully inside padding */}
                    <div className="flex items-center justify-center">
                      <button
                        type="button"
                        onClick={() => handleDeleteItem(index)}
                        aria-label={`Delete item ${index + 1}`}
                        className="w-6 h-6 flex items-center justify-center rounded-[6px] text-[#6B7280] dark:text-gray-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors cursor-pointer"
                        title="Delete item"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Desktop Custom Unit row */}
                  {isCustomUnit && (
                    <div className="hidden lg:flex items-center gap-2 mt-2 pt-2 border-t border-slate-100 dark:border-gray-800">
                      <span className="text-[11px] text-[#6B7280] dark:text-gray-400">Custom Unit Name:</span>
                      <input
                        type="text"
                        value={item.unit}
                        onChange={(e) => handleItemChange(index, 'unit', e.target.value)}
                        placeholder="e.g. Coil, Roll, Bag..."
                        className="w-56 px-2.5 py-1 bg-[#F3F5F9] dark:bg-[#0B1220] border border-slate-200 dark:border-gray-700 rounded-[6px] text-[12px] text-[#0B1B3F] dark:text-white"
                      />
                    </div>
                  )}
                </motion.div>
              );
            })}
            </AnimatePresence>
          </div>

          {/* Quick Add Buttons Row (Equal width, 1fr 1fr grid with 8px gap) */}
          <div className="item-actions-row pt-1">
            <button
              type="button"
              onClick={handleOpenMaterialPicker}
              className="h-10 w-full bg-white dark:bg-[#1A2332] hover:bg-blue-50/60 dark:hover:bg-blue-950/40 border border-[#2F6FED]/50 hover:border-[#2F6FED] text-[#2F6FED] font-semibold rounded-[10px] flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-95 hover:shadow-md transition-all duration-150 min-touch text-[13px] shadow-xs cursor-pointer"
            >
              <Package className="w-4 h-4" />
              <span>Select Material</span>
            </button>
            <button
              type="button"
              onClick={handleAddCustomItem}
              className="h-10 w-full bg-white dark:bg-[#1A2332] hover:bg-slate-50 dark:hover:bg-[#202C3F] border border-slate-200 dark:border-gray-700 hover:border-slate-300 dark:hover:border-gray-600 text-[#0B1B3F] dark:text-white font-semibold rounded-[10px] flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-95 transition-all duration-150 min-touch text-[13px] shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4 text-[#6B7280] dark:text-gray-400" />
              <span>Custom Item</span>
            </button>
          </div>
        </section>

        {/* Closing Line Section (in left column) */}
        <section className="bg-white dark:bg-[#1A2332] rounded-[14px] p-3.5 border border-slate-200 dark:border-gray-700/60 shadow-xs">
          <label className="block text-[13px] font-semibold text-[#0B1B3F] dark:text-white mb-1">
            Closing Line / Terms
          </label>
          <textarea
            rows={2}
            value={closing}
            onChange={(e) => setClosing(e.target.value)}
            className="w-full px-3 py-2 bg-[#F3F5F9] dark:bg-[#0B1220] focus:bg-white dark:focus:bg-[#0B1220] border border-slate-200 dark:border-gray-700 rounded-[10px] text-[13px] text-[#0B1B3F] dark:text-white placeholder-[#6B7280] dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#2F6FED] transition-all"
          />
        </section>
      </div>

      {/* Right Column: Live-Updating Sticky Summary & Desktop Actions */}
      <div className="lg:col-span-5 xl:col-span-4 lg:sticky lg:top-20 space-y-4">
        {/* Calculation / Totals Breakdown Card */}
        <section className="bg-white dark:bg-[#1A2332] rounded-[14px] p-4 sm:p-5 space-y-3.5 border border-slate-200 dark:border-gray-700/60 shadow-xs">
          <h4 className="text-[14px] font-bold text-[#0B1B3F] dark:text-white flex items-center justify-between border-b border-slate-100 dark:border-gray-700/60 pb-2">
            <span>Summary & Taxes</span>
            <span className="text-[11px] font-medium text-[#2F6FED] bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-full">
              Live Total
            </span>
          </h4>

          {/* Subtotal */}
          <div className="flex items-center justify-between text-[13px]">
            <span className="text-[#6B7280] dark:text-gray-400">Subtotal ({items.length} items)</span>
            <span className="font-bold text-[#0B1B3F] dark:text-white">
              {formatIndianCurrency(subtotal, 'Rs. ')}
            </span>
          </div>

          {/* Discount % */}
          <div className="pt-2 border-t border-slate-100 dark:border-gray-700/60 space-y-2">
            <div className="flex items-center justify-between text-[13px]">
              <div className="flex items-center gap-1.5">
                <Percent className="w-3.5 h-3.5 text-[#6B7280] dark:text-gray-400" />
                <span className="text-[#6B7280] dark:text-gray-400">Discount</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  inputMode="decimal"
                  step="any"
                  min="0"
                  max="100"
                  value={discountPercent}
                  onChange={(e) => setDiscountPercent(e.target.value)}
                  placeholder="0"
                  className="w-16 px-2 py-1 bg-[#F3F5F9] dark:bg-[#0B1220] border border-slate-200 dark:border-gray-700 rounded-[6px] text-right text-[13px] font-semibold text-[#0B1B3F] dark:text-white focus:outline-none focus:ring-1 focus:ring-[#2F6FED]"
                />
                <span className="text-[12px] text-[#6B7280] dark:text-gray-400">%</span>
                <span className="font-semibold text-rose-600 dark:text-rose-400 min-w-[70px] text-right">
                  - {formatIndianCurrency(discountAmount, 'Rs. ')}
                </span>
              </div>
            </div>
          </div>

          {/* GST % */}
          <div className="pt-2 border-t border-slate-100 dark:border-gray-700/60 space-y-2">
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-[#6B7280] dark:text-gray-400 font-medium">GST Rate</span>
              <div className="flex items-center gap-2">
                {/* Custom GST Dropdown */}
                <CustomDropdown
                  value={gstPercent}
                  onChange={(val) => setGstPercent(val)}
                  options={GST_PRESETS}
                  buttonClassName="h-8 px-2.5 text-[13px] font-semibold rounded-[8px]"
                  menuClassName="w-[160px]"
                  align="right"
                  className="relative"
                />

                <span className="font-semibold text-emerald-700 dark:text-emerald-400 min-w-[70px] text-right">
                  + {formatIndianCurrency(gstAmount, 'Rs. ')}
                </span>
              </div>
            </div>
          </div>

          {/* Grand Total */}
          <div className="pt-3 border-t-2 border-slate-200 dark:border-gray-700 flex items-center justify-between">
            <div>
              <span className="block text-[14px] font-extrabold text-[#0B1B3F] dark:text-white">
                Grand Total
              </span>
              <span className="text-[11px] text-[#6B7280] dark:text-gray-400">
                Inclusive of all taxes
              </span>
            </div>
            <motion.span
              key={grandTotal}
              initial={{ scale: 1.08 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="text-[20px] font-extrabold text-[#2F6FED] tracking-tight inline-block"
            >
              {formatIndianCurrency(grandTotal, 'Rs. ')}
            </motion.span>
          </div>

          {/* Amount in words */}
          <div className="mt-2 p-2.5 bg-[#F3F5F9] dark:bg-[#0B1220] rounded-[10px] text-[11px] text-[#0B1B3F] dark:text-gray-200 flex items-start gap-2">
            <FileText className="w-4 h-4 text-[#2F6FED] shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-[#6B7280] dark:text-gray-400 uppercase tracking-wider block text-[10px]">
                Amount in Words
              </span>
              <span className="font-semibold text-[#0B1B3F] dark:text-gray-200 italic">
                {amountInWords}
              </span>
            </div>
          </div>
        </section>

        {/* Desktop Save Action Card */}
        <div className="hidden lg:block bg-white dark:bg-[#1A2332] rounded-[14px] p-4 border border-slate-200 dark:border-gray-700/60 shadow-xs space-y-2.5">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="w-full h-12 bg-[#2F6FED] hover:bg-blue-600 hover:scale-[1.02] active:scale-95 text-white font-semibold rounded-[10px] shadow-sm hover:shadow-md flex items-center justify-center gap-2 transition-all duration-150 cursor-pointer"
          >
            {saving ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>{isEdit ? 'Update Quotation' : 'Save Quotation'}</span>
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="w-full h-9 bg-slate-100 dark:bg-gray-800 hover:bg-slate-200 dark:hover:bg-gray-700 hover:scale-[1.01] active:scale-95 text-[#6B7280] dark:text-gray-300 font-medium rounded-[8px] text-[12px] flex items-center justify-center transition-all duration-150 cursor-pointer"
          >
            Cancel / Go Back
          </button>
        </div>
      </div>
    </div>
  </main>

      {/* Sticky Bottom Bar: Mobile Only (lg:hidden) */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#1A2332]/95 backdrop-blur-md border-t border-slate-200 dark:border-gray-800 shadow-[0_-6px_20px_rgba(0,0,0,0.06)] px-4 py-3 lg:hidden">
        <div className="max-w-[520px] mx-auto flex items-center justify-between gap-4">
          <div className="min-w-0">
            <span className="block text-[11px] font-medium text-[#6B7280] dark:text-gray-400">
              Total ({items.length} items)
            </span>
            <motion.span
              key={grandTotal}
              initial={{ scale: 1.08 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="text-[18px] sm:text-[20px] font-extrabold text-[#0B1B3F] dark:text-white tracking-tight truncate block"
            >
              {formatIndianCurrency(grandTotal, 'Rs. ')}
            </motion.span>
          </div>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex-1 max-w-[200px] h-12 bg-[#2F6FED] hover:bg-blue-600 hover:scale-[1.02] active:scale-95 text-white font-semibold rounded-[10px] shadow-sm hover:shadow-md flex items-center justify-center gap-2 transition-all duration-150 min-touch cursor-pointer"
          >
            {saving ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Save Quote</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Bottom Sheet Modal: Searchable Material Picker */}
      <AnimatePresence>
        {showMaterialPicker && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-black/75 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="bg-white dark:bg-[#1A2332] w-full sm:max-w-lg rounded-t-[20px] sm:rounded-[16px] shadow-2xl border border-transparent dark:border-gray-700 max-h-[85vh] flex flex-col overflow-hidden"
            >
              {/* Mobile Drag Indicator */}
              <div className="w-12 h-1.5 bg-slate-300 dark:bg-gray-600 rounded-full mx-auto mt-2.5 mb-1 sm:hidden shrink-0" />

              {/* Picker Header */}
              <div className="p-4 border-b border-slate-200 dark:border-gray-700 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-[#2F6FED]/10 text-[#2F6FED] flex items-center justify-center">
                    <Package className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-[16px] font-bold text-[#0B1B3F] dark:text-white">
                      Select Material
                    </h3>
                    <p className="text-[11px] text-[#6B7280] dark:text-gray-400">
                      Tap to add as snapshot line item
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowMaterialPicker(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-full text-[#6B7280] dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-gray-700 hover:scale-105 active:scale-95 transition-all min-touch cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Search Input */}
              <div className="p-3 border-b border-slate-100 dark:border-gray-700/60 bg-[#F3F5F9] dark:bg-[#0B1220] shrink-0">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#6B7280] dark:text-gray-400">
                    <Search className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={materialPickerSearch}
                    onChange={(e) => setMaterialPickerSearch(e.target.value)}
                    placeholder="Search materials by name or code..."
                    autoFocus
                    className="w-full pl-9 pr-8 py-2 bg-white dark:bg-[#1A2332] border border-slate-200 dark:border-gray-700 rounded-[10px] text-[14px] text-[#0B1B3F] dark:text-white placeholder-[#6B7280] dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#2F6FED] min-touch"
                  />
                  {materialPickerSearch && (
                    <button
                      type="button"
                      onClick={() => setMaterialPickerSearch('')}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#6B7280] dark:text-gray-400 hover:text-[#0B1B3F] dark:hover:text-white active:scale-95 transition-transform"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Category Filter Pills inside Picker */}
              {pickerCategories.length > 0 && (
                <div className="flex items-center gap-1.5 overflow-x-auto px-3 py-2 bg-[#F3F5F9]/80 dark:bg-[#0B1220]/80 border-b border-slate-100 dark:border-gray-700/60 shrink-0 no-scrollbar">
                  {pickerCategories.map((cat) => {
                    const isSelected = pickerCategory.toLowerCase() === cat.toLowerCase();
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setPickerCategory(cat)}
                        className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all shrink-0 cursor-pointer ${
                          isSelected
                            ? 'bg-[#2F6FED] text-white shadow-xs'
                            : 'bg-white dark:bg-[#1A2332] text-[#6B7280] dark:text-gray-400 hover:text-[#0B1B3F] dark:hover:text-white border border-slate-200/60 dark:border-gray-700'
                        }`}
                      >
                        {cat}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Materials List */}
              <div className="flex-1 overflow-y-auto p-3 space-y-2 max-h-[50vh]">
                {loadingMaterials ? (
                  <div className="space-y-2 py-1">
                    {[1, 2, 3, 4].map((n) => (
                      <div
                        key={n}
                        className="p-3 rounded-[10px] bg-slate-50 dark:bg-gray-800/60 border border-slate-200/60 dark:border-gray-700/60 flex items-center justify-between gap-3"
                      >
                        <div className="w-9 h-9 skeleton rounded-[8px] shrink-0" />
                        <div className="flex-1 space-y-1.5">
                          <div className="h-4 w-32 skeleton rounded-[4px]" />
                          <div className="h-3 w-20 skeleton rounded-[4px]" />
                        </div>
                        <div className="h-4 w-16 skeleton rounded-[4px]" />
                      </div>
                    ))}
                  </div>
                ) : filteredMaterials.length === 0 ? (
                  <div className="py-10 text-center space-y-3">
                    <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-gray-800 text-[#6B7280] dark:text-gray-400 flex items-center justify-center mx-auto">
                      <Package className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-[14px] font-bold text-[#0B1B3F] dark:text-white">
                        No materials found
                      </p>
                      <p className="text-[12px] text-[#6B7280] dark:text-gray-400 mt-0.5">
                        {materialPickerSearch || pickerCategory !== 'All'
                          ? `No match found in catalog`
                          : 'No saved materials in catalog'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setShowMaterialPicker(false);
                        handleAddCustomItem();
                      }}
                      className="px-4 py-2 bg-[#2F6FED] hover:bg-blue-600 hover:scale-[1.02] active:scale-95 text-white text-[13px] font-semibold rounded-[8px] min-touch inline-flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add Custom Item Instead</span>
                    </button>
                  </div>
                ) : (
                  filteredMaterials.map((mat) => (
                    <button
                      key={mat.id || mat.localId}
                      type="button"
                      onClick={() => handleSelectMaterial(mat)}
                      className="w-full text-left p-2.5 sm:p-3 rounded-[12px] border border-slate-200 dark:border-gray-700/70 hover:border-[#2F6FED] hover:bg-blue-50/30 dark:hover:bg-[#202C3F] hover:scale-[1.01] active:scale-[0.99] transition-all duration-150 flex items-center justify-between gap-3 group cursor-pointer"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        {/* 40x40px Material Thumbnail with graceful fallback */}
                        <MaterialThumbnail src={mat.image_url} alt={mat.name} />

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-[14px] text-[#0B1B3F] dark:text-white group-hover:text-[#2F6FED] transition-colors">
                              {mat.name}
                            </span>
                            {/* Stock Status Informational Badge */}
                            <span
                              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                                mat.in_stock !== false
                                  ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border-emerald-200/50 dark:border-emerald-900/50'
                                  : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border-rose-200/50 dark:border-rose-900/50'
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  mat.in_stock !== false ? 'bg-emerald-500' : 'bg-rose-500'
                                }`}
                              />
                              <span>
                                {mat.in_stock !== false
                                  ? (mat.stock_qty !== undefined && mat.stock_qty !== null && mat.stock_qty !== ''
                                      ? `In Stock (${mat.stock_qty})`
                                      : 'In Stock')
                                  : 'Out of Stock'}
                              </span>
                            </span>
                            {mat.category && (
                              <span className="px-1.5 py-0.5 bg-blue-50 dark:bg-blue-950/60 text-[#2F6FED] border border-blue-200/50 dark:border-blue-900/50 text-[10px] font-semibold rounded-full">
                                {mat.category}
                              </span>
                            )}
                            {(mat.code || mat.hsn) && (
                              <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-gray-800 text-[#6B7280] dark:text-gray-300 text-[10px] font-semibold rounded">
                                Code: {mat.code || mat.hsn}
                              </span>
                            )}
                          </div>
                          {mat.description && (
                            <p className="text-[12px] text-[#6B7280] dark:text-gray-400 line-clamp-1 mt-0.5">
                              {mat.description}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-[14px] font-extrabold text-[#2F6FED] block">
                          {formatIndianCurrency(mat.rate, 'Rs. ')}
                        </span>
                        <span className="text-[11px] text-[#6B7280] dark:text-gray-400">
                          per {mat.unit || 'Nos'}
                        </span>
                      </div>
                    </button>
                  ))
                )}
              </div>

              {/* Bottom Actions inside Picker */}
              <div className="p-3 bg-[#F3F5F9] dark:bg-[#0B1220] border-t border-slate-200 dark:border-gray-700 flex items-center justify-between gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setShowMaterialPicker(false);
                    navigate('/materials');
                  }}
                  className="text-[12px] font-semibold text-[#2F6FED] hover:underline"
                >
                  Manage Catalog →
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowMaterialPicker(false);
                    handleAddCustomItem();
                  }}
                  className="px-3 py-1.5 bg-white dark:bg-[#1A2332] border border-slate-200 dark:border-gray-700 text-[#0B1B3F] dark:text-white text-[12px] font-semibold rounded-[8px] flex items-center gap-1 min-touch hover:bg-slate-50 dark:hover:bg-[#202C3F] hover:scale-[1.02] active:scale-95 transition-all duration-150 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Custom Item</span>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
