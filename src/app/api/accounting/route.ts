import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '@/lib/auth';
import {
  getConsolidatedPnL,
  getStoreOperationalPnL,
  getCentralTransferPnL,
} from '@/lib/services/accountingService';
import { getDateRange, parseDate } from '@/lib/dateUtils';

/**
 * GET /api/accounting
 * Comprehensive Multi-Store P&L Accounting Engine
 * Query params: store, period, startDate, endDate, view ('consolidated' | 'store' | 'central' | 'all')
 */
export async function GET(req: NextRequest) {
  try {
    const user = getAuthUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const requestedStore = searchParams.get('store') || 'All Stores';
    const period = searchParams.get('period') || 'This Month';
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');
    const view = searchParams.get('view') || 'all';

    // Store isolation check for non-Super Admin
    let effectiveStore: string = requestedStore;
    if (user.role !== 'Super Admin') {
      effectiveStore = user.store;
    }

    // Determine date boundary
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

    const filter = {
      store: effectiveStore,
      startDate,
      endDate,
    };

    // Parallel fetch required statements
    const [consolidated, storePnL, centralPnL] = await Promise.all([
      view === 'all' || view === 'consolidated' ? getConsolidatedPnL(filter) : null,
      view === 'all' || view === 'store' ? getStoreOperationalPnL(filter) : null,
      view === 'all' || view === 'central' ? getCentralTransferPnL({ startDate, endDate }) : null,
    ]);

    return NextResponse.json(
      {
        success: true,
        scope: {
          store: effectiveStore,
          period,
          startDate: startDate?.toISOString() || null,
          endDate: endDate?.toISOString() || null,
        },
        consolidated,
        storePnL,
        centralPnL,
      },
      {
        headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' },
      }
    );
  } catch (error: any) {
    console.error('API /api/accounting GET error:', error);
    return NextResponse.json({ error: error.message || 'Failed to generate accounting statements' }, { status: 500 });
  }
}
