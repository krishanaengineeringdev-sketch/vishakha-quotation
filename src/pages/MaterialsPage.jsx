import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  getMaterials,
  saveMaterial,
  deleteMaterial,
  updateMaterialStock,
  getMaterialCategories,
  saveMaterialCategory,
  deleteMaterialCategory,
  DEFAULT_MATERIAL_CATEGORIES
} from '../services/dataService';
import { uploadMaterialImage } from '../supabaseClient';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import BottomNav from '../components/BottomNav';
import CustomDropdown from '../components/CustomDropdown';
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
  Hash,
  Upload,
  Image as ImageIcon,
  FolderPlus,
  ChevronDown
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

function MaterialThumbnail({ src, alt, className = 'w-10 h-10', iconSize = 'w-5 h-5' }) {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [src]);

  if (!src || hasError) {
    return (
      <div className={`${className} rounded-[8px] overflow-hidden bg-slate-200/80 dark:bg-gray-800 border border-slate-200 dark:border-gray-700/80 shrink-0 flex items-center justify-center shadow-2xs`}>
        <Package className={`${iconSize} text-[#6B7280] dark:text-gray-400`} />
      </div>
    );
  }

  return (
    <div className={`${className} rounded-[8px] overflow-hidden bg-slate-200/80 dark:bg-gray-800 border border-slate-200 dark:border-gray-700/80 shrink-0 flex items-center justify-center shadow-2xs`}>
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

export default function MaterialsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [stockFilter, setStockFilter] = useState('All'); // 'All' | 'In Stock' | 'Out of Stock'
  const [toast, setToast] = useState(null); // { message: '', type: 'success' | 'error' }
  const [allMaterials, setAllMaterials] = useState([]);
  const [loading, setLoading] = useState(true);

  // Categories State
  const [categories, setCategories] = useState([]);
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingCatId, setEditingCatId] = useState(null);
  const [editingCatName, setEditingCatName] = useState('');
  const [categoryToDelete, setCategoryToDelete] = useState(null);
  const [categoryManagerError, setCategoryManagerError] = useState('');
  const [categoryManagerLoading, setCategoryManagerLoading] = useState(false);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    unitSelect: 'Nos',
    customUnit: '',
    rate: '',
    code: '',
    description: '',
    category: 'Furniture',
    category_id: null,
    image_url: '',
    in_stock: true,
    stock_qty: ''
  });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  // Inline Stock Qty editing state
  const [editingStockQtyId, setEditingStockQtyId] = useState(null);
  const [stockQtyInput, setStockQtyInput] = useState('');

  // Category addition state inside modal
  const [isAddingNewCategory, setIsAddingNewCategory] = useState(false);
  const [newCategoryInput, setNewCategoryInput] = useState('');

  // Image Upload state
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef(null);

  // Delete Confirm State
  const [deletingId, setDeletingId] = useState(null);
  const [materialToDelete, setMaterialToDelete] = useState(null);

  // Fetch categories from service
  const fetchCategories = useCallback(async () => {
    try {
      const list = await getMaterialCategories();
      setCategories(list || []);
    } catch (e) {
      console.warn('Error fetching categories:', e);
    }
  }, []);

  // Fetch all materials from Supabase / Dexie
  const fetchMaterials = useCallback(async () => {
    try {
      const data = await getMaterials('', 'All', 'All');
      setAllMaterials(data || []);
    } catch (e) {
      console.warn('Error fetching materials:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    fetchMaterials();
  }, [fetchMaterials]);

  // Re-fetch when connection restored
  useEffect(() => {
    const handleOnline = () => {
      fetchMaterials();
      fetchCategories();
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [fetchMaterials, fetchCategories]);

  // Compute item counts per category (and uncategorized) across all materials
  const categoryMaterialCounts = useMemo(() => {
    const counts = {};
    let uncategorized = 0;

    allMaterials.forEach((m) => {
      if (
        !m.category_id &&
        (!m.category || m.category.trim() === '' || m.category.trim().toLowerCase() === 'uncategorized')
      ) {
        uncategorized++;
      } else {
        const cat = categories.find(
          (c) =>
            c.id === m.category_id ||
            (m.category && c.name.toLowerCase().trim() === m.category.toLowerCase().trim())
        );
        if (cat) {
          counts[cat.id] = (counts[cat.id] || 0) + 1;
        } else if (m.category_id) {
          counts[m.category_id] = (counts[m.category_id] || 0) + 1;
        } else {
          uncategorized++;
        }
      }
    });

    return { counts, uncategorized, total: allMaterials.length };
  }, [allMaterials, categories]);

  // Filtered materials for grid / list view
  const materials = useMemo(() => {
    let result = [...allMaterials];

    if (selectedCategory && selectedCategory !== 'All') {
      result = result.filter(
        (m) =>
          m.category_id === selectedCategory ||
          (m.category && m.category.toLowerCase().trim() === selectedCategory.toLowerCase().trim())
      );
    }

    if (stockFilter === 'In Stock') {
      result = result.filter((m) => m.in_stock !== false);
    } else if (stockFilter === 'Out of Stock') {
      result = result.filter((m) => m.in_stock === false);
    }

    if (searchQuery && searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (m) =>
          (m.name || '').toLowerCase().includes(q) ||
          (m.code || '').toLowerCase().includes(q) ||
          (m.category || '').toLowerCase().includes(q) ||
          (m.description || '').toLowerCase().includes(q)
      );
    }

    return result;
  }, [allMaterials, selectedCategory, stockFilter, searchQuery]);

  const showNotification = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Toggle in_stock status per material
  const handleToggleStock = async (mat, e) => {
    e?.stopPropagation();
    const nextInStock = mat.in_stock === false ? true : false;

    // Optimistic UI update
    setAllMaterials((prev) =>
      prev.map((m) =>
        (m.id && m.id === mat.id) || (m.localId && m.localId === mat.localId)
          ? { ...m, in_stock: nextInStock }
          : m
      )
    );

    try {
      await updateMaterialStock(mat, { in_stock: nextInStock });
      showNotification(
        `"${mat.name}" is now marked as ${nextInStock ? 'In Stock' : 'Out of Stock'}`,
        'success'
      );
    } catch (err) {
      console.error('Failed to toggle stock status:', err);
      showNotification('Failed to update stock status', 'error');
      fetchMaterials();
    }
  };

  // Start inline editing of Stock Quantity
  const handleStartEditStockQty = (mat, e) => {
    e?.stopPropagation();
    setEditingStockQtyId(mat.id || mat.localId);
    setStockQtyInput(
      mat.stock_qty !== undefined && mat.stock_qty !== null ? String(mat.stock_qty) : ''
    );
  };

  // Save inline edited Stock Quantity
  const handleSaveStockQty = async (mat) => {
    const raw = stockQtyInput.trim();
    const parsed = raw === '' ? null : parseFloat(raw);
    if (parsed !== null && (isNaN(parsed) || parsed < 0)) {
      showNotification('Please enter a valid non-negative quantity', 'error');
      setEditingStockQtyId(null);
      return;
    }

    setEditingStockQtyId(null);

    // Optimistic update
    setAllMaterials((prev) =>
      prev.map((m) =>
        (m.id && m.id === mat.id) || (m.localId && m.localId === mat.localId)
          ? { ...m, stock_qty: parsed }
          : m
      )
    );

    try {
      await updateMaterialStock(mat, { stock_qty: parsed });
      showNotification(
        parsed !== null
          ? `Stock updated for "${mat.name}": ${parsed} ${mat.unit || 'Nos'}`
          : `Stock quantity cleared for "${mat.name}"`,
        'success'
      );
    } catch (err) {
      console.error('Failed to save stock quantity:', err);
      showNotification('Failed to update stock quantity', 'error');
      fetchMaterials();
    }
  };

  // Pre-fill form data whenever editingMaterial changes
  useEffect(() => {
    if (editingMaterial) {
      const isStandard =
        editingMaterial.unit &&
        STANDARD_UNITS.filter((u) => u !== 'Custom').includes(editingMaterial.unit);
      const matchedCat = categories.find(
        (c) =>
          (editingMaterial.category_id && c.id === editingMaterial.category_id) ||
          (editingMaterial.category && c.name.toLowerCase().trim() === editingMaterial.category.toLowerCase().trim())
      );
      setFormData({
        name: editingMaterial.name || '',
        unitSelect: isStandard ? editingMaterial.unit : (editingMaterial.unit ? 'Custom' : 'Nos'),
        customUnit: isStandard ? '' : (editingMaterial.unit || ''),
        rate:
          editingMaterial.rate !== undefined && editingMaterial.rate !== null
            ? String(editingMaterial.rate)
            : '',
        code: editingMaterial.code || editingMaterial.hsn || '',
        description: editingMaterial.description || '',
        category: matchedCat?.name || editingMaterial.category || 'Furniture',
        category_id: matchedCat?.id || editingMaterial.category_id || null,
        image_url: editingMaterial.image_url || '',
        in_stock: editingMaterial.in_stock !== false,
        stock_qty:
          editingMaterial.stock_qty !== undefined && editingMaterial.stock_qty !== null
            ? String(editingMaterial.stock_qty)
            : ''
      });
    }
  }, [editingMaterial, categories]);

  const handleOpenAdd = () => {
    setEditingMaterial(null);
    const defaultCat = categories.find((c) => c.id === selectedCategory) || categories[0] || null;
    setFormData({
      name: '',
      unitSelect: 'Nos',
      customUnit: '',
      rate: '',
      code: '',
      description: '',
      category: defaultCat?.name || 'Furniture',
      category_id: defaultCat?.id || null,
      image_url: '',
      in_stock: true,
      stock_qty: ''
    });
    setIsAddingNewCategory(false);
    setNewCategoryInput('');
    setFormError('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (mat) => {
    if (!mat) return;
    setEditingMaterial(mat);
    const isStandard =
      mat.unit && STANDARD_UNITS.filter((u) => u !== 'Custom').includes(mat.unit);
    const matchedCat = categories.find(
      (c) =>
        (mat.category_id && c.id === mat.category_id) ||
        (mat.category && c.name.toLowerCase().trim() === mat.category.toLowerCase().trim())
    );
    setFormData({
      name: mat.name || '',
      unitSelect: isStandard ? mat.unit : (mat.unit ? 'Custom' : 'Nos'),
      customUnit: isStandard ? '' : (mat.unit || ''),
      rate: mat.rate !== undefined && mat.rate !== null ? String(mat.rate) : '',
      code: mat.code || mat.hsn || '',
      description: mat.description || '',
      category: matchedCat?.name || mat.category || 'Furniture',
      category_id: matchedCat?.id || mat.category_id || null,
      image_url: mat.image_url || '',
      in_stock: mat.in_stock !== false,
      stock_qty:
        mat.stock_qty !== undefined && mat.stock_qty !== null ? String(mat.stock_qty) : ''
    });
    setIsAddingNewCategory(false);
    setNewCategoryInput('');
    setFormError('');
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingMaterial(null);
    setIsAddingNewCategory(false);
    setNewCategoryInput('');
    setFormError('');
  };

  // Category Manager Modal Action Handlers
  const handleCreateCategoryFromManager = async (e) => {
    e.preventDefault();
    const trimmed = newCategoryName.trim();
    if (!trimmed) {
      setCategoryManagerError('Category name cannot be empty');
      return;
    }

    setCategoryManagerLoading(true);
    setCategoryManagerError('');
    try {
      const created = await saveMaterialCategory({ name: trimmed });
      await fetchCategories();
      setNewCategoryName('');
      showNotification(`Category "${created.name}" created`, 'success');
    } catch (err) {
      setCategoryManagerError(err.message || 'Failed to add category');
    } finally {
      setCategoryManagerLoading(false);
    }
  };

  const handleSaveRenameCategory = async (cat) => {
    const trimmed = editingCatName.trim();
    if (!trimmed) {
      setCategoryManagerError('Category name cannot be empty');
      return;
    }
    if (trimmed.toLowerCase() === cat.name.toLowerCase()) {
      setEditingCatId(null);
      return;
    }

    setCategoryManagerLoading(true);
    setCategoryManagerError('');
    try {
      const updated = await saveMaterialCategory({
        id: cat.id,
        localId: cat.localId,
        name: trimmed
      });
      await fetchCategories();
      await fetchMaterials();
      setEditingCatId(null);
      showNotification(`Category renamed to "${updated.name}"`, 'success');
    } catch (err) {
      setCategoryManagerError(err.message || 'Failed to rename category');
    } finally {
      setCategoryManagerLoading(false);
    }
  };

  const handleExecuteDeleteCategory = async (cat) => {
    setCategoryManagerLoading(true);
    setCategoryManagerError('');
    try {
      await deleteMaterialCategory(cat);
      if (selectedCategory === cat.id || selectedCategory === cat.name) {
        setSelectedCategory('All');
      }
      await fetchCategories();
      await fetchMaterials();
      setCategoryToDelete(null);
      showNotification(`Deleted "${cat.name}". Materials moved to Uncategorized.`, 'success');
    } catch (err) {
      setCategoryManagerError(err.message || 'Failed to delete category');
    } finally {
      setCategoryManagerLoading(false);
    }
  };


  const handleImageFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input so same file can be re-selected if needed
    e.target.value = '';

    setUploadingImage(true);
    setFormError('');
    try {
      const publicUrl = await uploadMaterialImage(file);
      if (publicUrl) {
        setFormData((prev) => ({ ...prev, image_url: publicUrl }));
        showNotification('Material image uploaded successfully', 'success');
      } else {
        setFormError('Failed to upload image. Please try again.');
      }
    } catch (err) {
      console.error('Image upload error:', err);
      setFormError('Error processing image. Please try again.');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleRemoveImage = () => {
    setFormData((prev) => ({ ...prev, image_url: '' }));
  };

  const handleAddNewCategoryConfirm = async () => {
    const trimmed = newCategoryInput.trim();
    if (!trimmed) {
      setIsAddingNewCategory(false);
      return;
    }
    try {
      const created = await saveMaterialCategory({ name: trimmed });
      await fetchCategories();
      setFormData((prev) => ({
        ...prev,
        category_id: created.id,
        category: created.name
      }));
      showNotification(`Added category "${created.name}"`, 'success');
    } catch (err) {
      showNotification(err.message || 'Failed to add category', 'error');
    } finally {
      setIsAddingNewCategory(false);
      setNewCategoryInput('');
    }
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

    let finalCategoryId = formData.category_id || null;
    let finalCategory = (formData.category || '').trim();

    if (isAddingNewCategory && newCategoryInput.trim()) {
      try {
        const createdCat = await saveMaterialCategory({ name: newCategoryInput.trim() });
        await fetchCategories();
        finalCategoryId = createdCat.id;
        finalCategory = createdCat.name;
      } catch (catErr) {
        setFormError(catErr.message || 'Failed to create category');
        return;
      }
    } else if (finalCategoryId) {
      const match = categories.find((c) => c.id === finalCategoryId);
      if (match) finalCategory = match.name;
    } else if (finalCategory) {
      const match = categories.find((c) => c.name.toLowerCase().trim() === finalCategory.toLowerCase().trim());
      if (match) finalCategoryId = match.id;
    }

    setSaving(true);
    try {
      await saveMaterial({
        id: editingMaterial?.id || null,
        localId: editingMaterial?.localId || null,
        name: trimmedName,
        unit,
        rate: rateNum,
        code: formData.code.trim(),
        description: formData.description.trim(),
        category: finalCategory || null,
        category_id: finalCategoryId || null,
        image_url: formData.image_url || null,
        in_stock: formData.in_stock !== false,
        stock_qty:
          formData.stock_qty !== undefined &&
          formData.stock_qty !== null &&
          formData.stock_qty !== ''
            ? parseFloat(formData.stock_qty)
            : null
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
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
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#6B7280] dark:text-gray-400 hover:text-[#0B1B3F] dark:hover:text-white active:scale-95 transition-transform cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Desktop + Add Material Button */}
            <button
              type="button"
              onClick={handleOpenAdd}
              className="hidden sm:inline-flex items-center gap-1.5 h-10 px-4 bg-[#2F6FED] hover:bg-blue-600 hover:scale-[1.02] active:scale-95 hover:shadow-md text-white text-[13px] font-semibold rounded-[10px] shadow-xs transition-all duration-150 shrink-0 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Material</span>
            </button>
          </div>
        </div>

        {/* Category & Inventory Stock Filters Bar */}
        <div className="flex flex-col gap-3 mb-5 pb-3 border-b border-slate-100 dark:border-gray-800">
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            {/* Stock Filter Pills: All / In Stock / Out of Stock */}
            <div className="flex items-center gap-1 p-1 bg-[#F3F5F9] dark:bg-[#1A2332] rounded-[10px] border border-slate-200/60 dark:border-gray-800 w-fit">
              <button
                type="button"
                onClick={() => setStockFilter('All')}
                className={`px-3 py-1.5 rounded-[7px] text-[12px] font-semibold transition-all cursor-pointer ${
                  stockFilter === 'All'
                    ? 'bg-white dark:bg-[#0B1220] text-[#0B1B3F] dark:text-white shadow-xs'
                    : 'text-[#6B7280] dark:text-gray-400 hover:text-[#0B1B3F] dark:hover:text-white'
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setStockFilter('In Stock')}
                className={`px-3 py-1.5 rounded-[7px] text-[12px] font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                  stockFilter === 'In Stock'
                    ? 'bg-white dark:bg-[#0B1220] text-emerald-600 dark:text-emerald-400 shadow-xs'
                    : 'text-[#6B7280] dark:text-gray-400 hover:text-emerald-600'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                <span>In Stock</span>
              </button>
              <button
                type="button"
                onClick={() => setStockFilter('Out of Stock')}
                className={`px-3 py-1.5 rounded-[7px] text-[12px] font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                  stockFilter === 'Out of Stock'
                    ? 'bg-white dark:bg-[#0B1220] text-rose-600 dark:text-rose-400 shadow-xs'
                    : 'text-[#6B7280] dark:text-gray-400 hover:text-rose-600'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                <span>Out of Stock</span>
              </button>
            </div>

            {/* Manage Categories Button */}
            <button
              type="button"
              onClick={() => {
                setCategoryManagerError('');
                setNewCategoryName('');
                setEditingCatId(null);
                setCategoryToDelete(null);
                setIsCategoryManagerOpen(true);
              }}
              className="h-8 px-2.5 py-1 bg-white dark:bg-[#1A2332] border border-slate-200/80 dark:border-gray-700 hover:border-[#2F6FED] dark:hover:border-[#2F6FED] text-[#2F6FED] rounded-[8px] text-[12px] font-semibold flex items-center gap-1.5 transition-all shadow-2xs hover:shadow-xs cursor-pointer min-touch shrink-0"
              title="Manage Categories"
            >
              <Layers className="w-3.5 h-3.5 shrink-0" />
              <span>Manage Categories</span>
            </button>
          </div>

          {/* Scrollable Category Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full no-scrollbar">
            <button
              type="button"
              onClick={() => setSelectedCategory('All')}
              className={`px-3 py-1.5 rounded-full text-[12px] font-semibold transition-all shrink-0 cursor-pointer min-touch flex items-center gap-1.5 ${
                selectedCategory === 'All'
                  ? 'bg-[#2F6FED] text-white shadow-xs'
                  : 'bg-[#F3F5F9] dark:bg-[#1A2332] text-[#6B7280] dark:text-gray-400 hover:text-[#0B1B3F] dark:hover:text-white border border-transparent dark:border-gray-800'
              }`}
            >
              <span>All Categories</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  selectedCategory === 'All'
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-200 dark:bg-gray-800 text-[#6B7280] dark:text-gray-400'
                }`}
              >
                {categoryMaterialCounts.total}
              </span>
            </button>

            {categories.map((cat) => {
              const count = categoryMaterialCounts.counts[cat.id] || 0;
              const isSelected = selectedCategory === cat.id || selectedCategory === cat.name;
              return (
                <button
                  key={cat.id || cat.localId}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3 py-1.5 rounded-full text-[12px] font-semibold transition-all shrink-0 cursor-pointer min-touch flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-[#2F6FED] text-white shadow-xs'
                      : 'bg-[#F3F5F9] dark:bg-[#1A2332] text-[#6B7280] dark:text-gray-400 hover:text-[#0B1B3F] dark:hover:text-white border border-transparent dark:border-gray-800'
                  }`}
                >
                  <Tag className="w-3 h-3 opacity-70" />
                  <span>{cat.name}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                      isSelected
                        ? 'bg-white/20 text-white'
                        : 'bg-slate-200 dark:bg-gray-800 text-[#6B7280] dark:text-gray-400'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}

            {/* Uncategorized Option */}
            {(categoryMaterialCounts.uncategorized > 0 || selectedCategory === 'Uncategorized') && (
              <button
                type="button"
                onClick={() => setSelectedCategory('Uncategorized')}
                className={`px-3 py-1.5 rounded-full text-[12px] font-semibold transition-all shrink-0 cursor-pointer min-touch flex items-center gap-1.5 ${
                  selectedCategory === 'Uncategorized'
                    ? 'bg-[#2F6FED] text-white shadow-xs'
                    : 'bg-[#F3F5F9] dark:bg-[#1A2332] text-[#6B7280] dark:text-gray-400 hover:text-[#0B1B3F] dark:hover:text-white border border-transparent dark:border-gray-800'
                }`}
              >
                <span>Uncategorized</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    selectedCategory === 'Uncategorized'
                      ? 'bg-white/20 text-white'
                      : 'bg-slate-200 dark:bg-gray-800 text-[#6B7280] dark:text-gray-400'
                  }`}
                >
                  {categoryMaterialCounts.uncategorized}
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Materials Skeleton Grid */}
        {loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3.5 pt-1">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <div
                key={n}
                className="bg-[#F3F5F9] dark:bg-[#1A2332] border border-slate-200/80 dark:border-gray-800 rounded-[12px] p-3.5 flex flex-col justify-between shadow-xs"
              >
                <div>
                  <div className="flex items-start gap-3">
                    {/* 40x40 Thumbnail Skeleton */}
                    <div className="w-10 h-10 skeleton rounded-[8px] shrink-0" />

                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="h-4 w-28 sm:w-36 skeleton rounded-[5px]" />
                        <div className="h-4 w-16 skeleton rounded-[5px]" />
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="h-3.5 w-16 skeleton rounded-[5px]" />
                        <div className="h-3 w-14 skeleton rounded-[4px]" />
                      </div>
                    </div>
                  </div>

                  {/* Description skeleton line */}
                  <div className="h-3 w-4/5 skeleton rounded-[4px] mt-2.5" />
                </div>

                {/* Bottom Bar Skeleton */}
                <div className="mt-3.5 pt-2.5 border-t border-slate-200/60 dark:border-gray-800/80 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <div className="h-6 w-20 skeleton rounded-full" />
                    <div className="h-6 w-16 skeleton rounded-full" />
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <div className="w-7 h-7 skeleton rounded-[6px]" />
                    <div className="w-7 h-7 skeleton rounded-[6px]" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : materials.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center bg-[#F3F5F9] dark:bg-[#1A2332] rounded-[16px] border border-dashed border-slate-200 dark:border-gray-700 max-w-md mx-auto">
            <div className="w-12 h-12 rounded-full bg-white dark:bg-[#0B1220] flex items-center justify-center text-[#2F6FED] mb-3 shadow-xs">
              <Package className="w-6 h-6" />
            </div>
            <h3 className="text-[16px] font-bold text-[#0B1B3F] dark:text-white">
              {searchQuery || selectedCategory !== 'All' || stockFilter !== 'All'
                ? 'No Matching Materials'
                : 'No Materials Yet'}
            </h3>
            <p className="text-[13px] text-[#6B7280] dark:text-gray-400 max-w-xs mt-1">
              {searchQuery || selectedCategory !== 'All' || stockFilter !== 'All'
                ? `No materials found matching ${stockFilter !== 'All' ? `"${stockFilter}"` : ''} ${selectedCategory !== 'All' ? `category "${selectedCategory}"` : ''} ${searchQuery ? `query "${searchQuery}"` : ''}. Try another filter or add a new material.`
                : 'Add your product catalog items with rates and photos to quickly select them when creating quotations.'}
            </p>
            <button
              type="button"
              onClick={handleOpenAdd}
              className="mt-4 px-4 py-2 bg-[#2F6FED] text-white text-[13px] font-semibold rounded-[10px] flex items-center gap-1.5 shadow-xs hover:bg-blue-600 hover:scale-[1.02] active:scale-95 hover:shadow-md transition-all duration-150 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Material</span>
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
                key={mat.id || mat.localId}
                variants={cardVariants}
                whileTap={{ scale: 0.99 }}
                role="button"
                tabIndex={0}
                onClick={() => handleOpenEdit(mat)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleOpenEdit(mat);
                  }
                }}
                className="bg-[#F3F5F9] dark:bg-[#1A2332] hover:bg-slate-100/90 dark:hover:bg-[#202C3F] border border-slate-200/80 dark:border-gray-800 rounded-[12px] p-3.5 transition-all duration-200 shadow-xs hover:shadow-md hover:-translate-y-0.5 hover:border-slate-300 dark:hover:border-gray-700 flex flex-col justify-between cursor-pointer select-none"
              >
                <div>
                  <div className="flex items-start gap-3">
                    {/* 40x40px Material Thumbnail with graceful fallback */}
                    <MaterialThumbnail src={mat.image_url} alt={mat.name} />

                    {/* Material Info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center flex-wrap gap-1.5 mb-1">
                        <h3 className="text-[15px] font-bold text-[#0B1B3F] dark:text-white leading-snug break-words">
                          {mat.name}
                        </h3>
                        {(() => {
                          const catName = categories.find((c) => c.id === mat.category_id)?.name || mat.category;
                          if (catName) {
                            return (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-[#2F6FED] border border-blue-200/60 dark:border-blue-900/60">
                                <Tag className="w-2.5 h-2.5" />
                                <span>{catName}</span>
                              </span>
                            );
                          }
                          return (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 dark:bg-gray-800 text-[#6B7280] dark:text-gray-400">
                              <span>Uncategorized</span>
                            </span>
                          );
                        })()}
                        {(mat.code || mat.hsn) && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-gray-800 text-[#6B7280] dark:text-gray-400">
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
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenEdit(mat);
                        }}
                        className="w-8 h-8 rounded-[8px] bg-white dark:bg-[#0B1220] border border-slate-200 dark:border-gray-700 hover:border-[#2F6FED] hover:text-[#2F6FED] text-[#6B7280] dark:text-gray-400 flex items-center justify-center hover:scale-105 active:scale-95 transition-all duration-150 min-touch cursor-pointer"
                        title="Edit Material"
                        aria-label="Edit"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setMaterialToDelete(mat);
                        }}
                        className="w-8 h-8 rounded-[8px] bg-white dark:bg-[#0B1220] border border-slate-200 dark:border-gray-700 hover:border-rose-300 hover:text-rose-600 text-[#6B7280] dark:text-gray-400 flex items-center justify-center hover:scale-105 active:scale-95 transition-all duration-150 min-touch cursor-pointer"
                        title="Delete Material"
                        aria-label="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Inventory Status & Toggle Switch Row */}
                <div
                  className="mt-3 pt-2.5 border-t border-slate-200/60 dark:border-gray-800 flex items-center justify-between gap-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center gap-2 flex-wrap min-w-0">
                    {/* Visual Status Indicator: Green Dot / Red Dot */}
                    <span
                      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                        mat.in_stock !== false
                          ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border-emerald-200/60 dark:border-emerald-800/60'
                          : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border-rose-200/60 dark:border-rose-800/60'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          mat.in_stock !== false ? 'bg-emerald-500' : 'bg-rose-500'
                        }`}
                      />
                      <span>{mat.in_stock !== false ? 'In Stock' : 'Out of Stock'}</span>
                    </span>

                    {/* Stock Qty (Inline Editable) */}
                    {editingStockQtyId === (mat.id || mat.localId) ? (
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={stockQtyInput}
                          onChange={(e) => setStockQtyInput(e.target.value)}
                          placeholder="Qty"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveStockQty(mat);
                            if (e.key === 'Escape') setEditingStockQtyId(null);
                          }}
                          className="w-16 px-1.5 py-0.5 bg-white dark:bg-[#0B1220] border border-[#2F6FED] rounded-[6px] text-[11px] font-medium text-[#0B1B3F] dark:text-white focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveStockQty(mat)}
                          className="w-5 h-5 flex items-center justify-center rounded bg-[#2F6FED] text-white hover:bg-blue-600 cursor-pointer"
                          title="Save quantity"
                        >
                          <Check className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingStockQtyId(null)}
                          className="w-5 h-5 flex items-center justify-center rounded text-[#6B7280] hover:text-[#0B1B3F] dark:hover:text-white cursor-pointer"
                          title="Cancel"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => handleStartEditStockQty(mat, e)}
                        className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-[6px] bg-slate-100 dark:bg-gray-800 text-[#6B7280] dark:text-gray-300 hover:text-[#2F6FED] dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 border border-slate-200/60 dark:border-gray-700/60 transition-colors cursor-pointer"
                        title="Click to edit stock count"
                      >
                        {mat.stock_qty !== undefined && mat.stock_qty !== null && mat.stock_qty !== '' ? (
                          <span>Qty: <strong className="text-[#0B1B3F] dark:text-white">{mat.stock_qty}</strong></span>
                        ) : (
                          <span className="opacity-75">+ Add Qty</span>
                        )}
                        <Edit2 className="w-2.5 h-2.5 opacity-60" />
                      </button>
                    )}
                  </div>

                  {/* Toggle Switch */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[11px] text-[#6B7280] dark:text-gray-400 font-medium hidden xs:inline">
                      {mat.in_stock !== false ? 'In Stock' : 'Out'}
                    </span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={mat.in_stock !== false}
                      onClick={(e) => handleToggleStock(mat, e)}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#2F6FED]/30 ${
                        mat.in_stock !== false ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-gray-700'
                      }`}
                      title={mat.in_stock !== false ? 'Toggle to mark Out of Stock' : 'Toggle to mark In Stock'}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                          mat.in_stock !== false ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
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
              className="bg-white dark:bg-[#1A2332] border border-transparent dark:border-gray-700 rounded-t-[20px] sm:rounded-[16px] w-full max-w-[500px] p-5 shadow-2xl max-h-[90vh] overflow-y-auto"
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

                {/* Category Selection with Inline New Category Creation */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[13px] font-semibold text-[#0B1B3F] dark:text-white">
                      Category
                    </label>
                    {!isAddingNewCategory && (
                      <button
                        type="button"
                        onClick={() => setIsAddingNewCategory(true)}
                        className="text-[11px] font-medium text-[#2F6FED] hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <FolderPlus className="w-3.5 h-3.5" />
                        <span>+ Add New Category</span>
                      </button>
                    )}
                  </div>

                  {isAddingNewCategory ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={newCategoryInput}
                        onChange={(e) => setNewCategoryInput(e.target.value)}
                        placeholder="e.g. Fabrication, Furniture, Hardware"
                        autoFocus
                        className="flex-1 px-3 py-2 bg-[#F3F5F9] dark:bg-[#0B1220] border border-slate-200/80 dark:border-gray-700 focus:border-[#2F6FED] rounded-[10px] text-[13px] text-[#0B1B3F] dark:text-white placeholder-[#6B7280] dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#2F6FED]/20"
                      />
                      <button
                        type="button"
                        onClick={handleAddNewCategoryConfirm}
                        className="px-3 py-2 bg-[#2F6FED] text-white text-[12px] font-semibold rounded-[8px] hover:bg-blue-600 transition-colors cursor-pointer"
                      >
                        Add
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsAddingNewCategory(false);
                          setNewCategoryInput('');
                        }}
                        className="px-2.5 py-2 text-[12px] text-[#6B7280] dark:text-gray-400 hover:text-[#0B1B3F] dark:hover:text-white cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <CustomDropdown
                      value={formData.category_id || formData.category || 'Select Category'}
                      onChange={(catVal) => {
                        const selectedCat = categories.find((c) => c.id === catVal || c.name === catVal);
                        setFormData({
                          ...formData,
                          category_id: selectedCat?.id || (catVal !== 'Uncategorized' ? catVal : null),
                          category: selectedCat?.name || (catVal !== 'Uncategorized' ? catVal : '')
                        });
                      }}
                      options={categories.map((c) => ({ label: c.name, value: c.id }))}
                      placeholder="Select Category"
                      icon={Tag}
                      footerAction={{
                        label: 'Add New Category...',
                        icon: Plus,
                        onClick: () => setIsAddingNewCategory(true)
                      }}
                    />
                  )}
                </div>

                {/* Material Image Upload */}
                <div>
                  <label className="block text-[13px] font-semibold text-[#0B1B3F] dark:text-white mb-1">
                    Material Image <span className="text-[11px] font-normal text-[#6B7280] dark:text-gray-400">(Optional thumbnail)</span>
                  </label>

                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    onChange={handleImageFileChange}
                    className="hidden"
                  />

                  {formData.image_url ? (
                    <div className="flex items-center gap-3 p-2.5 bg-[#F3F5F9] dark:bg-[#0B1220] border border-slate-200/80 dark:border-gray-700 rounded-[10px]">
                      <MaterialThumbnail
                        src={formData.image_url}
                        alt="Material thumbnail preview"
                        className="w-12 h-12"
                        iconSize="w-6 h-6"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-medium text-[#0B1B3F] dark:text-white truncate">
                          Image attached
                        </p>
                        <p className="text-[11px] text-[#6B7280] dark:text-gray-400">
                          Saved in catalog & item picker
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploadingImage}
                          className="px-2.5 py-1 text-[11px] font-semibold text-[#2F6FED] bg-white dark:bg-[#1A2332] border border-slate-200 dark:border-gray-700 rounded-[6px] hover:bg-blue-50 dark:hover:bg-blue-950/50 cursor-pointer"
                        >
                          Change
                        </button>
                        <button
                          type="button"
                          onClick={handleRemoveImage}
                          className="p-1 text-[#6B7280] dark:text-gray-400 hover:text-rose-600 dark:hover:text-rose-400 rounded cursor-pointer"
                          title="Remove image"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingImage}
                      className="w-full py-3 px-4 border-2 border-dashed border-slate-200 dark:border-gray-700 hover:border-[#2F6FED] dark:hover:border-blue-500 rounded-[10px] flex items-center justify-center gap-2 text-[#6B7280] dark:text-gray-400 hover:text-[#2F6FED] dark:hover:text-blue-400 transition-colors bg-[#F3F5F9]/50 dark:bg-[#0B1220]/50 cursor-pointer min-touch"
                    >
                      {uploadingImage ? (
                        <>
                          <div className="w-4 h-4 border-2 border-[#2F6FED] border-t-transparent rounded-full animate-spin" />
                          <span className="text-[13px] font-medium text-[#2F6FED]">Uploading image...</span>
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4" />
                          <span className="text-[13px] font-medium">Upload Material Photo (PNG, JPG, WebP)</span>
                        </>
                      )}
                    </button>
                  )}
                </div>

                {/* Unit and Rate Row */}
                <div className="grid grid-cols-2 gap-3">
                  {/* Unit */}
                  <div>
                    <label className="block text-[13px] font-semibold text-[#0B1B3F] dark:text-white mb-1">
                      Unit <span className="text-rose-500">*</span>
                    </label>
                    <CustomDropdown
                      value={formData.unitSelect}
                      onChange={(val) => setFormData({ ...formData, unitSelect: val })}
                      options={STANDARD_UNITS}
                      placeholder="Select Unit"
                    />
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

                {/* Inventory & Stock Tracking */}
                <div className="p-3 bg-[#F3F5F9] dark:bg-[#0B1220] rounded-[10px] border border-slate-200/80 dark:border-gray-700 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-[13px] font-semibold text-[#0B1B3F] dark:text-white flex items-center gap-1.5">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            formData.in_stock ? 'bg-emerald-500' : 'bg-rose-500'
                          }`}
                        />
                        <span>Inventory Status</span>
                      </label>
                      <p className="text-[11px] text-[#6B7280] dark:text-gray-400">
                        {formData.in_stock ? 'In Stock (Available for selection)' : 'Out of Stock'}
                      </p>
                    </div>

                    <button
                      type="button"
                      role="switch"
                      aria-checked={formData.in_stock}
                      onClick={() => setFormData({ ...formData, in_stock: !formData.in_stock })}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#2F6FED]/30 ${
                        formData.in_stock ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-gray-700'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                          formData.in_stock ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  <div>
                    <label className="block text-[12px] font-medium text-[#0B1B3F] dark:text-white mb-1">
                      Stock Quantity <span className="text-[11px] font-normal text-[#6B7280] dark:text-gray-400">(Optional count)</span>
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={formData.stock_qty}
                      onChange={(e) => setFormData({ ...formData, stock_qty: e.target.value })}
                      placeholder="e.g. 50 (leave empty to use toggle alone)"
                      className="w-full px-3 py-2 bg-white dark:bg-[#1A2332] border border-slate-200/80 dark:border-gray-700 focus:border-[#2F6FED] rounded-[8px] text-[13px] text-[#0B1B3F] dark:text-white placeholder-[#6B7280] dark:placeholder-gray-500 focus:outline-none"
                    />
                  </div>
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
                    disabled={saving || uploadingImage}
                    className="px-5 py-2.5 bg-[#2F6FED] hover:bg-blue-600 hover:scale-[1.02] active:scale-95 hover:shadow-md text-white text-[13px] font-semibold rounded-[10px] shadow-xs flex items-center justify-center gap-1.5 transition-all duration-150 min-touch cursor-pointer disabled:opacity-60"
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

      {/* Manage Categories Modal */}
      <AnimatePresence>
        {isCategoryManagerOpen && (
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
              className="bg-white dark:bg-[#1A2332] border border-transparent dark:border-gray-700 rounded-t-[20px] sm:rounded-[16px] w-full max-w-[500px] p-5 shadow-2xl max-h-[90vh] flex flex-col"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-gray-700/60">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-[8px] bg-blue-50 dark:bg-blue-950/50 text-[#2F6FED] flex items-center justify-center">
                    <Layers className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-[17px] font-bold text-[#0B1B3F] dark:text-white leading-tight">
                      Manage Categories
                    </h3>
                    <p className="text-[11px] text-[#6B7280] dark:text-gray-400">
                      Add, rename, or delete material categories
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsCategoryManagerOpen(false);
                    setCategoryToDelete(null);
                    setEditingCatId(null);
                    setCategoryManagerError('');
                  }}
                  className="w-8 h-8 flex items-center justify-center text-[#6B7280] dark:text-gray-400 hover:text-[#0B1B3F] dark:hover:text-white rounded-full hover:bg-slate-100 dark:hover:bg-gray-800 transition-all cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Add New Category Row */}
              <div className="pt-3.5 pb-2">
                <form onSubmit={handleCreateCategoryFromManager} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newCategoryName}
                    onChange={(e) => {
                      setNewCategoryName(e.target.value);
                      if (categoryManagerError) setCategoryManagerError('');
                    }}
                    placeholder="Enter category name (e.g. Paints, Packaging)..."
                    className="flex-1 px-3 py-2 bg-[#F3F5F9] dark:bg-[#0B1220] border border-slate-200/80 dark:border-gray-700 focus:border-[#2F6FED] focus:bg-white dark:focus:bg-[#0B1220] rounded-[10px] text-[13px] text-[#0B1B3F] dark:text-white placeholder-[#6B7280] dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#2F6FED]/20"
                  />
                  <button
                    type="submit"
                    disabled={categoryManagerLoading || !newCategoryName.trim()}
                    className="px-4 py-2 bg-[#2F6FED] hover:bg-blue-600 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-white text-[12px] font-semibold rounded-[10px] shadow-xs flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add</span>
                  </button>
                </form>

                {categoryManagerError && (
                  <div className="mt-2 p-2 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-[8px] text-rose-700 dark:text-rose-300 text-[11px] flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{categoryManagerError}</span>
                  </div>
                )}
              </div>

              {/* Delete Warning Prompt */}
              {categoryToDelete && (
                <div className="mt-2 p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-[10px] text-[12px] space-y-2">
                  <div className="flex items-start gap-2 text-amber-800 dark:text-amber-300">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">
                        Delete &quot;{categoryToDelete.name}&quot;?
                      </p>
                      <p className="text-[11px] text-amber-700/90 dark:text-amber-400/90 mt-0.5">
                        Materials in this category will become <span className="font-bold underline">Uncategorized</span>. (Materials won&apos;t be deleted).
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setCategoryToDelete(null)}
                      className="px-2.5 py-1 text-[11px] font-medium text-[#6B7280] dark:text-gray-300 hover:bg-slate-200/50 dark:hover:bg-gray-800 rounded-[6px] cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={categoryManagerLoading}
                      onClick={() => handleExecuteDeleteCategory(categoryToDelete)}
                      className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-semibold rounded-[6px] shadow-xs cursor-pointer"
                    >
                      {categoryManagerLoading ? 'Deleting...' : 'Yes, Delete'}
                    </button>
                  </div>
                </div>
              )}

              {/* Category List */}
              <div className="mt-2 flex-1 overflow-y-auto space-y-1.5 pr-1 max-h-[350px]">
                <div className="text-[11px] font-bold text-[#6B7280] dark:text-gray-400 uppercase tracking-wider px-1 mb-1">
                  Active Categories ({categories.length})
                </div>

                {categories.length === 0 ? (
                  <p className="text-center py-8 text-[12px] text-[#6B7280] dark:text-gray-400">
                    No categories found. Add your first category above.
                  </p>
                ) : (
                  categories.map((cat) => {
                    const count = categoryMaterialCounts.counts[cat.id] || 0;
                    const isEditing = editingCatId === cat.id;

                    return (
                      <div
                        key={cat.id || cat.localId}
                        className="flex items-center justify-between gap-2 p-2.5 bg-[#F8FAFC] dark:bg-[#0B1220] border border-slate-200/60 dark:border-gray-800 rounded-[10px] hover:border-slate-300 dark:hover:border-gray-700 transition-colors"
                      >
                        {isEditing ? (
                          <div className="flex items-center gap-1.5 flex-1">
                            <input
                              type="text"
                              value={editingCatName}
                              onChange={(e) => setEditingCatName(e.target.value)}
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveRenameCategory(cat);
                                if (e.key === 'Escape') setEditingCatId(null);
                              }}
                              className="flex-1 px-2.5 py-1 text-[12px] bg-white dark:bg-[#1A2332] border border-[#2F6FED] rounded-[6px] text-[#0B1B3F] dark:text-white focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveRenameCategory(cat)}
                              className="w-7 h-7 flex items-center justify-center rounded-[6px] bg-[#2F6FED] text-white hover:bg-blue-600 transition-colors cursor-pointer"
                              title="Save name"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingCatId(null)}
                              className="w-7 h-7 flex items-center justify-center rounded-[6px] text-[#6B7280] hover:text-[#0B1B3F] dark:hover:text-white cursor-pointer"
                              title="Cancel"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center gap-2 truncate min-w-0">
                              <Tag className="w-3.5 h-3.5 text-[#2F6FED] shrink-0" />
                              <span className="text-[13px] font-semibold text-[#0B1B3F] dark:text-white truncate">
                                {cat.name}
                              </span>
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-200/70 dark:bg-gray-800 text-[#6B7280] dark:text-gray-300 shrink-0">
                                {count} {count === 1 ? 'material' : 'materials'}
                              </span>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingCatId(cat.id);
                                  setEditingCatName(cat.name);
                                }}
                                className="w-7 h-7 flex items-center justify-center rounded-[6px] text-[#6B7280] dark:text-gray-400 hover:text-[#2F6FED] hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors cursor-pointer"
                                title="Rename category"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setCategoryToDelete(cat)}
                                className="w-7 h-7 flex items-center justify-center rounded-[6px] text-[#6B7280] dark:text-gray-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                                title="Delete category"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })
                )}

                {categoryMaterialCounts.uncategorized > 0 && (
                  <div className="flex items-center justify-between p-2.5 bg-slate-100/50 dark:bg-gray-900/40 border border-dashed border-slate-200 dark:border-gray-800 rounded-[10px] text-[#6B7280] dark:text-gray-400 text-[12px]">
                    <span className="italic">Uncategorized items</span>
                    <span className="font-semibold text-[11px] px-2 py-0.5 rounded-full bg-slate-200 dark:bg-gray-800">
                      {categoryMaterialCounts.uncategorized} materials
                    </span>
                  </div>
                )}
              </div>

              {/* Close Footer */}
              <div className="pt-3 border-t border-slate-100 dark:border-gray-700/60 flex justify-end">
                <button
                  type="button"
                  onClick={() => setIsCategoryManagerOpen(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-gray-800 hover:bg-slate-200 dark:hover:bg-gray-700 text-[#0B1B3F] dark:text-white text-[12px] font-semibold rounded-[8px] transition-colors cursor-pointer"
                >
                  Done
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
