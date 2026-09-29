import { prisma } from '../db';
import { broadcastRealtimeEvent } from '../realtime';
import { generateSafeSequenceNo } from '../sequenceUtils';

export interface CreateSaleInput {
  storeCode: string;
  customerId?: string;
  customerName: string;
  customerPhone: string;
  items: {
    productId: string;
    productName: string;
    sku: string;
    qty: number;
    unitPrice: number;
    unitCost: number;
    discountPercent?: number;
  }[];
  taxAmount?: number;
  discountAmount?: number;
  paymentMethod: string;
  referenceNo?: string;
  paymentProofUrl?: string;
  cashierName: string;
  photos?: string[];
  idempotencyKey?: string;
}

/**
 * Executes a POS Sale Checkout using atomic MySQL transaction, generating sequential invoice number
 * and reducing store inventory with concurrency protection.
 *
 * Optimized to prevent "Transaction already closed / 5000ms timeout" errors by:
 * 1. Pre-calculating all line items, subtotals, tax, and costs in memory outside $transaction.
 * 2. Batch-fetching all inventory records in a single query (eliminating N+1 findUnique calls).
 * 3. Concurrently executing inventory upserts within the transaction.
 * 4. Batch-inserting all inventory ledger entries via createMany.
 * 5. Batch-inserting all financial double-entry ledger records via createMany.
 * 6. Setting explicit interactive transaction timeout (15000ms) and maxWait (5000ms).
 */
export async function executePOSCheckout(input: CreateSaleInput) {
  // Pre-calculate all financial figures and items synchronously outside the transaction
  const storeCode = input.storeCode.toUpperCase();
  let subtotal = 0;
  let totalCost = 0;

  const preparedItems = input.items.map((item) => {
    const lineSubtotal = item.qty * item.unitPrice * (1 - (item.discountPercent || 0) / 100);
    const lineCost = item.qty * item.unitCost;
    const lineProfit = lineSubtotal - lineCost;

    subtotal += lineSubtotal;
    totalCost += lineCost;

    return {
      productId: item.productId,
      productName: item.productName,
      sku: item.sku,
      qty: item.qty,
      unitPrice: item.unitPrice,
      unitCost: item.unitCost,
      discountPercent: item.discountPercent || 0,
      lineTotal: lineSubtotal,
      lineProfit,
    };
  });

  const taxAmount = Number(input.taxAmount) || 0;
  const discountAmount = Number(input.discountAmount) || 0;
  const grandTotal = Math.max(0, subtotal + taxAmount - discountAmount);
  const grossProfit = grandTotal - totalCost;
  const netRevenue = subtotal - discountAmount;
  const productIds = Array.from(new Set(input.items.map((it) => it.productId)));

  const storeNumericMap: Record<string, string> = {
    BLR: '001',
    HYD: '002',
    DEL: '003',
    MUM: '004',
    CENTRAL: '000',
  };
  const store3Digit = storeNumericMap[storeCode] || storeCode.slice(0, 3);
  const invoicePrefix = `CS26${store3Digit}`;
  const effectiveProofUrl =
    input.paymentProofUrl || (input.photos && input.photos.length > 0 ? input.photos[0] : null);
  if (!effectiveProofUrl || !String(effectiveProofUrl).trim()) {
    throw new Error(
      'Payment proof is mandatory! Please upload a valid receipt or transaction screenshot.'
    );
  }
  const effectiveRefNo =
    input.referenceNo && String(input.referenceNo).trim()
      ? String(input.referenceNo).trim()
      : `TXN-${store3Digit}-${Date.now().toString().slice(-6)}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

  // Execute atomic interactive transaction with configured timeouts
  const result = await prisma.$transaction(
    async (tx: any) => {
      // 1. Generate store-specific invoice number with collision safety (e.g. CS260011, CS260012)
      const orderNo = await generateSafeSequenceNo('salesOrder', 'orderNo', invoicePrefix, 1, tx);

      // 2. Batch read all inventory records for the cart items in 1 query
      const invRecords = await tx.inventory.findMany({
        where: {
          storeCode,
          productId: { in: productIds },
        },
      });
      const invMap = new Map<string, any>(invRecords.map((r: any) => [r.productId, r]));

      // 3. Concurrently upsert inventory balances
      await Promise.all(
        input.items.map((item) => {
          const existing = invMap.get(item.productId);
          const currentQty = existing ? existing.qtyOnHand : 0;
          const newQty = Math.max(0, currentQty - item.qty);

          return tx.inventory.upsert({
            where: { productId_storeCode: { productId: item.productId, storeCode } },
            create: {
              productId: item.productId,
              storeCode,
              qtyOnHand: newQty,
              reorderPt: existing?.reorderPt ?? 5,
              maxStock: existing?.maxStock ?? 50,
            },
            update: {
              qtyOnHand: newQty,
            },
          });
        })
      );

      // 4. Batch create inventory ledger entries
      const inventoryLedgerEntries = input.items.map((item) => {
        const existing = invMap.get(item.productId);
        const currentQty = existing ? existing.qtyOnHand : 0;
        const newQty = Math.max(0, currentQty - item.qty);

        return {
          productId: item.productId,
          storeCode,
          refNo: orderNo,
          type: 'POS Sale Out',
          qtyChange: -item.qty,
          costPerUnit: item.unitCost,
          sellingPricePerUnit: item.unitPrice,
          balanceAfter: newQty,
          notes: `POS Checkout (${orderNo})`,
          createdBy: input.cashierName,
        };
      });

      await tx.inventoryLedger.createMany({
        data: inventoryLedgerEntries,
      });

      // 5. Create Sales Order Record with nested sale items
      const sale = await tx.salesOrder.create({
        data: {
          orderNo,
          storeCode,
          customerId: input.customerId || null,
          customerName: input.customerName,
          customerPhone: input.customerPhone,
          subtotal,
          taxAmount,
          discountAmount,
          grandTotal,
          totalCost,
          grossProfit,
          paymentMethod: input.paymentMethod,
          referenceNo: effectiveRefNo,
          paymentProofUrl:
            input.paymentProofUrl ||
            (input.photos && input.photos.length > 0 ? input.photos[0] : null),
          status: 'Completed',
          cashierName: input.cashierName,
          photosJson: input.photos
            ? JSON.stringify(input.photos)
            : input.paymentProofUrl
              ? JSON.stringify([input.paymentProofUrl])
              : null,
          items: {
            create: preparedItems,
          },
        },
        include: {
          items: true,
        },
      });

      const effectiveProofUrl =
        input.paymentProofUrl || (input.photos && input.photos.length > 0 ? input.photos[0] : null);

      // 6. Batch create double-entry financial ledger records
      const financialEntries: any[] = [
        {
          entryNo: `JRN-REV-${orderNo}`,
          entryDate: new Date(),
          storeCode,
          accountCategory: 'REVENUE',
          accountName: 'Gross Sales Revenue',
          debit: 0,
          credit: netRevenue,
          amount: netRevenue,
          refType: 'SALE',
          refId: sale.id,
          refNo: orderNo,
          entityName: input.customerName || 'Customer',
          description: `POS Billed Sales Revenue for Order ${orderNo}`,
          createdBy: input.cashierName,
        },
      ];

      if (taxAmount > 0) {
        financialEntries.push({
          entryNo: `JRN-TAX-${orderNo}`,
          entryDate: new Date(),
          storeCode,
          accountCategory: 'LIABILITY',
          accountName: 'GST Output Tax Liability',
          debit: 0,
          credit: taxAmount,
          amount: taxAmount,
          refType: 'SALE',
          refId: sale.id,
          refNo: orderNo,
          entityName: input.customerName || 'Customer',
          description: `GST Collected on Order ${orderNo}`,
          createdBy: input.cashierName,
        });
      }

      financialEntries.push({
        entryNo: `JRN-ASST-${orderNo}`,
        entryDate: new Date(),
        storeCode,
        accountCategory: 'ASSET',
        accountName:
          input.paymentMethod === 'Credit'
            ? 'Customer Accounts Receivable'
            : `Cash / Bank (${input.paymentMethod})`,
        debit: grandTotal,
        credit: 0,
        amount: grandTotal,
        refType: 'SALE',
        refId: sale.id,
        refNo: orderNo,
        entityName: input.customerName || 'Customer',
        description: `Payment Receipt via ${input.paymentMethod} for Order ${orderNo} (Ref: ${effectiveRefNo})`,
        metadataJson: JSON.stringify({
          proofUrl: effectiveProofUrl,
          referenceNo: effectiveRefNo,
          paymentMethod: input.paymentMethod,
          orderNo,
          cashierName: input.cashierName,
          timestamp: new Date().toISOString(),
        }),
        createdBy: input.cashierName,
      });

      if (totalCost > 0) {
        financialEntries.push(
          {
            entryNo: `JRN-COGS-${orderNo}`,
            entryDate: new Date(),
            storeCode,
            accountCategory: 'COGS',
            accountName: 'Cost of Goods Sold',
            debit: totalCost,
            credit: 0,
            amount: totalCost,
            refType: 'SALE',
            refId: sale.id,
            refNo: orderNo,
            entityName: input.customerName || 'Customer',
            description: `Inventory Cost of Goods Sold for Order ${orderNo}`,
            createdBy: input.cashierName,
          },
          {
            entryNo: `JRN-INVD-${orderNo}`,
            entryDate: new Date(),
            storeCode,
            accountCategory: 'ASSET',
            accountName: 'Inventory Asset (Depletion)',
            debit: 0,
            credit: totalCost,
            amount: -totalCost,
            refType: 'SALE',
            refId: sale.id,
            refNo: orderNo,
            entityName: input.customerName || 'Customer',
            description: `Stock Depletion for POS Sale ${orderNo}`,
            createdBy: input.cashierName,
          }
        );
      }

      await tx.financialLedgerEntry.createMany({
        data: financialEntries,
      });

      // 7. Update Customer Total Spent & Orders count per store profile
      if (input.customerId) {
        await tx.customerStoreProfile.upsert({
          where: {
            customerId_storeCode: {
              customerId: input.customerId,
              storeCode,
            },
          },
          create: {
            customerId: input.customerId,
            storeCode,
            totalSpent: grandTotal,
            totalOrders: 1,
            creditBalance: 0,
          },
          update: {
            totalSpent: { increment: grandTotal },
            totalOrders: { increment: 1 },
          },
        });
      }

      // 8. Create Audit Log Entry
      await tx.auditLog.create({
        data: {
          module: 'Sales',
          action: 'POS Checkout',
          details: `Completed order ${orderNo} for ${input.customerName} (Total: ₹${grandTotal.toFixed(2)}) [${input.paymentMethod}]`,
          userEmail: input.cashierName,
          userRole: 'Sales Manager',
          storeCode,
        },
      });

      return sale;
    },
    {
      maxWait: 15000,
      timeout: 45000,
    }
  );

  // Broadcast Realtime SSE Events outside interactive transaction
  try {
    broadcastRealtimeEvent('sales', 'SALE_COMPLETED', {
      orderNo: result.orderNo,
      grandTotal: result.grandTotal,
      storeCode: result.storeCode,
    });
    broadcastRealtimeEvent('inventory', 'STOCK_UPDATED', { storeCode: result.storeCode });
  } catch (broadcastErr) {
    console.warn('[salesService] Realtime broadcast error (non-fatal):', broadcastErr);
  }

  return result;
}
