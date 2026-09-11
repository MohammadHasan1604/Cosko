import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { broadcastRealtimeEvent } from '@/lib/realtime';

/**
 * POST /api/inventory/adjust - Atomic stock adjustment with ledger entry
 */
export async function POST(req: NextRequest) {
  try {
    const user = getAuthUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.securityLevel < 60) {
      return NextResponse.json({ error: 'Forbidden: Insufficient security level for stock adjustment' }, { status: 403 });
    }

    const body = await req.json();

    if (!body.productId || !body.storeCode || body.qtyChange === undefined || body.qtyChange === 0) {
      return NextResponse.json({ error: 'productId, storeCode, and non-zero qtyChange are required' }, { status: 400 });
    }

    if (body.storeCode === 'All Stores' || body.storeCode === 'ALL') {
      return NextResponse.json({ error: '"All Stores" is a reporting scope only. Adjustments must target a physical store.' }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx: any) => {
      const inv = await tx.inventory.findUnique({
        where: { productId_storeCode: { productId: body.productId, storeCode: body.storeCode } },
      });

      const currentQty = inv ? inv.qtyOnHand : 0;
      const newQty = Math.max(0, currentQty + body.qtyChange);

      await tx.inventory.upsert({
        where: { productId_storeCode: { productId: body.productId, storeCode: body.storeCode } },
        create: { productId: body.productId, storeCode: body.storeCode, qtyOnHand: newQty },
        update: { qtyOnHand: newQty },
      });

      const product = await tx.product.findUnique({
        where: { id: body.productId },
        select: { baseCostPrice: true, sku: true, name: true },
      });

      const refNo = `ADJ-${Date.now().toString().slice(-8)}`;

      await tx.inventoryLedger.create({
        data: {
          productId: body.productId,
          storeCode: body.storeCode,
          refNo,
          type: 'Stock Adjustment',
          qtyChange: body.qtyChange,
          costPerUnit: Number(product?.baseCostPrice) || 0,
          balanceAfter: newQty,
          notes: body.reason || 'Manual stock adjustment',
          createdBy: user.name,
        },
      });

      await tx.auditLog.create({
        data: {
          module: 'Inventory',
          action: 'Stock Adjustment',
          details: `Adjusted ${product?.name || body.productId} (${product?.sku || 'N/A'}) by ${body.qtyChange > 0 ? '+' : ''}${body.qtyChange} at ${body.storeCode}. New balance: ${newQty}. Reason: ${body.reason || 'Manual adjustment'}`,
          userEmail: user.email || user.name,
          userRole: user.role,
          storeCode: body.storeCode,
        },
      });

      return { newQty, refNo };
    });

    broadcastRealtimeEvent('inventory', 'STOCK_UPDATED', { storeCode: body.storeCode, productId: body.productId });

    return NextResponse.json({
      success: true,
      newQty: result.newQty,
      refNo: result.refNo,
    });
  } catch (error: any) {
    console.error('API /api/inventory/adjust POST error:', error);
    return NextResponse.json({ error: error.message || 'Failed to adjust stock' }, { status: 500 });
  }
}
