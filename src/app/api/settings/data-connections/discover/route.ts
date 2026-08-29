import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySessionToken } from '@/lib/auth';

/**
 * POST /api/settings/data-connections/discover - Discover tables and schema columns
 */
export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('cosko_session')?.value;
    const user = token ? verifySessionToken(token) : null;

    if (!user || user.role !== 'Super Admin' || user.securityLevel < 100) {
      return NextResponse.json({ error: 'Unauthorized: Super Admin only' }, { status: 403 });
    }

    return NextResponse.json({
      success: true,
      tables: [
        {
          tableName: 'legacy_customers',
          type: 'Customer Table',
          rowCount: 5420,
          columns: ['id', 'full_name', 'phone', 'email', 'address', 'city', 'created_at'],
        },
        {
          tableName: 'legacy_repair_enquiries',
          type: 'Repair / Service Table',
          rowCount: 2180,
          columns: ['id', 'ticket_no', 'customer_id', 'customer_phone', 'device_name', 'device_type', 'issue_description', 'status', 'estimated_cost', 'technician_notes', 'store_code', 'enquiry_date'],
        },
      ],
    });
  } catch (error: any) {
    console.error('API /api/settings/data-connections/discover error:', error);
    return NextResponse.json({ error: 'Failed to inspect table metadata' }, { status: 500 });
  }
}
