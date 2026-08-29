import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySessionToken } from '@/lib/auth';
import { prisma } from '@/lib/db';

/**
 * GET /api/purchases - Retrieve purchase orders
 */
export async function GET(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('cosko_session')?.value;
    const user = token ? verifySessionToken(token) : null;

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const purchases = await (prisma as any).purchaseOrder.findMany({
      include: {
        vendor: true,
        items: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 100,
    });

    return NextResponse.json({ success: true, purchases });
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
    const cookieStore = await cookies();
    const token = cookieStore.get('cosko_session')?.value;
    const user = token ? verifySessionToken(token) : null;

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
