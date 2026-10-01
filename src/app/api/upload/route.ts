import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, createAuditLog, validatePhysicalStore } from '@/lib/authPipeline';
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
    const requestedStore = (formData.get('storeCode') as string)?.trim() || '';
    const requestedEntityType = (formData.get('relatedEntityType') as string)?.trim() || '';
    const requestedEntityId = (formData.get('relatedEntityId') as string)?.trim() || '';

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // 🔒 Authoritative Server Store Rule for Private Financial Evidence
    const isFinancialEvidence =
      categoryRaw === 'payment-proofs' || categoryRaw === 'expense-receipts';
    let effectiveStoreCode: string | null = null;

    if (isFinancialEvidence) {
      if (user.role === 'Super Admin') {
        if (!requestedStore) {
          return NextResponse.json(
            {
              error:
                'Physical store code is required when uploading private financial evidence as Super Admin.',
            },
            { status: 400 }
          );
        }
        const storeVal = await validatePhysicalStore(requestedStore);
        if (!storeVal.valid || !storeVal.storeCode) {
          return NextResponse.json(
            {
              error:
                storeVal.error ||
                `Invalid store code "${requestedStore}". Financial evidence must target an active physical store.`,
            },
            { status: 400 }
          );
        }
        effectiveStoreCode = storeVal.storeCode;
      } else {
        const assignedStore = user.store?.trim().toUpperCase();
        if (
          !assignedStore ||
          assignedStore === 'ALL STORES' ||
          assignedStore === 'ALL' ||
          assignedStore === 'HQ'
        ) {
          return NextResponse.json(
            {
              error:
                'Forbidden: User does not have a valid assigned physical store for financial proof upload.',
            },
            { status: 403 }
          );
        }

        if (requestedStore && requestedStore.toUpperCase() !== assignedStore) {
          return NextResponse.json(
            {
              error: `Forbidden: Cannot upload financial proof for another store (${requestedStore}). Assigned store is ${assignedStore}.`,
            },
            { status: 403 }
          );
        }

        effectiveStoreCode = assignedStore;
      }
    } else {
      // Non-financial uploads
      if (requestedStore) {
        const storeVal = await validatePhysicalStore(requestedStore);
        if (storeVal.valid && storeVal.storeCode) {
          effectiveStoreCode = storeVal.storeCode;
        } else {
          effectiveStoreCode =
            user.store && user.store !== 'All Stores' && user.store !== 'HQ' ? user.store : null;
        }
      } else if (user.store && user.store !== 'All Stores' && user.store !== 'HQ') {
        effectiveStoreCode = user.store;
      } else {
        effectiveStoreCode = null;
      }
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

    const effectiveEntityType =
      requestedEntityType ||
      (categoryRaw === 'payment-proofs'
        ? 'Sale'
        : categoryRaw === 'expense-receipts'
          ? 'Expense'
          : 'Asset');

    // Persist FileAsset record in MySQL
    try {
      await (prisma as any).fileAsset.create({
        data: {
          objectKey: result.key,
          storageProvider:
            process.env.STORAGE_ENDPOINT || process.env.R2_ENDPOINT || process.env.R2_ACCOUNT_ID
              ? 's3'
              : 'local',
          mimeType: result.mimeType,
          byteSize: result.size,
          originalFilename: file.name || 'document',
          createdByUserId: user.id,
          storeCode: effectiveStoreCode,
          privacyLevel: result.isPrivate ? 'STORE_PRIVATE' : 'PUBLIC',
          relatedEntityType: effectiveEntityType,
          relatedEntityId: requestedEntityId || null,
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
      storeCode: effectiveStoreCode,
      relatedEntityType: effectiveEntityType,
      uploadedAt: new Date().toISOString(),
      uploadedBy: user.name,
    });
  } catch (error: any) {
    console.error('[Upload API] Error:', error);
    return NextResponse.json({ error: error.message || 'Upload failed' }, { status: 500 });
  }
}
