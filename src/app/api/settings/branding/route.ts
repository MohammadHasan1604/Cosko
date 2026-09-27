import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * GET /api/settings/branding — PUBLIC endpoint
 * Returns ONLY non-sensitive branding information needed for the login page.
 * No GSTIN, no security settings, no UPI, no bank details, no tax config.
 */

let cachedBranding: any = null;
let lastCacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function GET(_req: NextRequest) {
  try {
    const now = Date.now();
    if (cachedBranding && now - lastCacheTime < CACHE_TTL) {
      return NextResponse.json(cachedBranding, {
        headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
      });
    }

    const branding = await (prisma as any).brandingSetting.findFirst({
      orderBy: { createdAt: 'desc' },
    });

    const publicBranding = {
      success: true,
      branding: {
        appName: branding?.appName || 'COSKO',
        tagline: branding?.tagline || 'Retail Command Center',
        supportEmail: branding?.supportEmail || null,
        logoUrl: branding?.logoUrl || null,
        faviconUrl: branding?.faviconUrl || null,
      },
    };

    cachedBranding = publicBranding;
    lastCacheTime = now;

    return NextResponse.json(publicBranding, {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
    });
  } catch (error: any) {
    console.error('API /api/settings/branding GET error:', error);
    return NextResponse.json(
      {
        success: true,
        branding: {
          appName: 'COSKO',
          tagline: 'Retail Command Center',
          supportEmail: null,
          logoUrl: null,
          faviconUrl: null,
        },
      },
      { status: 200 }
    );
  }
}
