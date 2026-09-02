import { prisma } from '../db';
import { broadcastRealtimeEvent } from '../realtime';

export interface CreateTransferInput {
  sourceStore: string;
  destStore: string;
  requestedBy: string;
  notes?: string;
  items: {
    productId: string;
    qty: number;
    costPerUnit: number;
    transferPricePerUnit: number;
  }[];
}

/**
 * Executes Inter-Store Stock Transfer using atomic MySQL transaction, recording custom transfer price snapshots
 * and gross Central Profit without inflating consolidated company profit.
 */
export async function executeStockTransfer(input: CreateTransferInput) {
  if (input.sourceStore.toUpperCase() === input.destStore.toUpperCase()) {
    throw new Error('Source location and destination location cannot be identical.');
  }

  return await prisma.$transaction(async (tx: any) => {
    const count = await tx.stockTransfer.count();
    const seqNo = String(count + 1).padStart(4, '0');
    const transferNo = `TRF-2026-${seqNo}`;

    let totalUnits = 0;
    let totalCost = 0;
    let totalTransferValue = 0;

    const preparedItems = [];

    for (const item of input.items) {
      if (item.qty <= 0) {
        throw new Error(`Transfer quantity must be greater than 0 for product ID ${item.productId}`);
      }

      // Check available stock at Source location with atomic verification
      const sourceInv = await tx.inventory.findUnique({
        where: { productId_storeCode: { productId: item.productId, storeCode: input.sourceStore } },
      });

      const availableQty = sourceInv ? sourceInv.qtyOnHand : 0;
      if (availableQty < item.qty) {
        throw new Error(
          `Insufficient stock at ${input.sourceStore} for product ID ${item.productId}. Available: ${availableQty}, Requested: ${item.qty}`
        );
      }

      const lineCost = item.qty * item.costPerUnit;
      const lineValue = item.qty * item.transferPricePerUnit;
      const lineProfit = lineValue - lineCost;

      totalUnits += item.qty;
      totalCost += lineCost;
      totalTransferValue += lineValue;

      preparedItems.push({
        productId: item.productId,
        qty: item.qty,
        costPerUnit: item.costPerUnit,
        transferPricePerUnit: item.transferPricePerUnit,
        lineTotalCost: lineCost,
        lineTotalValue: lineValue,
        lineProfit,
      });

      // 1. Deduct from Source Store (e.g. CENTRAL)
      const newSourceQty = availableQty - item.qty;

      await tx.inventory.update({
        where: { productId_storeCode: { productId: item.productId, storeCode: input.sourceStore } },
        data: { qtyOnHand: newSourceQty },
      });

      await tx.inventoryLedger.create({
        data: {
          productId: item.productId,
          storeCode: input.sourceStore,
          refNo: transferNo,
          type: 'Stock Transfer Out',
          qtyChange: -item.qty,
          costPerUnit: item.costPerUnit,
          balanceAfter: newSourceQty,
          notes: `Transferred to ${input.destStore} (${transferNo})`,
          createdBy: input.requestedBy,
        },
      });

      // 2. Add to Destination Store (e.g. BLR / HYD / MUM / CHN)
      const destInv = await tx.inventory.findUnique({
        where: { productId_storeCode: { productId: item.productId, storeCode: input.destStore } },
      });
      const destQty = destInv ? destInv.qtyOnHand : 0;
      const newDestQty = destQty + item.qty;

      await tx.inventory.upsert({
        where: { productId_storeCode: { productId: item.productId, storeCode: input.destStore } },
        create: { productId: item.productId, storeCode: input.destStore, qtyOnHand: newDestQty, reorderPt: 5 },
        update: { qtyOnHand: newDestQty },
      });

      await tx.inventoryLedger.create({
        data: {
          productId: item.productId,
          storeCode: input.destStore,
          refNo: transferNo,
          type: 'Stock Transfer In',
          qtyChange: item.qty,
          costPerUnit: item.transferPricePerUnit,
          balanceAfter: newDestQty,
          notes: `Received from ${input.sourceStore} (${transferNo})`,
          createdBy: input.requestedBy,
        },
      });
    }

    const grossProfit = totalTransferValue - totalCost;

    const transfer = await tx.stockTransfer.create({
      data: {
        transferNo,
        sourceStore: input.sourceStore,
        destStore: input.destStore,
        status: 'Received',
        requestedBy: input.requestedBy,
        receivedBy: input.requestedBy,
        totalUnits,
        totalCost,
        totalTransferValue,
        grossProfit,
        notes: input.notes || null,
        items: {
          create: preparedItems,
        },
      },
      include: {
        items: true,
      },
    });

    await tx.auditLog.create({
      data: {
        module: 'Central Profit',
        action: 'Execute Stock Transfer',
        details: `Dispatched ${totalUnits} units from ${input.sourceStore} to ${input.destStore} (Transfer Value: ₹${totalTransferValue.toFixed(2)}, Central Profit: ₹${grossProfit.toFixed(2)})`,
        userEmail: input.requestedBy,
        userRole: 'Super Admin',
        storeCode: input.sourceStore,
      },
    });

    broadcastRealtimeEvent('transfers', 'TRANSFER_COMPLETED', { transferNo, sourceStore: input.sourceStore, destStore: input.destStore });
    broadcastRealtimeEvent('inventory', 'STOCK_UPDATED', { storeCode: input.sourceStore });
    broadcastRealtimeEvent('inventory', 'STOCK_UPDATED', { storeCode: input.destStore });

    return transfer;
  });
}
