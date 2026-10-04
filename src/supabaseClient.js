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

// Helper to compress image before uploading to optimize storage & mobile offline Dexie performance
export async function compressImage(file, maxDimension = 600, quality = 0.85) {
  if (!file || typeof window === 'undefined' || !file.type || !file.type.startsWith('image/')) {
    return file;
  }
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return resolve(file);
        }
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              const cleanName = (file.name || 'image').replace(/\.[^/.]+$/, '');
              const compressedFile = new File([blob], `${cleanName}.webp`, {
                type: 'image/webp',
                lastModified: Date.now()
              });
              resolve(compressedFile);
            } else {
              resolve(file);
            }
          },
          'image/webp',
          quality
        );
      };
      img.onerror = () => resolve(file);
      img.src = e.target.result;
    };
    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
}

// Storage helper for uploading material images with compression and robust fallback
export async function uploadMaterialImage(file) {
  if (!file) return null;
  const compressed = await compressImage(file, 600, 0.85);

  if (isSupabaseConfigured && supabase) {
    const fileExt = compressed.name ? compressed.name.split('.').pop() : 'webp';
    const fileName = `material-${Date.now()}.${fileExt}`;
    const filePath = `materials/${fileName}`;

    // 1. Try 'material-images' bucket first (if created/configured in Supabase Storage)
    try {
      const { data: upData, error: upError } = await supabase.storage
        .from('material-images')
        .upload(filePath, compressed, { upsert: true });

      if (!upError && upData) {
        const { data: pubData } = supabase.storage
          .from('material-images')
          .getPublicUrl(filePath);

        if (pubData?.publicUrl) {
          console.info('[uploadMaterialImage] Uploaded successfully to material-images bucket:', pubData.publicUrl);
          return pubData.publicUrl;
        }
      } else if (upError) {
        console.warn(`[uploadMaterialImage] 'material-images' bucket upload notice (${upError.message}), attempting fallback bucket...`);
      }
    } catch (err) {
      console.warn('[uploadMaterialImage] Error trying material-images bucket:', err);
    }

    // 2. Try 'company-assets' bucket (existing public storage bucket)
    try {
      const { data: caData, error: caError } = await supabase.storage
        .from('company-assets')
        .upload(filePath, compressed, { upsert: true });

      if (!caError && caData) {
        const { data: pubData } = supabase.storage
          .from('company-assets')
          .getPublicUrl(filePath);

        if (pubData?.publicUrl) {
          console.info('[uploadMaterialImage] Uploaded successfully to company-assets bucket:', pubData.publicUrl);
          return pubData.publicUrl;
        }
      } else if (caError) {
        console.warn(`[uploadMaterialImage] 'company-assets' upload notice:`, caError.message);
      }
    } catch (err) {
      console.warn('[uploadMaterialImage] Error trying company-assets bucket:', err);
    }
  }

  // 3. Fallback to Data URL for instant preview, offline durability, and Dexie storage
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = (error) => {
      console.error('[uploadMaterialImage] FileReader error:', error);
      reject(error);
    };
    reader.readAsDataURL(compressed);
  });
}


