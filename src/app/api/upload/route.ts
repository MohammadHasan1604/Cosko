import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '@/lib/auth';
import { prisma } from '@/lib/db';
import path from 'path';
import fs from 'fs/promises';

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'application/pdf',
];

// Magic bytes for file content validation (not just MIME type header)
const MAGIC_BYTES: Record<string, number[][]> = {
  'image/jpeg': [[0xFF, 0xD8, 0xFF]],
  'image/jpg': [[0xFF, 0xD8, 0xFF]],
  'image/png': [[0x89, 0x50, 0x4E, 0x47]],
  'image/webp': [[0x52, 0x49, 0x46, 0x46]], // RIFF header
  'application/pdf': [[0x25, 0x50, 0x44, 0x46]], // %PDF
};

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * POST /api/upload
 * Handles multipart file uploads for payment proof, receipts, invoices, and documents.
 * REQUIRES: Authenticated user with security level >= 20 (POS Cashier or above)
 */
export async function POST(req: NextRequest) {
  try {
    const user = getAuthUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Minimum security level for uploads
    if (user.securityLevel < 20) {
      return NextResponse.json({ error: 'Forbidden: Insufficient permissions for file uploads' }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const category = (formData.get('category') as string) || 'payment-proofs';

    if (!file) {
      return NextResponse.json({ error: 'No file provided in form data' }, { status: 400 });
    }

    // Validate mime type
    const mimeType = file.type?.toLowerCase() || '';
    if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
      return NextResponse.json(
        {
          error: `Invalid file format (${file.type}). Allowed formats: JPG, PNG, WebP, PDF.`,
        },
        { status: 400 }
      );
    }

    // Validate size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          error: `File size exceeds 10MB limit (${(file.size / 1024 / 1024).toFixed(2)}MB).`,
        },
        { status: 400 }
      );
    }

    // Validate file content (magic bytes) — defense-in-depth beyond MIME type header
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const expectedMagic = MAGIC_BYTES[mimeType];
    if (expectedMagic && buffer.length >= 4) {
      const matchesAny = expectedMagic.some((magic) =>
        magic.every((byte, i) => buffer[i] === byte)
      );
      if (!matchesAny) {
        return NextResponse.json(
          { error: 'File content does not match declared type. Upload rejected for security.' },
          { status: 400 }
        );
      }
    }

    // Generate safe unique filename
    const originalName = file.name || 'document';
    const rawExt = originalName.split('.').pop() || (mimeType.includes('pdf') ? 'pdf' : 'png');
    const cleanExt = rawExt.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'png';
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 9);
    const safeBaseName = originalName
      .replace(/\.[^/.]+$/, '')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 30);
    const finalFilename = `${timestamp}-${randomSuffix}-${safeBaseName}.${cleanExt}`;

    // Target directory
    const targetDir = path.join(process.cwd(), 'public', 'uploads', 'payment-proofs');
    await fs.mkdir(targetDir, { recursive: true });

    const targetFilePath = path.join(targetDir, finalFilename);
    await fs.writeFile(targetFilePath, buffer);

    const publicUrl = `/uploads/payment-proofs/${finalFilename}`;

    // Audit log the upload
    try {
      await prisma.auditLog.create({
        data: {
          module: 'File Upload',
          action: 'Upload File',
          details: `${user.name} uploaded ${originalName} (${(file.size / 1024).toFixed(1)}KB, ${mimeType}) as ${finalFilename}`,
          userEmail: user.email || user.name,
          userRole: user.role,
          storeCode: user.store || 'CENTRAL',
        },
      });
    } catch (auditErr) {
      console.warn('Could not write upload audit log:', auditErr);
    }

    return NextResponse.json({
      success: true,
      url: publicUrl,
      filename: finalFilename,
      originalName: file.name,
      size: file.size,
      mimeType,
      uploadedAt: new Date().toISOString(),
      uploadedBy: user.name || 'Authorized Staff',
    });
  } catch (error: any) {
    console.error('API /api/upload error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process file upload' },
      { status: 500 }
    );
  }
}
