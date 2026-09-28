import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/authPipeline';
import { getSignedDownloadUrl, deleteFromStorage } from '@/lib/objectStorage';
import path from 'path';
import fs from 'fs/promises';

const MIME_MAP: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  pdf: 'application/pdf',
  svg: 'image/svg+xml',
};

/**
 * GET /api/files/[...key]
 * Secure, authenticated file access endpoint for private storage files (payment proofs, expense receipts).
 * Verifies user authentication and security permissions before serving or redirecting.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ key: string[] }> }) {
  try {
    const auth = await authenticateRequest(req);
    if (!auth.user) {
      return NextResponse.json(
        { error: auth.error || 'Authentication required' },
        { status: auth.status || 401 }
      );
    }

    const { key: keyParts } = await params;
    if (!keyParts || keyParts.length === 0) {
      return NextResponse.json({ error: 'File key is required' }, { status: 400 });
    }

    // Path traversal prevention
    const sanitizedParts = keyParts.map((p) => p.replace(/(\.\.|\/|\\)/g, ''));
    const fullKey = sanitizedParts.join('/');

    // Check if signed S3 URL is available
    const signedUrl = await getSignedDownloadUrl(fullKey, 3600);
    if (signedUrl && signedUrl.startsWith('http')) {
      // Redirect to temporary signed S3 URL
      return NextResponse.redirect(signedUrl, 307);
    }

    // Local filesystem fallback
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
    const filePath = path.join(uploadsDir, ...sanitizedParts);

    // Security check: ensure path is within uploads directory
    if (!filePath.startsWith(uploadsDir)) {
      return NextResponse.json({ error: 'Access denied: Invalid file path' }, { status: 403 });
    }

    try {
      const fileBuffer = await fs.readFile(filePath);
      const ext = fullKey.split('.').pop()?.toLowerCase() || '';
      const contentType = MIME_MAP[ext] || 'application/octet-stream';
      const filename = path.basename(filePath);

      return new NextResponse(fileBuffer, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Content-Disposition': `inline; filename="${filename}"`,
          'X-Content-Type-Options': 'nosniff',
          'Cache-Control': 'private, max-age=3600',
        },
      });
    } catch {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }
  } catch (error: any) {
    console.error('[Files API] GET error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to retrieve file' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/files/[...key]
 * Secure file deletion with strict retention rules:
 * Refuses deletion of financial evidence (payment-proofs, expense-receipts).
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ key: string[] }> }) {
  try {
    const auth = await authenticateRequest(req);
    if (!auth.user) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    // Only managers and admins can delete stored files
    if (auth.user.securityLevel < 80) {
      return NextResponse.json(
        { error: 'Forbidden: Insufficient permissions to delete storage files' },
        { status: 403 }
      );
    }

    const { key: keyParts } = await params;
    if (!keyParts || keyParts.length === 0) {
      return NextResponse.json({ error: 'File key is required' }, { status: 400 });
    }

    const sanitizedParts = keyParts.map((p) => p.replace(/(\.\.|\/|\\)/g, ''));
    const fullKey = sanitizedParts.join('/');

    // Retention enforcement: NEVER delete financial proof
    if (fullKey.startsWith('payment-proofs') || fullKey.startsWith('expense-receipts')) {
      return NextResponse.json(
        { error: 'Retention Policy: Payment proofs and expense receipts cannot be deleted.' },
        { status: 403 }
      );
    }

    const success = await deleteFromStorage(fullKey);
    if (!success) {
      return NextResponse.json(
        { error: 'File deletion failed or file does not exist' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, message: `File ${fullKey} deleted successfully` });
  } catch (error: any) {
    console.error('[Files API] DELETE error:', error);
    return NextResponse.json({ error: error.message || 'Deletion error' }, { status: 500 });
  }
}
