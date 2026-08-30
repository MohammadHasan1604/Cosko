import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '@/lib/auth';
import { prisma } from '@/lib/db';

/**
 * GET /api/purchases - Retrieve purchase orders (excludes Archived/Cancelled by default)
 */
export async function GET(req: NextRequest) {
  try {
    const user = getAuthUserFromRequest(req);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const includeArchived = searchParams.get('includeArchived') === 'true';

    const whereClause: any = {};
    if (!includeArchived) {
      whereClause.status = { notIn: ['Archived', 'Cancelled'] };
    }

    const purchases = await (prisma as any).purchaseOrder.findMany({
      where: whereClause,
      include: {
        vendor: true,
        items: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 100,
    });

    return NextResponse.json(
      { success: true, purchases },
      { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
    );
  } catch (error: any) {
    console.error('API /api/purchases GET error:', error);
    return NextResponse.json({ error: 'Failed to retrieve purchase orders' }, { status: 500 });
  }
}

/**
 * POST /api/purchases - Create purchase order & handle GRN receiving
 */
export async function POST(req: NextRequest) {
  try {
    const user = getAuthUserFromRequest(req);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.securityLevel < 60) {
      return NextResponse.json({ error: 'Forbidden: Insufficient security level for purchases' }, { status: 403 });
    }

    const body = await req.json();

    if (!body.vendorName || !body.items || body.items.length === 0) {
      return NextResponse.json({ error: 'Vendor name and line items are required' }, { status: 400 });
    }

    const count = await (prisma as any).purchaseOrder.count();
    const poNo = `PO-2026-${String(count + 1).padStart(4, '0')}`;

    // Resolve or upsert vendor
    let vendor = await (prisma as any).vendor.findFirst({
      where: { name: body.vendorName },
    });

    if (!vendor) {
      const vCount = await (prisma as any).vendor.count();
      vendor = await (prisma as any).vendor.create({
        data: {
          code: `VEN-${String(vCount + 1).padStart(3, '0')}`,
          name: body.vendorName,
          contactPerson: body.vendorContact || 'Account Manager',
          email: `${body.vendorName.toLowerCase().replace(/[^a-z0-9]/g, '')}@supplier.com`,
          phone: body.vendorPhone || '+91 98000 00000',
          city: 'Central',
          address: 'Vendor Hub',
          categories: 'General Hardware',
        },
      });
    }

    const po = await (prisma as any).$transaction(async (tx: any) => {
      let subtotal = 0;
      for (const it of body.items) {
        subtotal += it.qty * it.costPrice;
      }
      const taxAmount = body.taxAmount || 0;
      const totalAmount = subtotal + taxAmount;

      const createdPO = await tx.purchaseOrder.create({
        data: {
          poNo,
          vendorId: vendor.id,
          storeCode: 'CENTRAL',
          status: body.status || 'Pending',
          paymentStatus: body.paymentStatus || 'Unpaid',
          totalCost: totalAmount,
          notes: body.notes || null,
          createdBy: user.name,
        },
      });

      // If created with status "Received", automatically credit CENTRAL inventory
      if (body.status === 'Received') {
        for (const it of body.items) {
          if (it.productId) {
            const centralInv = await tx.inventory.findUnique({
              where: { productId_storeCode: { productId: it.productId, storeCode: 'CENTRAL' } },
            });
            const prevQty = centralInv ? centralInv.qtyOnHand : 0;
            const newQty = prevQty + it.qty;

            await tx.inventory.upsert({
              where: { productId_storeCode: { productId: it.productId, storeCode: 'CENTRAL' } },
              create: { productId: it.productId, storeCode: 'CENTRAL', qtyOnHand: newQty },
              update: { qtyOnHand: newQty },
            });

            await tx.inventoryLedger.create({
              data: {
                productId: it.productId,
                storeCode: 'CENTRAL',
                refNo: poNo,
                type: 'PO GRN In',
                qtyChange: it.qty,
                costPerUnit: it.costPrice,
                balanceAfter: newQty,
                notes: `GRN Received from ${body.vendorName} (${poNo})`,
                createdBy: user.name,
              },
            });
          }
        }
      }

      return createdPO;
    });

    return NextResponse.json({ success: true, purchaseOrder: po }, { status: 201 });
  } catch (error: any) {
    console.error('API /api/purchases POST error:', error);
    return NextResponse.json({ error: error.message || 'Failed to create purchase order' }, { status: 500 });
  }
}

/**
 * PUT /api/purchases - Update purchase order status
 */
export async function PUT(req: NextRequest) {
  try {
    const user = getAuthUserFromRequest(req);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    if (!body.id) {
      return NextResponse.json({ error: 'Purchase Order ID is required' }, { status: 400 });
    }

    const po = await (prisma as any).purchaseOrder.update({
      where: { id: body.id },
      data: {
        ...(body.status ? { status: body.status } : {}),
        ...(body.paymentStatus ? { paymentStatus: body.paymentStatus } : {}),
        ...(body.notes !== undefined ? { notes: body.notes } : {}),
      },
    });

    return NextResponse.json({ success: true, purchaseOrder: po });
  } catch (error: any) {
    console.error('API /api/purchases PUT error:', error);
    return NextResponse.json({ error: error.message || 'Failed to update purchase order' }, { status: 500 });
  }
}

/**
 * DELETE /api/purchases - Delete a draft purchase order or cancel/archive received PO
 */
export async function DELETE(req: NextRequest) {
  try {
    const user = getAuthUserFromRequest(req);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.securityLevel < 80) {
      return NextResponse.json({ error: 'Forbidden: Insufficient security level' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Purchase Order ID is required' }, { status: 400 });
    }

    const existing = await (prisma as any).purchaseOrder.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ success: true, message: 'Purchase Order already deleted or non-existent' });
    }

    // Received POs have impacted inventory and financial ledgers; cancel/archive safely instead of destructive delete
    if (existing.status === 'Received' || existing.status === 'Completed') {
      const archived = await (prisma as any).purchaseOrder.update({
        where: { id },
        data: { status: 'Cancelled' },
      });
      return NextResponse.json({
        success: true,
        mode: 'archived',
        purchaseOrder: archived,
        message: `Completed Purchase Order ${existing.poNo} was cancelled/archived to preserve historical warehouse stock ledgers.`,
      });
    }

    // Hard-delete drafts / pending POs
    await (prisma as any).purchaseOrderItem.deleteMany({ where: { poId: id } });
    await (prisma as any).purchaseOrder.delete({ where: { id } });

    return NextResponse.json({
      success: true,
      mode: 'deleted',
      message: `Draft Purchase Order ${existing.poNo} permanently deleted.`,
    });
  } catch (error: any) {
    console.error('API /api/purchases DELETE error:', error);
    return NextResponse.json({ error: error.message || 'Failed to delete purchase order' }, { status: 500 });
  }
}

