import { prisma } from '../src/lib/db';

async function main() {
  console.log('=== VERIFYING MULTI-PRODUCT PURCHASE ORDER WORKFLOW E2E ===\n');

  // 1. Ensure a vendor and store exist
  let vendor = await prisma.vendor.findFirst({ where: { status: 'Active' } });
  if (!vendor) {
    vendor = await prisma.vendor.create({
      data: {
        code: 'VEN-TEST-001',
        name: 'Alpha Wholesale Electronics',
        storeCode: 'BLR',
        contactPerson: 'Arun Kumar',
        email: 'arun@alphawholesale.com',
        phone: '+91 98888 77777',
        city: 'Bengaluru',
        categories: 'Electronics',
        gstin: '29ABCDE1234F1Z5',
        status: 'Active',
      },
    });
  }
  console.log(`Using Vendor: ${vendor.name} (${vendor.code})`);

  // 2. Ensure test products exist
  let prod1 = await prisma.product.findFirst({ where: { sku: 'TEST-SKU-OLED' } });
  if (!prod1) {
    prod1 = await prisma.product.create({
      data: {
        sku: 'TEST-SKU-OLED',
        name: 'OLED Display Panel X1',
        category: 'Displays',
        baseCostPrice: 1000.0,
        baseSellingPrice: 1500.0,
        gstRate: 18.0,
        status: 'active',
      },
    });
  }

  let prod2 = await prisma.product.findFirst({ where: { sku: 'TEST-SKU-CHRG' } });
  if (!prod2) {
    prod2 = await prisma.product.create({
      data: {
        sku: 'TEST-SKU-CHRG',
        name: 'Fast Charger 65W GaN',
        category: 'Accessories',
        baseCostPrice: 500.0,
        baseSellingPrice: 899.0,
        gstRate: 12.0,
        status: 'active',
      },
    });
  }
  console.log(`Product 1: ${prod1.name} (${prod1.sku})`);
  console.log(`Product 2: ${prod2.name} (${prod2.sku})`);

  const storeCode = 'CENTRAL';

  // Record initial stock
  const initInv1 = await prisma.inventory.findUnique({
    where: { productId_storeCode: { productId: prod1.id, storeCode } },
  });
  const initInv2 = await prisma.inventory.findUnique({
    where: { productId_storeCode: { productId: prod2.id, storeCode } },
  });
  const startQty1 = initInv1 ? initInv1.qtyOnHand : 0;
  const startQty2 = initInv2 ? initInv2.qtyOnHand : 0;
  console.log(`Initial stock in ${storeCode} -> Prod1: ${startQty1}, Prod2: ${startQty2}`);

  // 3. Create Multi-Product Purchase Order via Prisma Transaction
  const poNo = `PO-TEST-${Date.now().toString().slice(-6)}`;
  const orderDate = new Date();
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 30);

  // Line item 1: Qty 5 @ 1000, 18% GST, 100 discount
  // Subtotal = 5000, Taxable = 4900, Tax = 882, Line Total = 5782
  const item1Qty = 5;
  const item1Cost = 1000.0;
  const item1TaxRate = 18.0;
  const item1Discount = 100.0;
  const item1Sub = item1Qty * item1Cost;
  const item1Tax = Math.round(((item1Sub - item1Discount) * item1TaxRate) / 100 * 100) / 100;
  const item1Total = item1Sub - item1Discount + item1Tax;

  // Line item 2: Qty 10 @ 500, 12% GST, 50 discount
  // Subtotal = 5000, Taxable = 4950, Tax = 594, Line Total = 5544
  const item2Qty = 10;
  const item2Cost = 500.0;
  const item2TaxRate = 12.0;
  const item2Discount = 50.0;
  const item2Sub = item2Qty * item2Cost;
  const item2Tax = Math.round(((item2Sub - item2Discount) * item2TaxRate) / 100 * 100) / 100;
  const item2Total = item2Sub - item2Discount + item2Tax;

  const totalSub = item1Sub + item2Sub; // 10000
  const totalTax = item1Tax + item2Tax; // 882 + 594 = 1476
  const totalDisc = item1Discount + item2Discount; // 150
  const grandTotal = totalSub - totalDisc + totalTax; // 11326

  console.log('\nCalculated Financials:');
  console.log(`- Items Subtotal: ₹${totalSub}`);
  console.log(`- Total Discount: ₹${totalDisc}`);
  console.log(`- Total GST: ₹${totalTax}`);
  console.log(`- Grand Total: ₹${grandTotal}`);

  const createdPO = await prisma.$transaction(async (tx) => {
    const po = await (tx as any).purchaseOrder.create({
      data: {
        poNo,
        invoiceNo: `INV-${poNo}`,
        vendorId: vendor.id,
        storeCode,
        status: 'Ordered',
        paymentStatus: 'Unpaid',
        subtotal: totalSub,
        taxAmount: totalTax,
        discountAmount: totalDisc,
        totalCost: grandTotal,
        paidAmount: 0,
        creditAmount: 0,
        dueDate,
        expectedDate: dueDate,
        notes: 'Automated Multi-Product E2E Test PO',
        createdBy: 'E2E Test Runner',
      },
    });

    await (tx as any).purchaseOrderItem.create({
      data: {
        poId: po.id,
        productId: prod1.id,
        qtyOrdered: item1Qty,
        qtyReceived: 0,
        unitCost: item1Cost,
        taxRate: item1TaxRate,
        taxAmount: item1Tax,
        discount: item1Discount,
        lineTotal: item1Total,
      },
    });

    await (tx as any).purchaseOrderItem.create({
      data: {
        poId: po.id,
        productId: prod2.id,
        qtyOrdered: item2Qty,
        qtyReceived: 0,
        unitCost: item2Cost,
        taxRate: item2TaxRate,
        taxAmount: item2Tax,
        discount: item2Discount,
        lineTotal: item2Total,
      },
    });

    return po;
  });

  console.log(`\nCreated Multi-Product PO in DB: ${createdPO.poNo} (ID: ${createdPO.id})`);

  // Verify created PO & items in DB
  const fetchedPO: any = await (prisma as any).purchaseOrder.findUnique({
    where: { id: createdPO.id },
    include: { items: { include: { product: true } }, vendor: true },
  });

  console.log(`Items in PO: ${fetchedPO.items.length}`);
  if (fetchedPO.items.length !== 2) {
    throw new Error(`Expected 2 items in PO, found ${fetchedPO.items.length}`);
  }

  for (const it of fetchedPO.items) {
    console.log(`  -> Item: ${it.product.name} (${it.product.sku}) | Qty: ${it.qtyOrdered} | Unit Cost: ₹${it.unitCost} | GST: ${it.taxRate}% | Total: ₹${it.lineTotal}`);
  }

  if (Number(fetchedPO.totalCost) !== grandTotal) {
    throw new Error(`Grand total mismatch: expected ${grandTotal}, got ${fetchedPO.totalCost}`);
  }
  console.log('✔ Multi-item PO creation & calculations verified.');

  // 4. Test GRN Goods Receiving Workflow
  console.log('\nSimulating Goods Receiving (GRN) for all items...');
  await prisma.$transaction(async (tx) => {
    for (const it of fetchedPO.items) {
      const curInv = await tx.inventory.findUnique({
        where: { productId_storeCode: { productId: it.productId, storeCode } },
      });
      const prevQty = curInv ? curInv.qtyOnHand : 0;
      const newQty = prevQty + it.qtyOrdered;

      await tx.inventory.upsert({
        where: { productId_storeCode: { productId: it.productId, storeCode } },
        create: {
          productId: it.productId,
          storeCode,
          qtyOnHand: newQty,
          reorderPt: 5,
        },
        update: {
          qtyOnHand: newQty,
        },
      });

      await tx.inventoryLedger.create({
        data: {
          productId: it.productId,
          storeCode,
          refNo: fetchedPO.poNo,
          type: 'PO GRN In',
          qtyChange: it.qtyOrdered,
          costPerUnit: it.unitCost,
          balanceAfter: newQty,
          notes: `GRN Received from ${vendor.name} (${fetchedPO.poNo})`,
          createdBy: 'E2E Test Runner',
        },
      });

      await (tx as any).purchaseOrderItem.update({
        where: { id: it.id },
        data: { qtyReceived: it.qtyOrdered },
      });
    }

    const grnNo = `GRN-${Date.now().toString().slice(-6)}`;
    await (tx as any).goodsReceivedNote.create({
      data: {
        grnNo,
        purchaseId: fetchedPO.id,
        storeCode,
        receivedBy: 'E2E Test Runner',
        notes: `GRN test receiving for PO ${fetchedPO.poNo}`,
      },
    });

    await (tx as any).purchaseOrder.update({
      where: { id: fetchedPO.id },
      data: {
        status: 'Received',
        receivedDate: new Date(),
      },
    });
  });

  // Verify updated inventory
  const finalInv1 = await prisma.inventory.findUnique({
    where: { productId_storeCode: { productId: prod1.id, storeCode } },
  });
  const finalInv2 = await prisma.inventory.findUnique({
    where: { productId_storeCode: { productId: prod2.id, storeCode } },
  });

  console.log(`Updated stock in ${storeCode} -> Prod1: ${finalInv1?.qtyOnHand} (expected: ${startQty1 + item1Qty})`);
  console.log(`Updated stock in ${storeCode} -> Prod2: ${finalInv2?.qtyOnHand} (expected: ${startQty2 + item2Qty})`);

  if (finalInv1?.qtyOnHand !== startQty1 + item1Qty || finalInv2?.qtyOnHand !== startQty2 + item2Qty) {
    throw new Error('Stock receiving mismatch!');
  }
  console.log('✔ Inventory stock credited accurately for all line items!');

  // Verify inventory ledger entries
  const ledgers = await prisma.inventoryLedger.findMany({
    where: { refNo: fetchedPO.poNo },
  });
  console.log(`Ledger entries generated: ${ledgers.length} (expected 2)`);
  for (const l of ledgers) {
    console.log(`  -> Ledger: ${l.refNo} | ProdID: ${l.productId} | Qty: +${l.qtyChange} | BalAfter: ${l.balanceAfter}`);
  }
  if (ledgers.length !== 2) {
    throw new Error(`Expected 2 ledger entries, found ${ledgers.length}`);
  }
  console.log('✔ Inventory ledger entries verified.');

  // Clean up test PO to leave DB clean
  console.log('\nCleaning up test PO...');
  await prisma.inventoryLedger.deleteMany({ where: { refNo: fetchedPO.poNo } });
  await (prisma as any).goodsReceivedNote.deleteMany({ where: { purchaseId: fetchedPO.id } });
  await (prisma as any).purchaseOrderItem.deleteMany({ where: { poId: fetchedPO.id } });
  await (prisma as any).purchaseOrder.delete({ where: { id: fetchedPO.id } });

  // Revert test stock back to original
  await prisma.inventory.update({
    where: { productId_storeCode: { productId: prod1.id, storeCode } },
    data: { qtyOnHand: startQty1 },
  });
  await prisma.inventory.update({
    where: { productId_storeCode: { productId: prod2.id, storeCode } },
    data: { qtyOnHand: startQty2 },
  });
  console.log('Reverted test inventory balances.');

  console.log('\n=== ALL MULTI-PRODUCT PURCHASE ORDER TESTS PASSED! ===');
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
