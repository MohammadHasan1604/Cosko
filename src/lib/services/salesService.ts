import { prisma } from '../db';
import { broadcastRealtimeEvent } from '../realtime';

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
  cashierName: string;
  photos?: string[];
}

/**
 * Executes a POS Sale Checkout using atomic MySQL transaction, generating sequential invoice number
 * and reducing store inventory with concurrency protection.
 */
export async function executePOSCheckout(input: CreateSaleInput) {
  return await prisma.$transaction(async (tx: any) => {
    // 1. Generate store-specific invoice number (e.g. CS260011, CS260012)
    const storeCode = input.storeCode.toUpperCase();
    const storeNumericMap: Record<string, string> = {
      BLR: '001',
      HYD: '002',
      DEL: '003',
      MUM: '004',
      CENTRAL: '000',
    };
    const store3Digit = storeNumericMap[storeCode] || storeCode.slice(0, 3);
    const count = await tx.salesOrder.count({ where: { storeCode } });
    const seqNo = String(count + 1);
    const orderNo = `CS26${store3Digit}${seqNo}`;

    let subtotal = 0;
    let totalCost = 0;

    const preparedItems = [];

    for (const item of input.items) {
      const lineSubtotal = item.qty * item.unitPrice * (1 - (item.discountPercent || 0) / 100);
      const lineCost = item.qty * item.unitCost;
      const lineProfit = lineSubtotal - lineCost;

      subtotal += lineSubtotal;
      totalCost += lineCost;

      preparedItems.push({
        productId: item.productId,
        productName: item.productName,
        sku: item.sku,
        qty: item.qty,
        unitPrice: item.unitPrice,
        unitCost: item.unitCost,
        discountPercent: item.discountPercent || 0,
        lineTotal: lineSubtotal,
        lineProfit,
      });

      // 2. Reduce Store Inventory & Record Ledger Entry
      const invRecord = await tx.inventory.findUnique({
        where: { productId_storeCode: { productId: item.productId, storeCode } },
      });

      const currentQty = invRecord ? invRecord.qtyOnHand : 0;
      const newQty = Math.max(0, currentQty - item.qty);

      await tx.inventory.upsert({
        where: { productId_storeCode: { productId: item.productId, storeCode } },
        create: {
          productId: item.productId,
          storeCode,
          qtyOnHand: newQty,
        },
        update: {
          qtyOnHand: newQty,
        },
      });

      await tx.inventoryLedger.create({
        data: {
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
        },
      });
    }

    const taxAmount = input.taxAmount || 0;
    const discountAmount = input.discountAmount || 0;
    const grandTotal = subtotal + taxAmount - discountAmount;
    const grossProfit = grandTotal - totalCost;

    // 3. Create Sales Order Record
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
        status: 'Completed',
        cashierName: input.cashierName,
        photosJson: input.photos ? JSON.stringify(input.photos) : null,
        items: {
          create: preparedItems,
        },
      },
      include: {
        items: true,
      },
    });

    // 4. Update Customer Total Spent
    if (input.customerId) {
      await tx.customer.update({
        where: { id: input.customerId },
        data: {
          totalSpent: { increment: grandTotal },
          totalOrders: { increment: 1 },
        },
      });
    }

    // 5. Create Audit Log Entry
    await tx.auditLog.create({
      data: {
        module: 'Sales',
        action: 'POS Checkout',
        details: `Completed order ${orderNo} for ${input.customerName} (Total: ₹${grandTotal.toFixed(2)})`,
        userEmail: input.cashierName,
        userRole: 'POS Cashier',
        storeCode,
      },
    });

    // 6. Broadcast Realtime SSE Event
    broadcastRealtimeEvent('sales', 'SALE_COMPLETED', { orderNo, grandTotal, storeCode });
    broadcastRealtimeEvent('inventory', 'STOCK_UPDATED', { storeCode });

    return sale;
  });
}
