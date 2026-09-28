import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, hasPermission, createAuditLog } from '@/lib/authPipeline';
import { prisma } from '@/lib/db';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await authenticateRequest(req);
    if (!auth.user) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const user = auth.user;

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
