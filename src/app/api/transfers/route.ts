import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { executeStockTransfer, CreateTransferInput } from '@/lib/services/transferService';
import { broadcastRealtimeEvent } from '@/lib/realtime';

/**
 * GET /api/transfers - Retrieve stock transfers with store isolation
 */
export async function GET(req: NextRequest) {
  try {
    const user = getAuthUserFromRequest(req);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const store = searchParams.get('store');

    const where: any = {};

    if (user.role !== 'Super Admin') {
      where.OR = [
        { sourceStore: user.store },
        { destStore: user.store },
      ];
    } else if (store && store !== 'All Stores' && store !== 'ALL') {
      where.OR = [
        { sourceStore: store },
        { destStore: store },
      ];
    }

    const transfers = await prisma.stockTransfer.findMany({
      where,
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                sku: true,
                category: true,
                brand: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 100,
    });

    return NextResponse.json(
      { success: true, transfers },
      { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
    );
  } catch (error: any) {
    console.error('API /api/transfers GET error:', error);
    return NextResponse.json({ error: 'Failed to retrieve transfers' }, { status: 500 });
  }
}

/**
 * POST /api/transfers - Execute atomic stock transfer
 */
export async function POST(req: NextRequest) {
  try {
    const user = getAuthUserFromRequest(req);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Role check: Only Super Admin and Store Managers can create transfers
    if (user.securityLevel < 80) {
      return NextResponse.json({ error: 'Forbidden: Insufficient security level for stock transfer' }, { status: 403 });
    }

    const body: CreateTransferInput = await req.json();

    if (!body.sourceStore || !body.destStore) {
      return NextResponse.json({ error: 'Source store and destination store are required' }, { status: 400 });
    }

    if (
      body.sourceStore === 'All Stores' ||
      body.sourceStore === 'ALL' ||
      body.destStore === 'All Stores' ||
      body.destStore === 'ALL'
    ) {
      return NextResponse.json(
        { error: '"All Stores" is a reporting scope only, not an inventory-owning physical store. Transfers must be between physical locations (e.g. CENTRAL, BLR, MUM).' },
        { status: 400 }
      );
    }

    if (!body.items || body.items.length === 0) {
      return NextResponse.json({ error: 'Transfer items cannot be empty' }, { status: 400 });
    }

    // Store isolation check for Store Managers
    if (user.role !== 'Super Admin') {
      if (body.sourceStore !== user.store && !user.allowedStores?.includes(body.sourceStore)) {
        return NextResponse.json(
          { error: `Forbidden: You are not authorized to transfer inventory out of store "${body.sourceStore}"` },
          { status: 403 }
        );
      }
    }

    const transfer = await executeStockTransfer({
      ...body,
      requestedBy: user.name,
    });

    return NextResponse.json({ success: true, transfer }, { status: 201 });
  } catch (error: any) {
    console.error('API /api/transfers POST error:', error);
    const msg = error?.message || '';
    const isTechnical = msg.includes('prisma') || msg.includes('timeout') || msg.includes('invocation') || msg.includes('SQL') || msg.includes('Transaction');
    const userFriendlyError = isTechnical
      ? 'Stock transfer could not be completed. No inventory was changed. Please try again.'
      : msg || 'Stock transfer could not be completed. No inventory was changed. Please try again.';

    return NextResponse.json({ error: userFriendlyError }, { status: 400 });
  }
}

/**
 * PUT /api/transfers - Update transfer status or cancel transfer with inventory reversal
 */
export async function PUT(req: NextRequest) {
  try {
    const user = getAuthUserFromRequest(req);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.securityLevel < 80) {
      return NextResponse.json({ error: 'Forbidden: Insufficient permissions to modify stock transfers' }, { status: 403 });
    }

    const body = await req.json();
    const { id, status, notes } = body;

    if (!id) {
      return NextResponse.json({ error: 'Transfer ID is required' }, { status: 400 });
    }

    const existing = await prisma.stockTransfer.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Transfer not found' }, { status: 404 });
    }

    const isCancelling = (existing.status === 'Received' || existing.status === 'Completed' || existing.status === 'In Transit') && status === 'Cancelled';

    const updatedTransfer = await prisma.$transaction(async (tx: any) => {
      if (isCancelling && existing.items && existing.items.length > 0) {
        // Reverse inventory: Return to sourceStore, Deduct from destStore
        for (const it of existing.items) {
          // 1. Return to sourceStore
          const srcInv = await tx.inventory.findUnique({
            where: { productId_storeCode: { productId: it.productId, storeCode: existing.sourceStore } },
          });
          const srcPrevQty = srcInv ? srcInv.qtyOnHand : 0;
          const srcNewQty = srcPrevQty + it.qty;

          await tx.inventory.upsert({
            where: { productId_storeCode: { productId: it.productId, storeCode: existing.sourceStore } },
            create: { productId: it.productId, storeCode: existing.sourceStore, qtyOnHand: srcNewQty, reorderPt: 5 },
            update: { qtyOnHand: srcNewQty },
          });

          await tx.inventoryLedger.create({
            data: {
              productId: it.productId,
              storeCode: existing.sourceStore,
              refNo: existing.transferNo,
              type: 'TRANSFER_CANCEL_RETURN',
              qtyChange: it.qty,
              costPerUnit: it.costPerUnit,
              sellingPricePerUnit: it.transferPricePerUnit,
              balanceAfter: srcNewQty,
              notes: `Transfer ${existing.transferNo} cancelled. Restocked to ${existing.sourceStore}`,
              createdBy: user.name,
            },
          });

          // 2. Deduct from destStore
          const dstInv = await tx.inventory.findUnique({
            where: { productId_storeCode: { productId: it.productId, storeCode: existing.destStore } },
          });
          const dstPrevQty = dstInv ? dstInv.qtyOnHand : 0;
          const dstNewQty = Math.max(0, dstPrevQty - it.qty);

          await tx.inventory.upsert({
            where: { productId_storeCode: { productId: it.productId, storeCode: existing.destStore } },
            create: { productId: it.productId, storeCode: existing.destStore, qtyOnHand: dstNewQty, reorderPt: 5 },
            update: { qtyOnHand: dstNewQty },
          });

          await tx.inventoryLedger.create({
            data: {
              productId: it.productId,
              storeCode: existing.destStore,
              refNo: existing.transferNo,
              type: 'TRANSFER_CANCEL_REVERSAL',
              qtyChange: -it.qty,
              costPerUnit: it.costPerUnit,
              sellingPricePerUnit: it.transferPricePerUnit,
              balanceAfter: dstNewQty,
              notes: `Transfer ${existing.transferNo} cancelled. Reversed from ${existing.destStore}`,
              createdBy: user.name,
            },
          });
        }

        await tx.auditLog.create({
          data: {
            module: 'Stock Transfers',
            action: 'Cancel Transfer',
            details: `Cancelled transfer ${existing.transferNo} and reversed ${existing.items.length} line items between ${existing.sourceStore} and ${existing.destStore}`,
            userEmail: user.email || user.name,
            userRole: user.role,
            storeCode: existing.sourceStore,
          },
        });
      }

      const updated = await tx.stockTransfer.update({
        where: { id },
        data: {
          ...(status ? { status } : {}),
          ...(notes !== undefined ? { notes } : {}),
        },
      });

      return updated;
    });

    broadcastRealtimeEvent('transfers', 'TRANSFER_COMPLETED', { transferNo: existing.transferNo, action: 'status_updated' });
    if (isCancelling) {
      broadcastRealtimeEvent('inventory', 'STOCK_UPDATED', { storeCode: existing.sourceStore });
      broadcastRealtimeEvent('inventory', 'STOCK_UPDATED', { storeCode: existing.destStore });
    }

    return NextResponse.json({
      success: true,
      transfer: updatedTransfer,
      message: `Transfer ${existing.transferNo} updated to ${status}.`,
    });
  } catch (error: any) {
    console.error('API /api/transfers PUT error:', error);
    return NextResponse.json({ error: error.message || 'Failed to update transfer' }, { status: 500 });
  }
}

/**
 * DELETE /api/transfers - Cancel & reverse completed transfer or delete draft
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
      return NextResponse.json({ error: 'Transfer ID is required' }, { status: 400 });
    }

    const existing = await prisma.stockTransfer.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!existing) {
      return NextResponse.json({ success: true, message: 'Transfer already removed or non-existent' });
    }

    // Safe cancel and reverse inventory
    const cancelled = await prisma.$transaction(async (tx: any) => {
      if ((existing.status === 'Received' || existing.status === 'Completed' || existing.status === 'In Transit') && existing.items && existing.items.length > 0) {
        for (const it of existing.items) {
          const srcInv = await tx.inventory.findUnique({
            where: { productId_storeCode: { productId: it.productId, storeCode: existing.sourceStore } },
          });
          const srcPrevQty = srcInv ? srcInv.qtyOnHand : 0;
          const srcNewQty = srcPrevQty + it.qty;

          await tx.inventory.upsert({
            where: { productId_storeCode: { productId: it.productId, storeCode: existing.sourceStore } },
            create: { productId: it.productId, storeCode: existing.sourceStore, qtyOnHand: srcNewQty, reorderPt: 5 },
            update: { qtyOnHand: srcNewQty },
          });

          await tx.inventoryLedger.create({
            data: {
              productId: it.productId,
              storeCode: existing.sourceStore,
              refNo: existing.transferNo,
              type: 'TRANSFER_CANCEL_RETURN',
              qtyChange: it.qty,
              costPerUnit: it.costPerUnit,
              sellingPricePerUnit: it.transferPricePerUnit,
              balanceAfter: srcNewQty,
              notes: `Transfer ${existing.transferNo} cancelled. Restocked to ${existing.sourceStore}`,
              createdBy: user.name,
            },
          });

          const dstInv = await tx.inventory.findUnique({
            where: { productId_storeCode: { productId: it.productId, storeCode: existing.destStore } },
          });
          const dstPrevQty = dstInv ? dstInv.qtyOnHand : 0;
          const dstNewQty = Math.max(0, dstPrevQty - it.qty);

          await tx.inventory.upsert({
            where: { productId_storeCode: { productId: it.productId, storeCode: existing.destStore } },
            create: { productId: it.productId, storeCode: existing.destStore, qtyOnHand: dstNewQty, reorderPt: 5 },
            update: { qtyOnHand: dstNewQty },
          });

          await tx.inventoryLedger.create({
            data: {
              productId: it.productId,
              storeCode: existing.destStore,
              refNo: existing.transferNo,
              type: 'TRANSFER_CANCEL_REVERSAL',
              qtyChange: -it.qty,
              costPerUnit: it.costPerUnit,
              sellingPricePerUnit: it.transferPricePerUnit,
              balanceAfter: dstNewQty,
              notes: `Transfer ${existing.transferNo} cancelled. Reversed from ${existing.destStore}`,
              createdBy: user.name,
            },
          });
        }
      }

      const updated = await tx.stockTransfer.update({
        where: { id },
        data: { status: 'Cancelled' },
      });

      await tx.auditLog.create({
        data: {
          module: 'Stock Transfers',
          action: 'Cancel Transfer',
          details: `Cancelled transfer ${existing.transferNo} and reversed stock between ${existing.sourceStore} and ${existing.destStore}`,
          userEmail: user.email || user.name,
          userRole: user.role,
          storeCode: existing.sourceStore,
        },
      });

      return updated;
    });

    broadcastRealtimeEvent('transfers', 'TRANSFER_COMPLETED', { transferNo: existing.transferNo, action: 'cancelled' });
    broadcastRealtimeEvent('inventory', 'STOCK_UPDATED', { storeCode: existing.sourceStore });
    broadcastRealtimeEvent('inventory', 'STOCK_UPDATED', { storeCode: existing.destStore });

    return NextResponse.json({
      success: true,
      mode: 'archived',
      transfer: cancelled,
      message: `Transfer ${existing.transferNo} cancelled and stock reversed.`,
    });
  } catch (error: any) {
    console.error('API /api/transfers DELETE error:', error);
    return NextResponse.json({ error: error.message || 'Failed to cancel transfer' }, { status: 500 });
  }
}
