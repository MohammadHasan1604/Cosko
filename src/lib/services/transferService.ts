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
  const sourceStore = input.sourceStore.trim().toUpperCase();
  const destStore = input.destStore.trim().toUpperCase();

  if (sourceStore === destStore) {
    throw new Error('Source location and destination location cannot be identical.');
  }

  if (!input.items || input.items.length === 0) {
    throw new Error('Transfer items list cannot be empty.');
  }

  // Pre-calculate line totals and prepare items outside interactive transaction
  let totalUnits = 0;
  let totalCost = 0;
  let totalTransferValue = 0;
  const productIds: string[] = [];

  const preparedItems: Array<{
    productId: string;
    qty: number;
    costPerUnit: number;
    transferPricePerUnit: number;
    lineTotalCost: number;
    lineTotalValue: number;
    lineProfit: number;
  }> = [];
  for (const item of input.items) {
    if (!item.qty || item.qty <= 0) {
      throw new Error(`Transfer quantity must be greater than 0 for product ID ${item.productId}`);
    }
    const cost = Number(item.costPerUnit) || 0;
    const transferPrice = Number(item.transferPricePerUnit) || 0;
    const lineCost = item.qty * cost;
    const lineValue = item.qty * transferPrice;
    const lineProfit = lineValue - lineCost;

    totalUnits += item.qty;
    totalCost += lineCost;
    totalTransferValue += lineValue;
    productIds.push(item.productId);

    preparedItems.push({
      productId: item.productId,
      qty: item.qty,
      costPerUnit: cost,
      transferPricePerUnit: transferPrice,
      lineTotalCost: lineCost,
      lineTotalValue: lineValue,
      lineProfit,
    });
  }

  const grossProfit = totalTransferValue - totalCost;

  // Generate transfer number safely before transaction to reduce query duration inside tx
  const count = await prisma.stockTransfer.count();
  const seqNo = String(count + 1).padStart(4, '0');
  const transferNo = `TRF-2026-${seqNo}`;

  // Execute atomic database changes with serverless-safe 15s timeout
  const transfer = await prisma.$transaction(
    async (tx: any) => {
      // 1. Batch fetch all source and destination inventory rows in parallel
      const [sourceInventories, destInventories] = await Promise.all([
        tx.inventory.findMany({
          where: {
            storeCode: sourceStore,
            productId: { in: productIds },
          },
        }),
        tx.inventory.findMany({
          where: {
            storeCode: destStore,
            productId: { in: productIds },
          },
        }),
      ]);

      const sourceInvMap = new Map<string, any>(sourceInventories.map((inv: any) => [inv.productId, inv]));
      const destInvMap = new Map<string, any>(destInventories.map((inv: any) => [inv.productId, inv]));

      // 2. Pre-verify all items have sufficient stock before making any updates
      for (const item of preparedItems) {
        const sourceInv = sourceInvMap.get(item.productId);
        const availableQty = sourceInv ? sourceInv.qtyOnHand : 0;
        if (availableQty < item.qty) {
          throw new Error(
            `Insufficient stock at ${sourceStore} for product ID ${item.productId}. Available: ${availableQty}, Requested: ${item.qty}`
          );
        }
      }

      // 3. Create Stock Transfer master & items snapshot
      const createdTransfer = await tx.stockTransfer.create({
        data: {
          transferNo,
          sourceStore,
          destStore,
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

      // 4. Update Source & Destination Inventory rows
      const ledgerEntries: any[] = [];

      for (const item of preparedItems) {
        const sourceInv = sourceInvMap.get(item.productId);
        const currentSourceQty = sourceInv ? sourceInv.qtyOnHand : 0;
        const newSourceQty = currentSourceQty - item.qty;

        await tx.inventory.update({
          where: { productId_storeCode: { productId: item.productId, storeCode: sourceStore } },
          data: { qtyOnHand: newSourceQty },
        });

        ledgerEntries.push({
          productId: item.productId,
          storeCode: sourceStore,
          refNo: transferNo,
          type: 'Stock Transfer Out',
          qtyChange: -item.qty,
          costPerUnit: item.costPerUnit,
          sellingPricePerUnit: item.transferPricePerUnit,
          balanceAfter: newSourceQty,
          notes: `Transferred to ${destStore} (${transferNo})`,
          createdBy: input.requestedBy,
        });

        const destInv = destInvMap.get(item.productId);
        const currentDestQty = destInv ? destInv.qtyOnHand : 0;
        const newDestQty = currentDestQty + item.qty;

        await tx.inventory.upsert({
          where: { productId_storeCode: { productId: item.productId, storeCode: destStore } },
          create: { productId: item.productId, storeCode: destStore, qtyOnHand: newDestQty, reorderPt: 5 },
          update: { qtyOnHand: newDestQty },
        });

        ledgerEntries.push({
          productId: item.productId,
          storeCode: destStore,
          refNo: transferNo,
          type: 'Stock Transfer In',
          qtyChange: item.qty,
          costPerUnit: item.transferPricePerUnit,
          sellingPricePerUnit: item.transferPricePerUnit,
          balanceAfter: newDestQty,
          notes: `Received from ${sourceStore} (${transferNo})`,
          createdBy: input.requestedBy,
        });
      }

      // 5. Batch create all ledger entries in a single query
      await tx.inventoryLedger.createMany({
        data: ledgerEntries,
      });

      // 6. Record Audit Log Entry
      await tx.auditLog.create({
        data: {
          module: 'Central Profit',
          action: 'Execute Stock Transfer',
          details: `Dispatched ${totalUnits} units from ${sourceStore} to ${destStore} (Transfer Value: ₹${totalTransferValue.toFixed(2)}, Central Profit: ₹${grossProfit.toFixed(2)})`,
          userEmail: input.requestedBy,
          userRole: 'Super Admin',
          storeCode: sourceStore,
        },
      });

      return createdTransfer;
    },
    {
      maxWait: 10000, // 10s wait for connection pool
      timeout: 15000, // 15s interactive timeout safe for remote cloud MySQL SSL
    }
  );

  // 7. Fire realtime broadcasts AFTER transaction commit
  try {
    broadcastRealtimeEvent('transfers', 'TRANSFER_COMPLETED', { transferNo, sourceStore, destStore });
    broadcastRealtimeEvent('inventory', 'STOCK_UPDATED', { storeCode: sourceStore });
    broadcastRealtimeEvent('inventory', 'STOCK_UPDATED', { storeCode: destStore });
  } catch (socketErr) {
    console.warn('Realtime broadcast notification failed (non-critical):', socketErr);
  }

  return transfer;
}
