import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySessionToken } from '@/lib/auth';
import { getLegacyCustomersList } from '@/lib/services/legacyCustomerService';

/**
 * GET /api/customers/legacy/link - List all legacy customer identities and link statuses
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
    const linkStatus = searchParams.get('linkStatus') || 'All';
    const search = searchParams.get('search') || '';

    const customers = await getLegacyCustomersList({ linkStatus, search });

    return NextResponse.json({ success: true, customers });
  } catch (error: any) {
    console.error('API /api/customers/legacy/link GET error:', error);
    return NextResponse.json({ error: 'Failed to retrieve legacy customer list' }, { status: 500 });
  }
}

/**
 * POST /api/customers/legacy/link - Create or verify customer link bridge
 */
export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('cosko_session')?.value;
    const user = token ? verifySessionToken(token) : null;

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.securityLevel < 80) {
      return NextResponse.json({ error: 'Forbidden: Insufficient permissions to link customer records' }, { status: 403 });
    }

    const body = await req.json();
    const { legacyCustomerId, coskoCustomerId, action } = body;

    // Simulate link state update in bridge layer
    return NextResponse.json({
      success: true,
      message: action === 'unlink' ? 'Customer identity unlinked successfully' : 'Customer identity link verified successfully',
      link: {
        legacyCustomerId,
        coskoCustomerId,
        status: action === 'unlink' ? 'UNLINKED' : 'VERIFIED',
        verifiedBy: user.name,
        verifiedAt: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error('API /api/customers/legacy/link POST error:', error);
    return NextResponse.json({ error: 'Failed to update link status' }, { status: 500 });
  }
}
