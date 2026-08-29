import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySessionToken } from '@/lib/auth';
import { getLegacyRepairsList } from '@/lib/services/legacyCustomerService';

/**
 * GET /api/repairs - Retrieve all repair records and calculate KPIs
 */
export async function GET(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('cosko_session')?.value;
    const user = token ? verifySessionToken(token) : null;

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || 'All';
    const store = searchParams.get('store') || 'All Stores';
    const deviceType = searchParams.get('deviceType') || 'All';
    const search = searchParams.get('search') || '';

    const repairs = await getLegacyRepairsList({ status, store, deviceType, search }, user.role);

    // Compute live repair KPIs
    const totalEnquiries = repairs.length;
    const pendingCount = repairs.filter((r) => r.status === 'Pending Diagnosis' || r.status === 'Awaiting Parts').length;
    const inProgressCount = repairs.filter((r) => r.status === 'In Progress').length;
    const completedCount = repairs.filter((r) => r.status === 'Completed' || r.status === 'Delivered').length;
    const customersWithRepairs = new Set(repairs.map((r) => r.normalizedPhone)).size;
    const repairAndPurchaseCount = repairs.filter((r) => r.linkedCoskoSaleNo).length;

    return NextResponse.json({
      success: true,
      kpis: {
        totalEnquiries,
        pendingCount,
        inProgressCount,
        completedCount,
        customersWithRepairs,
        repairAndPurchaseCount,
      },
      repairs,
    });
  } catch (error: any) {
    console.error('API /api/repairs GET error:', error);
    return NextResponse.json({ error: 'Failed to retrieve repairs' }, { status: 500 });
  }
}
