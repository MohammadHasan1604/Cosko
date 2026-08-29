/**
 * COSKO Object Storage Layer — Powered by Supabase Storage
 * Manages product-images, sale-attachments, and branding buckets
 */

import { createSupabaseBrowserClient } from './supabase/client';
import { isSupabaseConfigured } from './supabase';

export interface StorageUploadResult {
  url: string;
  key: string;
  size: number;
  mimeType: string;
}

const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml'];
const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024; // 2MB

export class StorageService {
  /**
   * Validates file format and size before storage processing
   */
  static validateImageFile(file: { type: string; size: number; name: string }): { valid: boolean; error?: string } {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      return { valid: false, error: `Invalid image format (${file.type}). Allowed: PNG, JPG, WebP, SVG.` };
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return { valid: false, error: `File size exceeds 2MB limit (${(file.size / 1024 / 1024).toFixed(2)}MB).` };
    }
    return { valid: true };
  }

  /**
   * Generates a safe unique filename key to prevent path traversal and overwrite collisions
   */
  static generateUniqueKey(bucket: 'product-images' | 'sale-attachments' | 'branding', originalFilename: string): string {
    const ext = originalFilename.split('.').pop() || 'png';
    const cleanExt = ext.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    return `${timestamp}-${randomStr}.${cleanExt}`;
  }

  /**
   * Upload handler for Supabase Storage buckets
   */
  static async uploadFile(
    bucket: 'product-images' | 'sale-attachments' | 'branding',
    file: File | Blob,
    filename: string
  ): Promise<StorageUploadResult> {
    const key = this.generateUniqueKey(bucket, filename);

    if (isSupabaseConfigured() && typeof window !== 'undefined') {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data, error } = await supabase.storage.from(bucket).upload(key, file, {
          contentType: file.type || 'image/png',
          upsert: true,
        });

        if (error) {
          console.warn('Supabase storage upload warning:', error.message);
        } else if (data) {
          const { data: publicUrlData } = supabase.storage.from(bucket).getPublicUrl(key);
          return {
            url: publicUrlData.publicUrl,
            key: data.path,
            size: file.size,
            mimeType: file.type || 'image/png',
          };
        }
      } catch (err) {
        console.warn('Supabase storage exception:', err);
      }
    }

    // Fallback: create Object URL for local client session
    const localUrl = typeof window !== 'undefined' ? URL.createObjectURL(file) : '';
    return {
      url: localUrl,
      key: `${bucket}/${key}`,
      size: file.size,
      mimeType: file.type || 'image/png',
    };
  }

  /**
   * Safely deletes file object from Supabase Storage
   */
  static async deleteFile(bucket: 'product-images' | 'sale-attachments' | 'branding', path: string): Promise<boolean> {
    if (isSupabaseConfigured() && typeof window !== 'undefined') {
      try {
        const supabase = createSupabaseBrowserClient();
        const { error } = await supabase.storage.from(bucket).remove([path]);
        return !error;
      } catch {
        return false;
      }
    }
    return true;
  }
}
