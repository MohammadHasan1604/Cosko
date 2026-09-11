import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = getAuthUserFromRequest(req);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const repair = await prisma.repairEnquiry.findFirst({
      where: {
        OR: [{ id }, { ticketNo: id }],
      },
      include: {
        customer: true,
      },
    });

    if (!repair) {
      return NextResponse.json({ error: 'Repair enquiry not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      repair: {
        id: repair.id,
        ticketNo: repair.ticketNo,
        customerId: repair.customerId || '',
        customerName: repair.customerName,
        customerPhone: repair.customerPhone,
        normalizedPhone: repair.normalizedPhone,
        deviceName: repair.deviceName,
        issueDescription: repair.issueDescription,
        status: repair.status,
        estimatedCost: Number(repair.estimatedCost),
        storeCode: 'CENTRAL',
        enquiryDate: new Date(repair.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
        assignedTech: repair.assignedTech,
        createdAt: repair.createdAt,
        updatedAt: repair.updatedAt,
      },
    });
  } catch (error: any) {
    console.error('API /api/repairs/[id] GET error:', error);
    return NextResponse.json({ error: 'Failed to retrieve repair details' }, { status: 500 });
  }
}
