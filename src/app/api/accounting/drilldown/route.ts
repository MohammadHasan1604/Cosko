import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '@/lib/auth';
import { getDrillDownRecords } from '@/lib/services/accountingService';
import { getDateRange, parseDate } from '@/lib/dateUtils';

/**
 * GET /api/accounting/drilldown
 * Returns exact underlying records and line items that compose any clicked metric.
 * Query params: metric, store, period, startDate, endDate
 */
export async function GET(req: NextRequest) {
  try {
    const user = getAuthUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const metric = searchParams.get('metric');
    const requestedStore = searchParams.get('store') || 'All Stores';
    const period = searchParams.get('period') || 'This Month';
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');

    if (!metric) {
      return NextResponse.json({ error: 'Metric key is required' }, { status: 400 });
    }

    let effectiveStore = requestedStore;
    if (user.role !== 'Super Admin') {
      effectiveStore = user.store;
    }

    let startDate: Date | undefined = undefined;
    let endDate: Date | undefined = undefined;

    if (startDateParam && endDateParam) {
      const s = parseDate(startDateParam);
      const e = parseDate(endDateParam);
      if (s) startDate = s;
      if (e) {
        e.setHours(23, 59, 59, 999);
        endDate = e;
      }
    } else if (period && period !== 'All Time') {
      const range = getDateRange(period);
      startDate = range.start;
      endDate = range.end;
    }

    const drilldown = await getDrillDownRecords(metric, {
      store: effectiveStore,
      startDate,
      endDate,
    });

    return NextResponse.json(
      {
        success: true,
        metric,
        scope: {
          store: effectiveStore,
          period,
          startDate: startDate?.toISOString() || null,
          endDate: endDate?.toISOString() || null,
        },
        drilldown,
      },
      {
        headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' },
      }
    );
  } catch (error: any) {
    console.error('API /api/accounting/drilldown GET error:', error);
    return NextResponse.json({ error: error.message || 'Failed to retrieve drill-down records' }, { status: 500 });
  }
}
