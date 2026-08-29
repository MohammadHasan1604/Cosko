import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySessionToken } from '@/lib/auth';
import { getLegacyRepairById } from '@/lib/services/legacyCustomerService';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('cosko_session')?.value;
    const user = token ? verifySessionToken(token) : null;

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const repair = await getLegacyRepairById(id, user.role);

    if (!repair) {
      return NextResponse.json({ error: 'Repair enquiry not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, repair });
  } catch (error: any) {
    console.error('API /api/repairs/[id] GET error:', error);
    return NextResponse.json({ error: 'Failed to retrieve repair details' }, { status: 500 });
  }
}
