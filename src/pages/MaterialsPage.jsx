import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getMaterials, saveMaterial, deleteMaterial } from '../services/dataService';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import BottomNav from '../components/BottomNav';
import { formatIndianCurrency } from '../utils/numberToWords';
import {
  Search,
  Plus,
  Edit2,
  Trash2,
  Package,
  Layers,
  Check,
  AlertCircle,
  X,
  Tag,
  Hash
} from 'lucide-react';

const STANDARD_UNITS = ['Nos', 'Kg', 'Meter', 'Sq.ft', 'Set', 'Ltr', 'Box', 'Custom'];

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

export default function MaterialsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [toast, setToast] = useState(null); // { message: '', type: 'success' | 'error' }
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch materials from Supabase (single source of truth when online)
  const fetchMaterials = useCallback(async () => {
    try {
      const data = await getMaterials(searchQuery);
      setMaterials(data || []);
    } catch (e) {
      console.warn('Error fetching materials:', e);
    } finally {
      setLoading(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    fetchMaterials();
  }, [fetchMaterials]);

  // Re-fetch when connection restored
  useEffect(() => {
    const handleOnline = () => {
      fetchMaterials();
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [fetchMaterials]);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    unitSelect: 'Nos',
    customUnit: '',
    rate: '',
    code: '',
    description: ''
  });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  // Delete Confirm State
  const [deletingId, setDeletingId] = useState(null);
  const [materialToDelete, setMaterialToDelete] = useState(null);

  const showNotification = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleOpenAdd = () => {
    setEditingMaterial(null);
    setFormData({
      name: '',
      unitSelect: 'Nos',
      customUnit: '',
      rate: '',
      code: '',
      description: ''
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (mat) => {
    setEditingMaterial(mat);
    const isStandard = STANDARD_UNITS.filter((u) => u !== 'Custom').includes(mat.unit);
    setFormData({
      name: mat.name || '',
      unitSelect: isStandard ? mat.unit : 'Custom',
      customUnit: isStandard ? '' : (mat.unit || ''),
      rate: mat.rate !== undefined ? String(mat.rate) : '',
      code: mat.code || mat.hsn || '',
      description: mat.description || ''
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingMaterial(null);
    setFormError('');
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    const trimmedName = formData.name.trim();
    if (!trimmedName) {
      setFormError('Material name is required');
      return;
    }

    const rateNum = parseFloat(formData.rate);
    if (isNaN(rateNum) || rateNum < 0) {
      setFormError('Please enter a valid rate (0 or greater)');
      return;
    }

    const unit = formData.unitSelect === 'Custom'
      ? (formData.customUnit.trim() || 'Nos')
      : formData.unitSelect;

    setSaving(true);
    try {
      await saveMaterial({
        id: editingMaterial?.id || null,
        name: trimmedName,
        unit,
        rate: rateNum,
        code: formData.code.trim(),
        description: formData.description.trim()
      });

      showNotification(
        editingMaterial
          ? `Updated "${trimmedName}"`
          : `Added "${trimmedName}" to Materials`,
        'success'
      );
      handleCloseModal();
      await fetchMaterials();
    } catch (err) {
      setFormError(err.message || 'Failed to save material');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!materialToDelete) return;
    const targetIdentifier = materialToDelete.id || materialToDelete.localId;
    setDeletingId(targetIdentifier);
    try {
      const res = await deleteMaterial(materialToDelete);
      if (res && res.success) {
        showNotification(`Deleted "${materialToDelete.name}"`, 'success');
        setMaterialToDelete(null);
        await fetchMaterials();
      } else {
        showNotification(res?.error || 'Failed to delete material', 'error');
      }
    } catch (err) {
      showNotification(err.message || 'Failed to delete material', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="min-h-screen bg-white dark:bg-[#0B1220] flex flex-col pb-24 lg:pb-12 lg:pl-64 text-[#0B1B3F] dark:text-white transition-colors"
    >
      <Sidebar />
      <Header />

      {/* Toast Notification */}
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

      <main className="flex-1 w-full max-w-[520px] lg:max-w-5xl xl:max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-3 sm:pt-6 pb-8">
        {/* Title, Search & Desktop Actions Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div>
            <h2 className="text-[20px] sm:text-[24px] font-bold text-[#0B1B3F] dark:text-white tracking-tight">
              Materials Catalog
            </h2>
            <p className="text-[12px] sm:text-[13px] text-[#6B7280] dark:text-gray-400">
              {materials.length} {materials.length === 1 ? 'item' : 'items'} saved for quick quotation
            </p>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            {/* Search Input: constrained to max-w-md on desktop */}
            <div className="relative flex-1 sm:w-72 lg:w-80">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#6B7280] dark:text-gray-400">
                <Search className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search material by name, HSN, unit..."
                className="w-full pl-10 pr-9 py-2 bg-[#F3F5F9] dark:bg-[#1A2332] border border-transparent dark:border-gray-700/60 focus:border-slate-200 dark:focus:border-gray-600 focus:bg-white dark:focus:bg-[#1A2332] rounded-[10px] text-[14px] text-[#0B1B3F] dark:text-white placeholder-[#6B7280] dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#2F6FED] transition-all min-touch"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#6B7280] dark:text-gray-400 hover:text-[#0B1B3F] dark:hover:text-white active:scale-95 transition-transform cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Desktop + Add Material Button */}
            <button
              onClick={handleOpenAdd}
              className="hidden sm:inline-flex items-center gap-1.5 h-10 px-4 bg-[#2F6FED] hover:bg-blue-600 hover:scale-[1.02] active:scale-95 hover:shadow-md text-white text-[13px] font-semibold rounded-[10px] shadow-xs transition-all duration-150 shrink-0 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Material</span>
            </button>
          </div>
        </div>

        {/* Materials List */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 text-[#6B7280] dark:text-gray-400">
            <div className="w-7 h-7 border-2 border-[#2F6FED] border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-[13px]">Loading materials catalog...</p>
          </div>
        ) : materials.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center bg-[#F3F5F9] dark:bg-[#1A2332] rounded-[16px] border border-dashed border-slate-200 dark:border-gray-700 max-w-md mx-auto">
            <div className="w-12 h-12 rounded-full bg-white dark:bg-[#0B1220] flex items-center justify-center text-[#2F6FED] mb-3 shadow-xs">
              <Package className="w-6 h-6" />
            </div>
            <h3 className="text-[16px] font-bold text-[#0B1B3F] dark:text-white">
              {searchQuery ? 'No Matching Materials' : 'No Materials Yet'}
            </h3>
            <p className="text-[13px] text-[#6B7280] dark:text-gray-400 max-w-xs mt-1">
              {searchQuery
                ? `No materials found matching "${searchQuery}". Try a different term or add a new material.`
                : 'Add your product catalog items with rates to quickly select them when creating quotations.'}
            </p>
            <button
              onClick={handleOpenAdd}
              className="mt-4 px-4 py-2 bg-[#2F6FED] text-white text-[13px] font-semibold rounded-[10px] flex items-center gap-1.5 shadow-xs hover:bg-blue-600 hover:scale-[1.02] active:scale-95 hover:shadow-md transition-all duration-150 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Your First Material</span>
            </button>
          </div>
        ) : (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3.5"
          >
            {materials.map((mat) => (
              <motion.div
                key={mat.id}
                variants={cardVariants}
                whileTap={{ scale: 0.98 }}
                className="bg-[#F3F5F9] dark:bg-[#1A2332] hover:bg-slate-100/90 dark:hover:bg-[#202C3F] border border-slate-200/80 dark:border-gray-800 rounded-[12px] p-3.5 transition-all duration-200 shadow-xs hover:shadow-md hover:-translate-y-0.5 hover:border-slate-300 dark:hover:border-gray-700 flex flex-col justify-between"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center flex-wrap gap-1.5 mb-1">
                      <h3 className="text-[15px] font-bold text-[#0B1B3F] dark:text-white leading-snug break-words">
                        {mat.name}
                      </h3>
                      {(mat.code || mat.hsn) && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-100/80 dark:bg-blue-950/60 text-[#2F6FED]">
                          <Hash className="w-2.5 h-2.5" />
                          <span>Code: {mat.code || mat.hsn}</span>
                        </span>
                      )}
                    </div>

                    {mat.description && (
                      <p className="text-[12px] text-[#6B7280] dark:text-gray-400 line-clamp-2 leading-relaxed mb-2">
                        {mat.description}
                      </p>
                    )}

                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[14px] font-extrabold text-[#2F6FED]">
                        {formatIndianCurrency(mat.rate)}
                      </span>
                      <span className="text-[12px] font-medium text-[#6B7280] dark:text-gray-400">
                        / {mat.unit || 'Nos'}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0 pt-0.5">
                    <button
                      onClick={() => handleOpenEdit(mat)}
                      className="w-8 h-8 rounded-[8px] bg-white dark:bg-[#0B1220] border border-slate-200 dark:border-gray-700 hover:border-[#2F6FED] hover:text-[#2F6FED] text-[#6B7280] dark:text-gray-400 flex items-center justify-center hover:scale-105 active:scale-95 transition-all duration-150 min-touch cursor-pointer"
                      title="Edit Material"
                      aria-label="Edit"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setMaterialToDelete(mat)}
                      className="w-8 h-8 rounded-[8px] bg-white dark:bg-[#0B1220] border border-slate-200 dark:border-gray-700 hover:border-rose-300 hover:text-rose-600 text-[#6B7280] dark:text-gray-400 flex items-center justify-center hover:scale-105 active:scale-95 transition-all duration-150 min-touch cursor-pointer"
                      title="Delete Material"
                      aria-label="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </main>

      {/* Floating Action Button for Mobile (+ Add Material) */}
      <motion.button
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: [0.8, 1.1, 1], opacity: 1 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        whileTap={{ scale: 0.95 }}
        onClick={handleOpenAdd}
        className="sm:hidden lg:hidden fixed bottom-20 right-5 z-40 w-14 h-14 bg-[#2F6FED] hover:bg-blue-600 text-white rounded-full shadow-lg flex items-center justify-center transition-colors duration-150 print:hidden cursor-pointer"
        aria-label="Add Material"
        title="Add Material"
      >
        <Plus className="w-6 h-6 stroke-[2.5]" />
      </motion.button>

      {/* Add / Edit Material Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/50 dark:bg-black/75 backdrop-blur-xs"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="bg-white dark:bg-[#1A2332] border border-transparent dark:border-gray-700 rounded-t-[20px] sm:rounded-[16px] w-full max-w-[480px] p-5 shadow-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-gray-700/60">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-[8px] bg-blue-50 dark:bg-blue-950/50 text-[#2F6FED] flex items-center justify-center">
                    <Package className="w-4 h-4" />
                  </div>
                  <h3 className="text-[17px] font-bold text-[#0B1B3F] dark:text-white">
                    {editingMaterial ? 'Edit Material' : 'Add New Material'}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="w-8 h-8 flex items-center justify-center text-[#6B7280] dark:text-gray-400 hover:text-[#0B1B3F] dark:hover:text-white rounded-full hover:bg-slate-100 dark:hover:bg-gray-800 hover:scale-105 active:scale-95 transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {formError && (
                <div className="mt-3 p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-[10px] text-rose-700 dark:text-rose-300 text-[12px] flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <form onSubmit={handleFormSubmit} className="mt-4 space-y-3.5">
                {/* Material Name */}
                <div>
                  <label className="block text-[13px] font-semibold text-[#0B1B3F] dark:text-white mb-1">
                    Material Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Hydraulic Control Valve 25mm"
                    className="w-full px-3 py-2.5 bg-[#F3F5F9] dark:bg-[#0B1220] border border-slate-200/80 dark:border-gray-700 focus:border-[#2F6FED] focus:bg-white dark:focus:bg-[#0B1220] rounded-[10px] text-[14px] text-[#0B1B3F] dark:text-white placeholder-[#6B7280] dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#2F6FED]/20 transition-all min-touch"
                  />
                </div>

                {/* Unit and Rate Row */}
                <div className="grid grid-cols-2 gap-3">
                  {/* Unit */}
                  <div>
                    <label className="block text-[13px] font-semibold text-[#0B1B3F] dark:text-white mb-1">
                      Unit <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={formData.unitSelect}
                      onChange={(e) => setFormData({ ...formData, unitSelect: e.target.value })}
                      className="w-full px-3 py-2.5 bg-[#F3F5F9] dark:bg-[#0B1220] border border-slate-200/80 dark:border-gray-700 focus:border-[#2F6FED] focus:bg-white dark:focus:bg-[#0B1220] rounded-[10px] text-[14px] text-[#0B1B3F] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#2F6FED]/20 transition-all min-touch"
                    >
                      {STANDARD_UNITS.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Rate per Unit */}
                  <div>
                    <label className="block text-[13px] font-semibold text-[#0B1B3F] dark:text-white mb-1">
                      Rate / Unit (₹) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      required
                      inputMode="decimal"
                      value={formData.rate}
                      onChange={(e) => setFormData({ ...formData, rate: e.target.value })}
                      placeholder="e.g. 4500"
                      className="w-full px-3 py-2.5 bg-[#F3F5F9] dark:bg-[#0B1220] border border-slate-200/80 dark:border-gray-700 focus:border-[#2F6FED] focus:bg-white dark:focus:bg-[#0B1220] rounded-[10px] text-[14px] font-semibold text-[#0B1B3F] dark:text-white placeholder-[#6B7280] dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#2F6FED]/20 transition-all min-touch"
                    />
                  </div>
                </div>

                {/* Custom Unit Input if 'Custom' is selected */}
                {formData.unitSelect === 'Custom' && (
                  <div>
                    <label className="block text-[12px] font-semibold text-[#0B1B3F] dark:text-white mb-1">
                      Enter Custom Unit Name
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.customUnit}
                      onChange={(e) => setFormData({ ...formData, customUnit: e.target.value })}
                      placeholder="e.g. Rolls, Packs, Hours"
                      className="w-full px-3 py-2 bg-[#F3F5F9] dark:bg-[#0B1220] border border-slate-200/80 dark:border-gray-700 focus:border-[#2F6FED] focus:bg-white dark:focus:bg-[#0B1220] rounded-[10px] text-[13px] text-[#0B1B3F] dark:text-white placeholder-[#6B7280] dark:placeholder-gray-500 focus:outline-none min-touch"
                    />
                  </div>
                )}

                {/* Code / HSN */}
                <div>
                  <label className="block text-[13px] font-semibold text-[#0B1B3F] dark:text-white mb-1">
                    Item Code / HSN <span className="text-[11px] font-normal text-[#6B7280] dark:text-gray-400">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    placeholder="e.g. 8481 or MAT-101"
                    className="w-full px-3 py-2.5 bg-[#F3F5F9] dark:bg-[#0B1220] border border-slate-200/80 dark:border-gray-700 focus:border-[#2F6FED] focus:bg-white dark:focus:bg-[#0B1220] rounded-[10px] text-[14px] text-[#0B1B3F] dark:text-white placeholder-[#6B7280] dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#2F6FED]/20 transition-all min-touch"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-[13px] font-semibold text-[#0B1B3F] dark:text-white mb-1">
                    Description / Specification <span className="text-[11px] font-normal text-[#6B7280] dark:text-gray-400">(Optional)</span>
                  </label>
                  <textarea
                    rows={2}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Enter specifications, grade, or notes..."
                    className="w-full px-3 py-2 bg-[#F3F5F9] dark:bg-[#0B1220] border border-slate-200/80 dark:border-gray-700 focus:border-[#2F6FED] focus:bg-white dark:focus:bg-[#0B1220] rounded-[10px] text-[13px] text-[#0B1B3F] dark:text-white placeholder-[#6B7280] dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#2F6FED]/20"
                  />
                </div>

                {/* Buttons */}
                <div className="pt-2 flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="px-4 py-2.5 text-[13px] font-medium text-[#6B7280] dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-gray-800 rounded-[10px] active:scale-95 transition-all min-touch"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-5 py-2.5 bg-[#2F6FED] hover:bg-blue-600 hover:scale-[1.02] active:scale-95 hover:shadow-md text-white text-[13px] font-semibold rounded-[10px] shadow-xs flex items-center justify-center gap-1.5 transition-all duration-150 min-touch cursor-pointer"
                  >
                    {saving ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>{editingMaterial ? 'Update Material' : 'Save Material'}</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {materialToDelete && (
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
                Delete Material?
              </h3>
              <p className="text-[13px] text-[#6B7280] dark:text-gray-400 mt-2 leading-relaxed">
                Are you sure you want to delete <span className="font-bold text-[#0B1B3F] dark:text-white">{materialToDelete.name}</span>? Existing quotations using this item will NOT be affected.
              </p>
              <div className="mt-5 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setMaterialToDelete(null)}
                  className="px-4 py-2 text-[13px] font-medium text-[#6B7280] dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-gray-800 rounded-[10px] active:scale-95 transition-all min-touch"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmDelete}
                  disabled={deletingId !== null}
                  className="px-4 py-2 text-[13px] font-semibold bg-rose-600 hover:bg-rose-700 hover:scale-[1.02] active:scale-95 text-white rounded-[10px] min-touch flex items-center gap-1 transition-all duration-150 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {deletingId !== null ? 'Deleting...' : 'Delete'}
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
