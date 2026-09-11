import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySessionToken } from '@/lib/auth';
import { prisma } from '@/lib/db';

/**
 * POST /api/settings/data-connections/disable - Disable the legacy data connection
 */
export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('cosko_session')?.value;
    const user = token ? verifySessionToken(token) : null;

    if (!user || user.role !== 'Super Admin' || user.securityLevel < 100) {
      return NextResponse.json({ error: 'Unauthorized: Super Admin only' }, { status: 403 });
    }

    await (prisma as any).legacyDataSourceConfig.upsert({
      where: { id: 'legacy_customer_repair_db' },
      create: {
        id: 'legacy_customer_repair_db',
        status: 'Disabled',
        updatedBy: user.name,
      },
      update: {
        status: 'Disabled',
        updatedBy: user.name,
      },
    });

    await (prisma as any).auditLog.create({
      data: {
        module: 'Settings',
        action: 'DATA_CONNECTION_DISABLED',
        details: `Disabled Legacy Data Connection by Super Admin (${user.email})`,
        userEmail: user.email,
        userRole: user.role,
        storeCode: user.store,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Legacy database connection disabled successfully.',
    });
  } catch (error: any) {
    console.error('API /api/settings/data-connections/disable error:', error);
    return NextResponse.json({ error: 'Failed to disable connection' }, { status: 500 });
  }
}
