import { prisma } from '../src/lib/db';
import { executePOSCheckout } from '../src/lib/services/salesService';

async function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    throw new Error(message);
  }
  console.log(`  ✅ [PASS] ${message}`);
}

async function main() {
  console.log('========================================================================');
  console.log('🧪 VERIFY POS BILLING TRANSACTION TIMEOUT ROOT FIX');
  console.log('========================================================================');

  // Find 2 real products from inventory to test with
  const invItems = await prisma.inventory.findMany({
    take: 2,
    where: { storeCode: 'CENTRAL', qtyOnHand: { gte: 5 } },
    include: { product: true },
  });

  if (invItems.length < 2) {
    throw new Error('Need at least 2 inventory items in CENTRAL store for testing');
  }

  const [itemA, itemB] = invItems;
  console.log(`Test Item A: ${itemA.product.name} (Qty on hand: ${itemA.qtyOnHand})`);
  console.log(`Test Item B: ${itemB.product.name} (Qty on hand: ${itemB.qtyOnHand})`);

  // -------------------------------------------------------------------------
  // TEST 1: Multi-Item Fast Atomic Checkout Performance Benchmark
  // -------------------------------------------------------------------------
  console.log('\n--- Test 1: Multi-Item Atomic Checkout Timing & Ledger Verification ---');
  const t0 = Date.now();
  const sale1 = await executePOSCheckout({
    storeCode: 'CENTRAL',
    customerName: 'Multi-Item Test Customer',
    customerPhone: '+91 98888 11111',
    items: [
      {
        productId: itemA.productId,
        productName: itemA.product.name,
        sku: itemA.product.sku,
        qty: 1,
        unitPrice: 1000,
        unitCost: 600,
      },
      {
        productId: itemB.productId,
        productName: itemB.product.name,
        sku: itemB.product.sku,
        qty: 2,
        unitPrice: 1500,
        unitCost: 900,
      },
    ],
    taxAmount: 720,
    discountAmount: 100,
    paymentMethod: 'UPI',
    cashierName: 'Timeout Test Suite',
    paymentProofUrl: '/uploads/payment-proofs/test-proof.png',
    referenceNo: 'POS-TEST-REF-1',
  });
  const duration1 = Date.now() - t0;
  console.log(`Checkout executed in ${duration1}ms (Well below 5000ms threshold)`);
  await assert(duration1 < 4500, `Multi-item checkout completed in ${duration1}ms (< 4500ms)`);
  await assert(!!sale1 && !!sale1.orderNo, `Sales order created with orderNo ${sale1.orderNo}`);
  await assert(sale1.items.length === 2, `Sales order has 2 line items`);

  // Verify inventory deduction
  const updatedInvA = await prisma.inventory.findUnique({
    where: { productId_storeCode: { productId: itemA.productId, storeCode: 'CENTRAL' } },
  });
  await assert(updatedInvA?.qtyOnHand === itemA.qtyOnHand - 1, `Inventory item A deducted by 1 (${updatedInvA?.qtyOnHand})`);

  // Verify financial ledger entries
  const finEntries1 = await prisma.financialLedgerEntry.findMany({
    where: { refNo: sale1.orderNo },
  });
  await assert(finEntries1.length === 5, `Created exactly 5 financial ledger entries (REV, TAX, ASST, COGS, INVD)`);
  const revEntry = finEntries1.find((e) => e.accountCategory === 'REVENUE');
  const taxEntry = finEntries1.find((e) => e.accountCategory === 'LIABILITY');
  const asstEntry = finEntries1.find((e) => e.accountCategory === 'ASSET' && e.accountName.includes('UPI'));
  await assert(!!revEntry && Number(revEntry.credit) === 3900, `Revenue credited for ₹3900 (Subtotal ₹4000 - Discount ₹100)`);
  await assert(!!taxEntry && Number(taxEntry.credit) === 720, `GST Liability credited for ₹720`);
  await assert(!!asstEntry && Number(asstEntry.debit) === 4620, `Asset debited for ₹4620 (Grand Total)`);

  // Clean up sale 1
  await prisma.salesOrderItem.deleteMany({ where: { orderId: sale1.id } });
  await prisma.financialLedgerEntry.deleteMany({ where: { refNo: sale1.orderNo } });
  await prisma.inventoryLedger.deleteMany({ where: { refNo: sale1.orderNo } });
  await prisma.auditLog.deleteMany({ where: { details: { contains: sale1.orderNo } } });
  await prisma.salesOrder.delete({ where: { id: sale1.id } });
  await prisma.inventory.update({
    where: { productId_storeCode: { productId: itemA.productId, storeCode: 'CENTRAL' } },
    data: { qtyOnHand: itemA.qtyOnHand },
  });
  console.log('Cleaned up Test 1 sale.');

  // -------------------------------------------------------------------------
  // TEST 2: All Payment Methods (UPI, Cash, Card, Credit)
  // -------------------------------------------------------------------------
  console.log('\n--- Test 2: Verification of Payment Methods (UPI, Cash, Card, Credit) ---');
  for (const pm of ['Cash', 'Card', 'Credit'] as const) {
    const salePM = await executePOSCheckout({
      storeCode: 'CENTRAL',
      customerName: `PM Test Customer (${pm})`,
      customerPhone: '+91 98888 22222',
      items: [
        {
          productId: itemA.productId,
          productName: itemA.product.name,
          sku: itemA.product.sku,
          qty: 1,
          unitPrice: 500,
          unitCost: 300,
        },
      ],
      paymentMethod: pm,
      cashierName: 'Timeout Test Suite',
      paymentProofUrl: '/uploads/payment-proofs/test-proof.png',
      referenceNo: `POS-TEST-${pm}-REF`,
    });

    const finPM = await prisma.financialLedgerEntry.findMany({
      where: { refNo: salePM.orderNo },
    });

    if (pm === 'Credit') {
      const arEntry = finPM.find((e) => e.accountName === 'Customer Accounts Receivable');
      await assert(!!arEntry, `Credit payment routed to "Customer Accounts Receivable"`);
    } else {
      const bankEntry = finPM.find((e) => e.accountName === `Cash / Bank (${pm})`);
      await assert(!!bankEntry, `${pm} payment routed to "Cash / Bank (${pm})"`);
    }

    // Clean up
    await prisma.salesOrderItem.deleteMany({ where: { orderId: salePM.id } });
    await prisma.financialLedgerEntry.deleteMany({ where: { refNo: salePM.orderNo } });
    await prisma.inventoryLedger.deleteMany({ where: { refNo: salePM.orderNo } });
    await prisma.auditLog.deleteMany({ where: { details: { contains: salePM.orderNo } } });
    await prisma.salesOrder.delete({ where: { id: salePM.id } });
    await prisma.inventory.update({
      where: { productId_storeCode: { productId: itemA.productId, storeCode: 'CENTRAL' } },
      data: { qtyOnHand: itemA.qtyOnHand },
    });
  }
  console.log('Cleaned up Test 2 payment method test sales.');

  // -------------------------------------------------------------------------
  // TEST 3: Atomic Rollback on Failure (Zero Partial State)
  // -------------------------------------------------------------------------
  console.log('\n--- Test 3: Complete Atomic Rollback on Simulated DB Error ---');
  const initialSalesCount = await prisma.salesOrder.count();
  const initialFinCount = await prisma.financialLedgerEntry.count();
  const initialInvQty = (
    await prisma.inventory.findUnique({
      where: { productId_storeCode: { productId: itemA.productId, storeCode: 'CENTRAL' } },
    })
  )?.qtyOnHand;

  let errorCaught = false;
  try {
    // Attempt checkout with a non-existent product ID that fails foreign key constraint on sale_items
    await executePOSCheckout({
      storeCode: 'CENTRAL',
      customerName: 'Rollback Customer',
      customerPhone: '+91 98888 33333',
      items: [
        {
          productId: 'non-existent-product-uuid-for-testing',
          productName: 'Ghost Item',
          sku: 'GHOST-001',
          qty: 1,
          unitPrice: 1000,
          unitCost: 500,
        },
      ],
      paymentMethod: 'Cash',
      cashierName: 'Timeout Test Suite',
    });
  } catch (err: any) {
    errorCaught = true;
    console.log(`  Caught expected transaction failure: ${err.message?.slice(0, 80)}...`);
  }

  await assert(errorCaught, 'Transaction threw error and did not mask failure');
  const postSalesCount = await prisma.salesOrder.count();
  const postFinCount = await prisma.financialLedgerEntry.count();
  const postInvQty = (
    await prisma.inventory.findUnique({
      where: { productId_storeCode: { productId: itemA.productId, storeCode: 'CENTRAL' } },
    })
  )?.qtyOnHand;

  await assert(postSalesCount === initialSalesCount, `Zero sales orders created after rollback (${postSalesCount} == ${initialSalesCount})`);
  await assert(postFinCount === initialFinCount, `Zero financial ledger entries created after rollback (${postFinCount} == ${initialFinCount})`);
  await assert(postInvQty === initialInvQty, `Inventory quantities remained unchanged (${postInvQty} == ${initialInvQty})`);

  console.log('\n========================================================================');
  console.log('🎉 ALL POS BILLING TRANSACTION VERIFICATION TESTS PASSED SUCCESSFULLY!');
  console.log('========================================================================\n');
}

main()
  .catch((e) => {
    console.error('Test Suite Failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
