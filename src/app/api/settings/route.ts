import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { broadcastRealtimeEvent } from '@/lib/realtime';

const BRANDING_ID = 'cosko_branding_config';

/**
 * GET /api/settings - Retrieve global branding and system configuration from MySQL
 */
export async function GET(req: NextRequest) {
  try {
    let setting = await prisma.brandingSetting.findUnique({
      where: { id: BRANDING_ID },
    });

    if (!setting) {
      setting = await prisma.brandingSetting.create({
        data: {
          id: BRANDING_ID,
          appName: 'COSKO',
          tagline: 'Multi-Store Enterprise Retail & POS System',
          supportEmail: 'support@cosko.com',
          logoUrl: null,
          faviconUrl: null,
        },
      });
    }

    return NextResponse.json({
      success: true,
      branding: {
        appName: setting.appName,
        tagline: setting.tagline,
        supportEmail: setting.supportEmail,
        logoUrl: setting.logoUrl,
        faviconUrl: setting.faviconUrl,
        updatedAt: setting.updatedAt,
      },
    }, { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } });
  } catch (error: any) {
    console.error('API /api/settings GET error:', error);
    return NextResponse.json({ error: 'Failed to retrieve system settings' }, { status: 500 });
  }
}

/**
 * POST /api/settings - Save or update global branding in MySQL
 */
export async function POST(req: NextRequest) {
  try {
    const user = getAuthUserFromRequest(req);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'Super Admin') {
      return NextResponse.json({ error: 'Forbidden: Only Super Admin can modify system settings' }, { status: 403 });
    }

    const body = await req.json();

    const updated = await prisma.brandingSetting.upsert({
      where: { id: BRANDING_ID },
      create: {
        id: BRANDING_ID,
        appName: body.appName || 'COSKO',
        tagline: body.tagline || 'Multi-Store Enterprise Retail & POS System',
        supportEmail: body.supportEmail || 'support@cosko.com',
        logoUrl: body.logoUrl !== undefined ? body.logoUrl : null,
        faviconUrl: body.faviconUrl !== undefined ? body.faviconUrl : null,
      },
      update: {
        appName: body.appName || undefined,
        tagline: body.tagline || undefined,
        supportEmail: body.supportEmail || undefined,
        logoUrl: body.logoUrl !== undefined ? body.logoUrl : undefined,
        faviconUrl: body.faviconUrl !== undefined ? body.faviconUrl : undefined,
      },
    });

    broadcastRealtimeEvent('settings', 'BRANDING_UPDATED', { appName: updated.appName, logoUrl: updated.logoUrl });

    return NextResponse.json({
      success: true,
      branding: updated,
      message: 'Branding settings persisted to MySQL successfully',
    });
  } catch (error: any) {
    console.error('API /api/settings POST error:', error);
    return NextResponse.json({ error: error.message || 'Failed to update system settings' }, { status: 500 });
  }
}
