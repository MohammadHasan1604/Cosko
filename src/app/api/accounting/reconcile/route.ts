import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '@/lib/auth';
import { runRootFinancialReconciliation } from '@/lib/services/accountingService';

/**
 * GET / POST /api/accounting/reconcile
 * Runs full root data integrity and mathematical reconciliation across all transactions, ledger, and P&L.
 */
export async function GET(req: NextRequest) {
  try {
    const user = getAuthUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const audit = await runRootFinancialReconciliation();
    return NextResponse.json(
      {
        success: true,
        audit,
      },
      {
        headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' },
      }
    );
  } catch (error: any) {
    console.error('API /api/accounting/reconcile GET error:', error);
    return NextResponse.json({ error: error.message || 'Failed to run root reconciliation' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
