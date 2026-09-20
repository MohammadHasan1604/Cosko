import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { normalizeMobileNumber } from '@/lib/phoneUtils';
import { broadcastRealtimeEvent } from '@/lib/realtime';
import { generateSafeSequenceNo } from '@/lib/sequenceUtils';
import { executeWithIdempotency } from '@/lib/idempotency';

/**
 * GET /api/repairs - Retrieve all repair records from MySQL and calculate live KPIs
 */
export async function GET(req: NextRequest) {
  try {
    const user = getAuthUserFromRequest(req);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || 'All';
    const search = searchParams.get('search') || '';
    const deviceType = searchParams.get('deviceType') || 'All';

    const where: any = {};

    if (status && status !== 'All') {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { ticketNo: { contains: search } },
        { customerName: { contains: search } },
        { customerPhone: { contains: search } },
        { deviceName: { contains: search } },
        { issueDescription: { contains: search } },
      ];
    }

    const [dbRepairs, totalEnquiries, pendingCount, inProgressCount, completedCount] = await Promise.all([
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
      prisma.repairEnquiry.count({ where: { status: { in: ['Pending Diagnosis', 'Awaiting Parts'] } } }),
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
      deviceType: r.deviceName.toLowerCase().includes('phone') || r.deviceName.toLowerCase().includes('iphone') ? 'Mobile' :
                  r.deviceName.toLowerCase().includes('ather') || r.deviceName.toLowerCase().includes('ev') ? 'EV' :
                  r.deviceName.toLowerCase().includes('ac') || r.deviceName.toLowerCase().includes('inverter') ? 'AC' :
                  r.deviceName.toLowerCase().includes('tv') ? 'TV' :
                  r.deviceName.toLowerCase().includes('wash') ? 'Washing Machine' : 'Other',
      issueDescription: r.issueDescription,
      status: r.status,
      estimatedCost: Number(r.estimatedCost),
      storeCode: 'CENTRAL',
      enquiryDate: new Date(r.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
      assignedTech: r.assignedTech,
      linkedCoskoSaleNo: (r.customer?.totalOrders || 0) > 0 ? `CS-CUST-${r.customer?.id?.slice(0, 4)}` : null,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));

    return NextResponse.json({
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
    }, { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } });
  } catch (error: any) {
    console.error('API /api/repairs GET error:', error);
    return NextResponse.json({ error: error.message || 'Failed to retrieve repairs' }, { status: 500 });
  }
}

/**
 * POST /api/repairs - Create a new repair ticket in MySQL atomically
 */
export async function POST(req: NextRequest) {
  try {
    const user = getAuthUserFromRequest(req);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();

    if (!body.customerName || !body.customerPhone || !body.deviceName || !body.issueDescription) {
      return NextResponse.json({ error: 'Customer Name, Phone, Device Name, and Issue Description are required' }, { status: 400 });
    }

    const normalized = normalizeMobileNumber(body.customerPhone);

    const customKey =
      body.idempotencyKey ||
      req.headers.get('x-idempotency-key') ||
      `rep_${normalized}_${body.deviceName}_${Date.now()}`;

    return await executeWithIdempotency(
      req,
      {
        action: 'CREATE_REPAIR',
        key: customKey,
        userId: user.id,
        extractEntityId: (d) => d?.repair?.id || d?.repair?.ticketNo,
      },
      async () => {
        const repair = await prisma.$transaction(async (tx: any) => {
          const ticketNo = body.ticketNo || await generateSafeSequenceNo('repairEnquiry', 'ticketNo', 'TKT-2026-', 4, tx);

          // Link customer if exists or create
          let cust = await tx.customer.findFirst({
            where: { normalizedPhone: normalized },
          });

          if (!cust && body.createCustomerIfNotExists) {
            cust = await tx.customer.create({
              data: {
                name: body.customerName,
                phone: body.customerPhone,
                normalizedPhone: normalized,
                city: user.store || 'Bengaluru',
                status: 'Active',
              },
            });
          }

          return tx.repairEnquiry.create({
            data: {
              ticketNo,
              customerId: cust ? cust.id : (body.customerId || null),
              customerName: body.customerName.trim(),
              customerPhone: body.customerPhone.trim(),
              normalizedPhone: normalized,
              deviceName: body.deviceName.trim(),
              issueDescription: body.issueDescription.trim(),
              estimatedCost: body.estimatedCost !== undefined && body.estimatedCost !== null && body.estimatedCost !== '' ? Number(body.estimatedCost) : 0,
              status: body.status || 'Pending Diagnosis',
              assignedTech: body.assignedTech || user.name || 'Service Desk',
            },
          });
        }, { maxWait: 15000, timeout: 45000 });

        broadcastRealtimeEvent('repairs', 'REPAIR_UPDATED', { id: repair.id, ticketNo: repair.ticketNo, action: 'created' });

        return { status: 201, data: { success: true, repair } };
      }
    );
  } catch (error: any) {
    console.error('API /api/repairs POST error:', error);
    return NextResponse.json({ error: error.message || 'Failed to create repair ticket' }, { status: 500 });
  }
}

/**
 * PUT /api/repairs - Update existing repair record in MySQL
 */
export async function PUT(req: NextRequest) {
  try {
    const user = getAuthUserFromRequest(req);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const id = body.id || body.repairId;

    if (!id && !body.ticketNo) {
      return NextResponse.json({ error: 'Repair ID or Ticket No is required' }, { status: 400 });
    }

    const target = id
      ? await prisma.repairEnquiry.findUnique({ where: { id } })
      : await prisma.repairEnquiry.findUnique({ where: { ticketNo: body.ticketNo } });

    if (!target) {
      return NextResponse.json({ error: 'Repair ticket not found' }, { status: 404 });
    }

    const updateData: any = {};
    if (body.customerName) updateData.customerName = body.customerName.trim();
    if (body.customerPhone) {
      updateData.customerPhone = body.customerPhone.trim();
      updateData.normalizedPhone = normalizeMobileNumber(body.customerPhone);
    }
    if (body.deviceName) updateData.deviceName = body.deviceName.trim();
    if (body.issueDescription) updateData.issueDescription = body.issueDescription.trim();
    if (body.status) updateData.status = body.status;
    if (body.estimatedCost !== undefined && body.estimatedCost !== null && body.estimatedCost !== '') {
      updateData.estimatedCost = Number(body.estimatedCost);
    }
    if (body.assignedTech !== undefined) updateData.assignedTech = body.assignedTech;

    const updated = await prisma.repairEnquiry.update({
      where: { id: target.id },
      data: updateData,
      include: {
        customer: true,
      },
    });

    broadcastRealtimeEvent('repairs', 'REPAIR_UPDATED', { id: updated.id, ticketNo: updated.ticketNo, action: 'updated' });

    return NextResponse.json({ success: true, repair: updated });
  } catch (error: any) {
    console.error('API /api/repairs PUT error:', error);
    return NextResponse.json({ error: error.message || 'Failed to update repair ticket' }, { status: 500 });
  }
}

/**
 * DELETE /api/repairs - Delete a repair ticket from MySQL
 */
export async function DELETE(req: NextRequest) {
  try {
    const user = getAuthUserFromRequest(req);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.securityLevel < 60) {
      return NextResponse.json({ error: 'Forbidden: Insufficient security level' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Repair ID is required' }, { status: 400 });
    }

    const target = await prisma.repairEnquiry.findFirst({
      where: { OR: [{ id }, { ticketNo: id }] },
    });

    if (!target) {
      return NextResponse.json({ success: true, message: 'Ticket already removed' });
    }

    await prisma.repairEnquiry.delete({
      where: { id: target.id },
    });

    broadcastRealtimeEvent('repairs', 'REPAIR_UPDATED', { id: target.id, action: 'deleted' });

    return NextResponse.json({ success: true, message: `Repair ticket ${target.ticketNo} deleted successfully` });
  } catch (error: any) {
    console.error('API /api/repairs DELETE error:', error);
    return NextResponse.json({ error: error.message || 'Failed to delete repair ticket' }, { status: 500 });
  }
}
