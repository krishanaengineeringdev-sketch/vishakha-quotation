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

// Initialize LocalStorage defaults if empty (only company profile branding)
export const initLocalStorageDefaults = () => {
  // Purge any legacy demo seed data from localStorage
  try {
    localStorage.removeItem(LOCAL_STORAGE_KEYS.CUSTOMERS);
    localStorage.removeItem(LOCAL_STORAGE_KEYS.MATERIALS);
    localStorage.removeItem(LOCAL_STORAGE_KEYS.QUOTATIONS);
    localStorage.removeItem(LOCAL_STORAGE_KEYS.ITEMS);
  } catch (e) {
    // Ignore storage errors
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
