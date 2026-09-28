import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/authPipeline';
import { prisma } from '@/lib/db';

/**
 * GET /api/repairs - Retrieve historical repair records from MySQL for read-only Customer 360 views.
 * Standalone repairs module has been removed. Mutation endpoints are decommissioned.
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req);
    if (!auth.user) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || 'All';
    const search = searchParams.get('search') || '';
    const customerPhone = searchParams.get('customerPhone') || '';

    const where: any = {};

    if (status && status !== 'All') {
      where.status = status;
    }

    if (customerPhone) {
      where.OR = [
        { customerPhone: { contains: customerPhone } },
        { normalizedPhone: { contains: customerPhone } },
      ];
    } else if (search) {
      where.OR = [
        { ticketNo: { contains: search } },
        { customerName: { contains: search } },
        { customerPhone: { contains: search } },
        { deviceName: { contains: search } },
        { issueDescription: { contains: search } },
      ];
    }

    const [dbRepairs, totalEnquiries, pendingCount, inProgressCount, completedCount] =
      await Promise.all([
        prisma.repairEnquiry.findMany({
          where,
          include: {
            customer: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
          take: 100,
        }),
        prisma.repairEnquiry.count(),
        prisma.repairEnquiry.count({
          where: { status: { in: ['Pending Diagnosis', 'Awaiting Parts'] } },
        }),
        prisma.repairEnquiry.count({ where: { status: 'In Progress' } }),
        prisma.repairEnquiry.count({ where: { status: { in: ['Completed', 'Delivered'] } } }),
      ]);

    const mappedRepairs = dbRepairs.map((r) => ({
      id: r.id,
      ticketNo: r.ticketNo,
      customerId: r.customerId || '',
      customerName: r.customerName,
      customerPhone: r.customerPhone,
      normalizedPhone: r.normalizedPhone,
      deviceName: r.deviceName,
      deviceType:
        r.deviceName.toLowerCase().includes('phone') ||
        r.deviceName.toLowerCase().includes('iphone')
          ? 'Mobile'
          : r.deviceName.toLowerCase().includes('ather') ||
              r.deviceName.toLowerCase().includes('ev')
            ? 'EV'
            : r.deviceName.toLowerCase().includes('ac') ||
                r.deviceName.toLowerCase().includes('inverter')
              ? 'AC'
              : r.deviceName.toLowerCase().includes('tv')
                ? 'TV'
                : r.deviceName.toLowerCase().includes('wash')
                  ? 'Washing Machine'
                  : 'Other',
      issueDescription: r.issueDescription,
      status: r.status,
      estimatedCost: Number(r.estimatedCost),
      storeCode: 'CENTRAL',
      enquiryDate: new Date(r.createdAt).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }),
      assignedTech: r.assignedTech,
      linkedCoskoSaleNo:
        (r.customer?.totalOrders || 0) > 0 ? `CS-CUST-${r.customer?.id?.slice(0, 4)}` : null,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));

    return NextResponse.json(
      {
        success: true,
        kpis: {
          totalEnquiries,
          pendingCount,
          inProgressCount,
          completedCount,
          customersWithRepairs: totalEnquiries,
          repairAndPurchaseCount: completedCount,
        },
        repairs: mappedRepairs,
      },
      { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
    );
  } catch (error: any) {
    console.error('API /api/repairs GET error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to retrieve repairs' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/repairs - DECOMMISSIONED
 * Standalone repairs module has been removed. Mutation is disabled.
 */
export async function POST() {
  return NextResponse.json(
    {
      error:
        'Standalone repairs module has been decommissioned. Repair records are read-only in Customer 360.',
      code: 'REPAIRS_DECOMMISSIONED',
    },
    { status: 410 }
  );
}

/**
 * PUT /api/repairs - DECOMMISSIONED
 */
export async function PUT() {
  return NextResponse.json(
    {
      error:
        'Standalone repairs module has been decommissioned. Repair records are read-only in Customer 360.',
      code: 'REPAIRS_DECOMMISSIONED',
    },
    { status: 410 }
  );
}

/**
 * DELETE /api/repairs - DECOMMISSIONED
 */
export async function DELETE() {
  return NextResponse.json(
    {
      error:
        'Standalone repairs module has been decommissioned. Historical repair records cannot be deleted.',
      code: 'REPAIRS_DECOMMISSIONED',
    },
    { status: 410 }
  );
}
