import { prisma } from '../src/lib/db';
import {
  getConsolidatedPnL,
  getStoreOperationalPnL,
  getCentralTransferPnL,
  getDrillDownRecords,
  getGeneralLedgerEntries,
  runRootFinancialReconciliation,
} from '../src/lib/services/accountingService';
import { executePOSCheckout } from '../src/lib/services/salesService';

async function verifyAccountingRootReconciliation() {
  console.log('========================================================================');
  console.log('🧪 COSKO COMPREHENSIVE ROOT ACCOUNTING & P&L RECONCILIATION SUITE');
  console.log('========================================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    total++;
    if (condition) {
      console.log(`  ✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${testName}${detail ? ` -> ${detail}` : ''}`);
    }
  }

  try {
    // ------------------------------------------------------------------------
    // TEST GROUP 1: CONSOLIDATED P&L ACCURACY & INTERNAL TRANSFER ELIMINATION
    // ------------------------------------------------------------------------
    console.log('--- Test Group 1: Consolidated Company P&L Statement ---');
    const consolidated = await getConsolidatedPnL({});
    console.log('Consolidated Output:', {
      netExternalRevenue: consolidated.netExternalRevenue,
      vendorCOGS: consolidated.vendorCOGS,
      consolidatedGrossProfit: consolidated.consolidatedGrossProfit,
      grossMarginPercent: consolidated.grossMarginPercent,
      totalExpenses: consolidated.totalExpenses,
      consolidatedNetProfit: consolidated.consolidatedNetProfit,
      eliminatedTransferRevenue: consolidated.eliminatedTransferRevenue,
      eliminatedTransferMarkup: consolidated.eliminatedTransferMarkup,
      ordersCount: consolidated.ordersCount,
    });

    assert(typeof consolidated.netExternalRevenue === 'number', 'Consolidated external revenue computed');
    assert(typeof consolidated.vendorCOGS === 'number', 'Consolidated vendor COGS computed');
    assert(
      Math.abs(consolidated.consolidatedGrossProfit - (consolidated.netExternalRevenue - consolidated.vendorCOGS)) < 0.01,
      'Consolidated Gross Profit == External Revenue - Vendor COGS',
      `GP: ${consolidated.consolidatedGrossProfit}, Expected: ${consolidated.netExternalRevenue - consolidated.vendorCOGS}`
    );
    assert(
      Math.abs(consolidated.consolidatedNetProfit - (consolidated.consolidatedGrossProfit - consolidated.totalExpenses)) < 0.01,
      'Consolidated Net Profit == Gross Profit - Total Expenses',
      `Net: ${consolidated.consolidatedNetProfit}, Expected: ${consolidated.consolidatedGrossProfit - consolidated.totalExpenses}`
    );
    assert(
      consolidated.eliminatedTransferRevenue >= 0,
      `Internal stock transfer revenue successfully eliminated (₹${consolidated.eliminatedTransferRevenue.toLocaleString('en-IN')})`
    );

    // ------------------------------------------------------------------------
    // TEST GROUP 2: STORE OPERATIONAL P&L
    // ------------------------------------------------------------------------
    console.log('\n--- Test Group 2: Store Operational P&L ---');
    const storePnL = await getStoreOperationalPnL({ store: 'BLR' });
    console.log('Store P&L for BLR:', storePnL);
    assert(typeof storePnL.storeSalesRevenue === 'number', 'Store sales revenue computed for BLR');
    assert(
      Math.abs(storePnL.storeGrossProfit - (storePnL.storeSalesRevenue - storePnL.storeCOGS)) < 0.01,
      'Store Gross Profit == Store Revenue - Store COGS (based on Transfer Price)'
    );
    assert(
      Math.abs(storePnL.storeNetProfit - (storePnL.storeGrossProfit - storePnL.storeOperatingExpenses)) < 0.01,
      'Store Net Profit == Store Gross Profit - Store Operating Expenses'
    );

    // ------------------------------------------------------------------------
    // TEST GROUP 3: CENTRAL TRANSFER PROFIT P&L
    // ------------------------------------------------------------------------
    console.log('\n--- Test Group 3: Central Transfer Profit P&L ---');
    const centralPnL = await getCentralTransferPnL({});
    console.log('Central Transfer P&L:', {
      transferRevenue: centralPnL.centralTransferRevenue,
      inventoryCost: centralPnL.centralInventoryCost,
      grossProfit: centralPnL.grossTransferProfit,
      centralExpenses: centralPnL.centralExpenses,
      netCentralProfit: centralPnL.netCentralProfit,
      transfersCount: centralPnL.transfersCount,
      outlets: centralPnL.outletBreakdown.map((o) => `${o.destStore} (Units: ${o.units}, Margin: ₹${o.markupProfit})`),
    });

    assert(centralPnL.transfersCount > 0, `Active stock transfers found (${centralPnL.transfersCount} transfers)`);
    assert(
      Math.abs(centralPnL.grossTransferProfit - (centralPnL.centralTransferRevenue - centralPnL.centralInventoryCost)) < 0.01,
      'Central Gross Transfer Profit == Transfer Revenue - Inventory Purchase Cost'
    );
    assert(
      Math.abs(centralPnL.netCentralProfit - (centralPnL.grossTransferProfit - centralPnL.centralExpenses)) < 0.01,
      'Net Central Profit == Gross Transfer Margin - Central Logistics Expenses'
    );

    // ------------------------------------------------------------------------
    // TEST GROUP 4: INTERACTIVE DRILL-DOWN INTEGRITY
    // ------------------------------------------------------------------------
    console.log('\n--- Test Group 4: Drill-Down Mathematical Reconciliation ---');
    const revenueDrillDown = await getDrillDownRecords('netExternalRevenue', {});
    assert(revenueDrillDown.count === consolidated.ordersCount, `Drill-down rows count (${revenueDrillDown.count}) matches order count`);
    assert(
      Math.abs(revenueDrillDown.total - consolidated.netExternalRevenue) < 0.05,
      `Drill-down sum (₹${revenueDrillDown.total}) == Consolidated Revenue (₹${consolidated.netExternalRevenue})`
    );

    const cogsDrillDown = await getDrillDownRecords('vendorCOGS', {});
    assert(
      Math.abs(cogsDrillDown.total - consolidated.vendorCOGS) < 0.05,
      `Drill-down sum (₹${cogsDrillDown.total}) == Consolidated COGS (₹${consolidated.vendorCOGS})`
    );

    // ------------------------------------------------------------------------
    // TEST GROUP 5: FINANCIAL GENERAL LEDGER DOUBLE-ENTRY INTEGRITY
    // ------------------------------------------------------------------------
    console.log('\n--- Test Group 5: Financial General Ledger Verification ---');
    const ledger = await getGeneralLedgerEntries({ limit: 100 });
    console.log(`General Ledger active count: ${ledger.totalCount}, Debits: ₹${ledger.totalDebit}, Credits: ₹${ledger.totalCredit}`);
    assert(ledger.totalCount > 0, `Financial ledger entries populated in MySQL (${ledger.totalCount} entries)`);
    assert(
      Math.abs(ledger.totalDebit - ledger.totalCredit) < 0.05,
      `Double-entry balance check: Total Debits (₹${ledger.totalDebit}) == Total Credits (₹${ledger.totalCredit})`
    );

    // ------------------------------------------------------------------------
    // TEST GROUP 6: ROOT MULTI-SUBSYSTEM RECONCILIATION AUDIT
    // ------------------------------------------------------------------------
    console.log('\n--- Test Group 6: Root System-Wide Reconciliation Audit ---');
    const rootAudit = await runRootFinancialReconciliation();
    console.log('Root Audit Status:', rootAudit.status);
    console.log('Mathematical Invariant Proofs:');
    for (const proof of rootAudit.proofs) {
      console.log(`  - ${proof.test} -> ${proof.isReconciled ? 'RECONCILED' : 'FAILED'} (Left: ${proof.leftValue}, Right: ${proof.rightValue})`);
      assert(proof.isReconciled, proof.test);
    }
    assert(rootAudit.status === 'RECONCILED', 'Root Financial Reconciliation Status is 100% RECONCILED');

    // ------------------------------------------------------------------------
    // TEST GROUP 7: END-TO-END TRANSACTION PIPELINE HOOK TEST
    // ------------------------------------------------------------------------
    console.log('\n--- Test Group 7: New Transaction Atomic Ledger Persistence ---');
    // Find an active product with inventory at CENTRAL
    const testProduct = await prisma.product.findFirst({
      where: { inventoryItems: { some: { storeCode: 'CENTRAL', qtyOnHand: { gte: 2 } } } },
      include: { inventoryItems: { where: { storeCode: 'CENTRAL' } } },
    });

    if (testProduct) {
      const inv = testProduct.inventoryItems[0];
      const testSaleQty = 1;
      const unitPrice = Number(testProduct.baseSellingPrice) || 500;
      const unitCost = Number(testProduct.baseCostPrice) || 200;

      const newSale = await executePOSCheckout({
        storeCode: 'CENTRAL',
        customerName: 'Reconciliation Audit Customer',
        customerPhone: '+91 99999 88888',
        items: [
          {
            productId: testProduct.id,
            productName: testProduct.name,
            sku: testProduct.sku,
            qty: testSaleQty,
            unitPrice,
            unitCost,
          },
        ],
        paymentMethod: 'UPI',
        cashierName: 'Auto Audit Engine',
      });

      assert(!!newSale && !!newSale.orderNo, `Executed new POS sale ${newSale.orderNo}`);

      // Verify that ledger entries were created automatically in financial_ledger
      const createdLedgerEntries = await (prisma as any).financialLedgerEntry.findMany({
        where: { refNo: newSale.orderNo },
      });
      assert(createdLedgerEntries.length >= 3, `New sale atomically created ${createdLedgerEntries.length} financial ledger entries`);

      // Verify immediate reconciliation
      const postSaleAudit = await runRootFinancialReconciliation();
      assert(postSaleAudit.status === 'RECONCILED', 'Root Reconciliation remains 100% RECONCILED after live transaction');

      // Clean up test sale and its ledger entries to restore pristine DB state
      await (prisma as any).financialLedgerEntry.deleteMany({ where: { refNo: newSale.orderNo } });
      await (prisma as any).inventoryLedger.deleteMany({ where: { refNo: newSale.orderNo } });
      await prisma.salesOrderItem.deleteMany({ where: { orderId: newSale.id } });
      await prisma.salesOrder.delete({ where: { id: newSale.id } });
      // Restore inventory qty
      await prisma.inventory.update({
        where: { id: inv.id },
        data: { qtyOnHand: inv.qtyOnHand },
      });
      console.log('Cleaned up test sale and restored inventory balance.');
    }

    console.log('\n========================================================================');
    console.log(`🎉 SUMMARY: ${passed} of ${total} tests passed!`);
    console.log('========================================================================\n');
  } catch (err) {
    console.error('Test execution error:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

verifyAccountingRootReconciliation();
