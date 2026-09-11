import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySessionToken } from '@/lib/auth';
import { searchCustomerWithLegacyBridge } from '@/lib/services/legacyCustomerService';

/**
 * GET /api/customers/legacy/search - Search Customer across COSKO Master and Legacy DB
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
    const phone = searchParams.get('phone') || '';

    const result = await searchCustomerWithLegacyBridge(phone, user.role, user.store);

    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    console.error('API /api/customers/legacy/search error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Historical customer/repair lookup is temporarily unavailable. You can continue with the current COSKO customer record.',
      },
      { status: 200 } // Return 200 with error flag to prevent UI crash
    );
  }
}
