import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(
  supabaseUrl && 
  supabaseAnonKey && 
  !supabaseUrl.includes('your-project') &&
  !supabaseAnonKey.includes('your-anon-key')
);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    })
  : null;

// Local fallback storage keys for offline / demo mode
const LOCAL_STORAGE_KEYS = {
  PROFILE: 'vishakha_demo_profile',
  CUSTOMERS: 'vishakha_demo_customers',
  QUOTATIONS: 'vishakha_demo_quotations',
  ITEMS: 'vishakha_demo_items',
  MATERIALS: 'vishakha_demo_materials',
  AUTH: 'vishakha_demo_auth'
};

import { COMPANY_CONFIG } from './config/companyConfig';

// Seed default company profile with valid UUID
const DEFAULT_COMPANY_PROFILE = {
  id: 'd0000000-0000-4000-8000-000000000001',
  name: COMPANY_CONFIG.name,
  owner_name: COMPANY_CONFIG.ownerName,
  address: COMPANY_CONFIG.address,
  phone: COMPANY_CONFIG.phone,
  email: COMPANY_CONFIG.email,
  logo_url: COMPANY_CONFIG.logoUrl,
  signature_url: '',
  default_greeting: COMPANY_CONFIG.defaultGreeting,
  default_closing: COMPANY_CONFIG.defaultClosing
};

// Seed sample demo data
// Seed sample demo data with valid UUIDs
const DEFAULT_CUSTOMERS = [
  { id: 'c1000000-0000-4000-8000-000000000001', name: 'Apex Engineering Works', place: 'Coimbatore' },
  { id: 'c2000000-0000-4000-8000-000000000002', name: 'Premier Precision Tools', place: 'Tirupur' },
  { id: 'c3000000-0000-4000-8000-000000000003', name: 'Sterling Machinery Corp', place: 'Erode' }
];

// Seed default materials with valid UUIDs
const DEFAULT_MATERIALS = [
  {
    id: 'a0000000-0000-4000-8000-000000000001',
    name: 'Industrial Hydraulic Valve 25mm (High Pressure)',
    code: '8481',
    unit: 'Nos',
    rate: 7500,
    description: 'High pressure 25mm CNC finished hydraulic control valve',
    is_active: true
  },
  {
    id: 'a0000000-0000-4000-8000-000000000002',
    name: 'Forged Steel Flange 150# ANSI Class',
    code: '7307',
    unit: 'Nos',
    rate: 4500,
    description: '150# ANSI class forged steel industrial connection flange',
    is_active: true
  },
  {
    id: 'a0000000-0000-4000-8000-000000000003',
    name: 'Heavy Duty CNC Turned Component Shaft SS304',
    code: '8483',
    unit: 'Nos',
    rate: 4250,
    description: 'Precision turned SS304 transmission component shaft',
    is_active: true
  },
  {
    id: 'a0000000-0000-4000-8000-000000000004',
    name: 'Precision Ground Bearing Housing Unit',
    code: '8482',
    unit: 'Nos',
    rate: 5000,
    description: 'Cast iron ground bearing housing unit with dust seal',
    is_active: true
  },
  {
    id: 'a0000000-0000-4000-8000-000000000005',
    name: 'SS316 Fastener Bolt & Nut Assembly M16x60',
    code: '7318',
    unit: 'Set',
    rate: 180,
    description: 'Corrosion resistant stainless steel fastener bolt and nut assembly',
    is_active: true
  },
  {
    id: 'a0000000-0000-4000-8000-000000000006',
    name: 'Industrial Hydraulic Fluid ISO VG 68',
    code: '2710',
    unit: 'Ltr',
    rate: 320,
    description: 'Premium anti-wear industrial hydraulic system fluid',
    is_active: true
  },
  {
    id: 'a0000000-0000-4000-8000-000000000007',
    name: 'Heavy Duty Stainless Steel Raw Rod 50mm',
    code: '7222',
    unit: 'Kg',
    rate: 380,
    description: 'Grade 304 solid stainless steel round bar stock',
    is_active: true
  }
];

// Valid UUID sample quotations for testing single-item and multi-item page balance
const DEFAULT_QUOTATIONS = [
  {
    id: 'e1000000-0000-4000-8000-000000000001',
    quote_no: 'VI/2026-27/001',
    quote_date: '2026-10-02',
    customer_id: 'c1000000-0000-4000-8000-000000000001',
    greeting: 'Kind Attention: Purchase Department. We thank you for your enquiry and take pleasure in submitting our competitive quotation as below:',
    closing: 'We trust our quotation meets your valued approval and look forward to receiving your valuable purchase order.',
    subtotal: 75000,
    discount_percent: 5,
    discount_amount: 3750,
    gst_percent: 18,
    gst_amount: 12825,
    grand_total: 84075,
    created_at: '2026-10-02T10:00:00.000Z'
  },
  {
    id: 'e2000000-0000-4000-8000-000000000002',
    quote_no: 'VI/2026-27/002',
    quote_date: '2026-10-02',
    customer_id: 'c2000000-0000-4000-8000-000000000002',
    greeting: 'Dear Sir/Madam, With reference to your technical enquiry, we are pleased to quote our best rates for the following items:',
    closing: 'Quality inspection certificate will be provided along with delivery. Looking forward to your order.',
    subtotal: 92700,
    discount_percent: 0,
    discount_amount: 0,
    gst_percent: 18,
    gst_amount: 16686,
    grand_total: 109386,
    created_at: '2026-10-02T10:15:00.000Z'
  }
];

const DEFAULT_ITEMS = [
  // Quote 1: 1 item test case
  {
    id: 'b1000000-0000-4000-8000-000000000001',
    quotation_id: 'e1000000-0000-4000-8000-000000000001',
    sl_no: 1,
    description: 'Industrial Hydraulic Valve 25mm (High Pressure) - CNC finished precision body with dual seal protection',
    unit: 'Nos',
    qty: 10,
    price: 7500,
    total: 75000
  },
  // Quote 2: 5 items test case
  {
    id: 'b2000000-0000-4000-8000-000000000001',
    quotation_id: 'e2000000-0000-4000-8000-000000000002',
    sl_no: 1,
    description: 'Forged Steel Flange 150# ANSI Class - High tensile standard pipe connection flange',
    unit: 'Nos',
    qty: 4,
    price: 4500,
    total: 18000
  },
  {
    id: 'b2000000-0000-4000-8000-000000000002',
    quotation_id: 'e2000000-0000-4000-8000-000000000002',
    sl_no: 2,
    description: 'Heavy Duty CNC Turned Component Shaft SS304 - Precision engineered transmission shaft',
    unit: 'Nos',
    qty: 6,
    price: 4250,
    total: 25500
  },
  {
    id: 'b2000000-0000-4000-8000-000000000003',
    quotation_id: 'e2000000-0000-4000-8000-000000000002',
    sl_no: 3,
    description: 'Precision Ground Bearing Housing Unit - Cast iron with heat treated inner race',
    unit: 'Nos',
    qty: 5,
    price: 5000,
    total: 25000
  },
  {
    id: 'b2000000-0000-4000-8000-000000000004',
    quotation_id: 'e2000000-0000-4000-8000-000000000002',
    sl_no: 4,
    description: 'SS316 Fastener Bolt & Nut Assembly M16x60 - Grade 316 stainless hardware',
    unit: 'Set',
    qty: 50,
    price: 180,
    total: 9000
  },
  {
    id: 'b2000000-0000-4000-8000-000000000005',
    quotation_id: 'e2000000-0000-4000-8000-000000000002',
    sl_no: 5,
    description: 'Heavy Duty Stainless Steel Raw Rod 50mm - Grade 304 round bar stock',
    unit: 'Kg',
    qty: 40,
    price: 380,
    total: 15200
  }
];

// Initialize LocalStorage defaults if empty
export const initLocalStorageDefaults = () => {
  const existingProfile = localStorage.getItem(LOCAL_STORAGE_KEYS.PROFILE);
  if (!existingProfile) {
    localStorage.setItem(LOCAL_STORAGE_KEYS.PROFILE, JSON.stringify(DEFAULT_COMPANY_PROFILE));
  } else {
    try {
      const parsed = JSON.parse(existingProfile);
      // Auto-migrate old demo profile defaults to new company branding
      if (
        parsed.owner_name === 'Vishakha Sharma' ||
        parsed.address?.includes('Ahmedabad') ||
        parsed.logo_url === '/logo.svg' ||
        parsed.phone === '+91 98765 43210'
      ) {
        const updated = {
          ...parsed,
          name: COMPANY_CONFIG.name,
          owner_name: COMPANY_CONFIG.ownerName,
          address: COMPANY_CONFIG.address,
          phone: COMPANY_CONFIG.phone,
          email: COMPANY_CONFIG.email,
          logo_url: COMPANY_CONFIG.logoUrl
        };
        localStorage.setItem(LOCAL_STORAGE_KEYS.PROFILE, JSON.stringify(updated));
      }
    } catch (e) {
      localStorage.setItem(LOCAL_STORAGE_KEYS.PROFILE, JSON.stringify(DEFAULT_COMPANY_PROFILE));
    }
  }
  if (!localStorage.getItem(LOCAL_STORAGE_KEYS.CUSTOMERS)) {
    localStorage.setItem(LOCAL_STORAGE_KEYS.CUSTOMERS, JSON.stringify(DEFAULT_CUSTOMERS));
  }
  if (!localStorage.getItem(LOCAL_STORAGE_KEYS.MATERIALS)) {
    localStorage.setItem(LOCAL_STORAGE_KEYS.MATERIALS, JSON.stringify(DEFAULT_MATERIALS));
  }
  const currentQuotes = localStorage.getItem(LOCAL_STORAGE_KEYS.QUOTATIONS);
  if (!currentQuotes || JSON.parse(currentQuotes).length === 0) {
    localStorage.setItem(LOCAL_STORAGE_KEYS.QUOTATIONS, JSON.stringify(DEFAULT_QUOTATIONS));
    localStorage.setItem(LOCAL_STORAGE_KEYS.ITEMS, JSON.stringify(DEFAULT_ITEMS));
  }
};

// Storage helper for uploading images (Logo & Signature)
export async function uploadAsset(file, path) {
  if (!file) return null;

  // Try Supabase Storage if configured
  if (isSupabaseConfigured && supabase) {
    try {
      const fileExt = file.name ? file.name.split('.').pop() : 'png';
      const fileName = `${path}-${Date.now()}.${fileExt}`;
      const filePath = `assets/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('company-assets')
        .upload(filePath, file, { upsert: true });

      if (!uploadError) {
        const { data: publicUrlData } = supabase.storage
          .from('company-assets')
          .getPublicUrl(filePath);

        if (publicUrlData?.publicUrl) {
          return publicUrlData.publicUrl;
        }
      } else {
        console.warn('Supabase storage upload failed or bucket does not exist. Falling back to local Base64 URL:', uploadError.message);
      }
    } catch (err) {
      console.warn('Storage upload error, using Data URL fallback:', err);
    }
  }

  // Fallback to Data URL for instant preview and offline storage
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
}
