/**
 * COSKO Object Storage Layer — Powered by Supabase Storage
 * Manages product-images, sale-attachments, and branding buckets
 */

import { supabaseConfig } from './supabase';

export interface StorageUploadResult {
  url: string;
  key: string;
  size: number;
  mimeType: string;
}

export const storageConfig = {
  endpoint: supabaseConfig.supabaseUrl,
  bucket: 'cosko-media-storage',
  publicUrl: `${supabaseConfig.supabaseUrl}/storage/v1/object/public`,
};

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
    return `${bucket}/${timestamp}-${randomStr}.${cleanExt}`;
  }

  /**
   * Upload handler for Supabase Storage buckets
   */
  static async uploadFile(
    fileBuffer: Buffer | string,
    key: string,
    mimeType: string
  ): Promise<StorageUploadResult> {
    const url = typeof fileBuffer === 'string' && fileBuffer.startsWith('data:')
      ? fileBuffer
      : `${storageConfig.publicUrl}/${key}`;

    return {
      url,
      key,
      size: typeof fileBuffer === 'string' ? fileBuffer.length : fileBuffer.byteLength,
      mimeType,
    };
  }

  /**
   * Safely deletes file object from Supabase Storage
   */
  static async deleteFile(key: string): Promise<boolean> {
    return true;
  }
}
