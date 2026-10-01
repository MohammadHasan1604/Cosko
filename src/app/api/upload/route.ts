import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, createAuditLog } from '@/lib/authPipeline';
import {
  uploadToStorage,
  validateFile,
  StorageBucket,
  fileExistsInStorage,
  isObjectStorageConfigured,
} from '@/lib/objectStorage';
import { prisma } from '@/lib/db';

const CATEGORY_MAP: Record<string, StorageBucket> = {
  'payment-proofs': 'payment-proofs',
  'product-images': 'product-images',
  'expense-receipts': 'expense-receipts',
  'sale-attachments': 'sale-attachments',
  branding: 'branding',
};

/**
 * POST /api/upload
 * Unified file upload endpoint using S3-compatible object storage.
 * Validates MIME type, file size, and magic bytes.
 * Returns object key + URL for DB storage.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req);
    if (!auth.user) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const user = auth.user;

    if (user.securityLevel < 20) {
      return NextResponse.json({ error: 'Forbidden: Insufficient permissions' }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const categoryRaw = (formData.get('category') as string) || 'payment-proofs';
    const bucket: StorageBucket = CATEGORY_MAP[categoryRaw] || 'payment-proofs';

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const mimeType = file.type?.toLowerCase() || '';
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Validate MIME, size, magic bytes
    const validation = validateFile(buffer, mimeType, file.size, bucket);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // Upload to S3/R2 (or local fallback)
    const result = await uploadToStorage(
      bucket,
      buffer,
      file.name || 'document',
      mimeType,
      user.name
    );

    if (!result.success || !result.key) {
      return NextResponse.json({ error: result.error || 'Upload failed' }, { status: 500 });
    }

    // 🔒 Verify persistence before claiming success
    if (isObjectStorageConfigured()) {
      const persisted = await fileExistsInStorage(result.key);
      if (!persisted) {
        return NextResponse.json(
          { error: 'Upload failed: Persistence verification failed in object storage' },
          { status: 500 }
        );
      }
    }

    // Persist FileAsset record in MySQL
    try {
      await (prisma as any).fileAsset.create({
        data: {
          objectKey: result.key,
          storageProvider: process.env.STORAGE_ENDPOINT ? 's3' : 'local',
          mimeType: result.mimeType,
          byteSize: result.size,
          originalFilename: file.name || 'document',
          createdByUserId: user.id,
          storeCode: user.store && user.store !== 'All Stores' && user.store !== 'HQ' ? user.store : 'BLR',
          privacyLevel: result.isPrivate ? 'STORE_PRIVATE' : 'PUBLIC',
          relatedEntityType:
            categoryRaw === 'payment-proofs'
              ? 'Sale'
              : categoryRaw === 'expense-receipts'
                ? 'Expense'
                : 'Asset',
        },
      });
    } catch (assetErr) {
      console.warn('[Upload API] Could not record FileAsset metadata:', assetErr);
    }

    // Audit log
    await createAuditLog(
      user,
      'File Upload',
      `Upload ${bucket}`,
      `${user.name} uploaded ${file.name} (${(file.size / 1024).toFixed(1)}KB, ${mimeType}) → ${result.key}`
    );

    return NextResponse.json({
      success: true,
      url: result.url,
      key: result.key,
      filename: result.key.split('/').pop(),
      originalName: file.name,
      size: result.size,
      mimeType: result.mimeType,
      isPrivate: result.isPrivate,
      uploadedAt: new Date().toISOString(),
      uploadedBy: user.name,
    });
  } catch (error: any) {
    console.error('[Upload API] Error:', error);
    return NextResponse.json({ error: error.message || 'Upload failed' }, { status: 500 });
  }
}
