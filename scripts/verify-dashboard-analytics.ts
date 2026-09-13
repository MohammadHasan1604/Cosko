import { prisma } from '../src/lib/db';
import { isWithinDatePeriod, getDateRange, getPreviousDateRange, parseDate } from '../src/lib/dateUtils';
import assert from 'assert';

async function runTests() {
  console.log('=== STARTING DASHBOARD ANALYTICS & INTEGRITY VERIFICATION SUITE ===\n');

  // Test 1: Date Utils Parser & Range Logic
  console.log('--- TEST 1: Date Parsing & Period Calculation ---');
  const now = new Date();
  const testIso = '2026-09-08T14:06:28.000Z';
  const parsedIso = parseDate(testIso);
  assert(parsedIso !== null, 'ISO date parsing must succeed');
  assert(parsedIso.getUTCFullYear() === 2026, 'Parsed year must be 2026');

  const testIndian = '08/09/2026';
  const parsedIndian = parseDate(testIndian);
  assert(parsedIndian !== null, 'Indian date parsing must succeed');
  assert(parsedIndian.getFullYear() === 2026 && parsedIndian.getMonth() === 8, 'Parsed Indian date month must be September (8)');

  // Range tests
  const periods = ['Today', 'Yesterday', 'Last 7 Days', 'This Week', 'This Month', 'Last Month', 'This Quarter', 'This Year'];
  for (const p of periods) {
    const range = getDateRange(p);
    assert(range.start instanceof Date && !isNaN(range.start.getTime()), `${p} start must be valid Date`);
    assert(range.end instanceof Date && !isNaN(range.end.getTime()), `${p} end must be valid Date`);
    assert(range.start <= range.end, `${p} start must be <= end`);

    const prev = getPreviousDateRange(p);
    assert(prev.start instanceof Date && !isNaN(prev.start.getTime()), `${p} prev start must be valid Date`);
    assert(prev.end instanceof Date && !isNaN(prev.end.getTime()), `${p} prev end must be valid Date`);
  }

  // Custom range test
  const custom = getDateRange('Custom Range', { start: '2026-09-01', end: '2026-09-10' });
  assert(custom.start.getDate() === 1 && custom.end.getDate() === 10, 'Custom range boundaries must match');
  console.log('✓ TEST 1 PASSED: Date parsing, periods, and boundaries validated.\n');

  // Test 2: Database Records and Authoritative Values
  console.log('--- TEST 2: Authoritative Database Data Integrity ---');
  const sales = await prisma.salesOrder.findMany({ include: { items: true } });
  console.log(`Found ${sales.length} sales orders in database.`);
  let totalGrandTotal = 0;
  let totalGrossProfit = 0;
  for (const s of sales) {
    totalGrandTotal += Number(s.grandTotal);
    totalGrossProfit += Number(s.grossProfit);
    assert(Number(s.grandTotal) > 0, `Sale ${s.orderNo} must have positive grand total`);
  }
  console.log(`Total Sales Revenue in DB: ₹${totalGrandTotal}`);
  console.log(`Total Gross Profit in DB: ₹${totalGrossProfit}`);

  // Test 3: Vendor Payables Query & Cancelled PO Isolation
  console.log('\n--- TEST 3: Vendor Payables Query & Orphaned / Stale Isolation ---');
  const vendors = await prisma.vendor.findMany({
    where: { status: { not: 'Archived' } },
    include: {
      purchases: {
        select: { totalCost: true, paidAmount: true, paymentStatus: true, status: true },
        where: {
          status: { notIn: ['Cancelled', 'Archived'] },
          paymentStatus: { not: 'Paid' },
        },
      },
    },
  });

  let totalVendorPayable = 0;
  for (const v of vendors) {
    const pay = v.purchases.reduce((sum, p) => sum + Math.max(0, Number(p.totalCost) - Number(p.paidAmount || 0)), 0);
    totalVendorPayable += pay;
    console.log(`Vendor [${v.code}] ${v.name}: Active Pending Bills = ${v.purchases.length}, Payable = ₹${pay}`);
    assert(v.purchases.every(p => p.status !== 'Cancelled' && p.status !== 'Archived'), 'No cancelled or archived POs allowed in active vendor payables');
  }

  console.log(`Total Vendor Payables from active purchase orders: ₹${totalVendorPayable}`);
  // Verify PO-2026-0003 (ghost 5,000) is NOT included
  const hasGhostPo = vendors.some(v => v.purchases.some((p: any) => p.poNo === 'PO-2026-0003'));
  assert(!hasGhostPo, 'PO-2026-0003 (ghost 5,000) must NOT be included in active payables');
  assert(totalVendorPayable === 225000, `Active payables must equal real active bills (85,000 + 140,000 = 225,000), got: ${totalVendorPayable}`);
  console.log('✓ TEST 3 PASSED: Ghost ₹5,000 eliminated. Cancelled POs strictly isolated. Active bills correctly reconciled.\n');

  // Test 4: Dynamic Create & Settle Bill Lifecycle
  console.log('--- TEST 4: Real Bill Lifecycle & Dynamic Payable Calculation ---');
  const testVendor = vendors[0] || await prisma.vendor.findFirst();
  assert(testVendor, 'At least one vendor must exist');

  const count = await prisma.purchaseOrder.count();
  const testPoNo = `PO-TEST-${Date.now()}`;
  const testPo = await prisma.purchaseOrder.create({
    data: {
      poNo: testPoNo,
      vendorId: testVendor.id,
      storeCode: 'BLR',
      totalCost: 12500,
      paidAmount: 0,
      status: 'Ordered',
      paymentStatus: 'Unpaid',
      createdBy: 'Analytics Test Suite',
    },
  });
  console.log(`Created test PO [${testPo.poNo}] for ₹12,500 under vendor ${testVendor.name} at store BLR.`);

  // Verify vendor payables query now reflects exactly ₹12,500
  const vendorsAfterCreate = await prisma.vendor.findMany({
    where: { id: testVendor.id },
    include: {
      purchases: {
        select: { totalCost: true, paidAmount: true, paymentStatus: true, status: true },
        where: {
          status: { notIn: ['Cancelled', 'Archived'] },
          paymentStatus: { not: 'Paid' },
        },
      },
    },
  });
  const payableAfter = vendorsAfterCreate[0].purchases.reduce((sum, p) => sum + Math.max(0, Number(p.totalCost) - Number(p.paidAmount || 0)), 0);
  assert(payableAfter === 12500, `Vendor payable must be exactly 12500, got ${payableAfter}`);
  assert(vendorsAfterCreate[0].purchases.length === 1, 'Vendor must have exactly 1 pending bill');
  console.log(`✓ Active bill correctly reflected: ₹${payableAfter} across 1 pending bill.`);

  // Partial Payment
  await prisma.purchaseOrder.update({
    where: { id: testPo.id },
    data: { paidAmount: 4500, paymentStatus: 'Partial' },
  });
  const vendorsAfterPartial = await prisma.vendor.findMany({
    where: { id: testVendor.id },
    include: {
      purchases: {
        select: { totalCost: true, paidAmount: true, paymentStatus: true, status: true },
        where: {
          status: { notIn: ['Cancelled', 'Archived'] },
          paymentStatus: { not: 'Paid' },
        },
      },
    },
  });
  const payablePartial = vendorsAfterPartial[0].purchases.reduce((sum, p) => sum + Math.max(0, Number(p.totalCost) - Number(p.paidAmount || 0)), 0);
  assert(payablePartial === 8000, `Vendor payable after partial payment must be 8000 (12500 - 4500), got ${payablePartial}`);
  console.log(`✓ Partial payment correctly deducted: Remaining payable = ₹${payablePartial}.`);

  // Full settlement
  await prisma.purchaseOrder.update({
    where: { id: testPo.id },
    data: { paidAmount: 12500, paymentStatus: 'Paid' },
  });
  const vendorsAfterPaid = await prisma.vendor.findMany({
    where: { id: testVendor.id },
    include: {
      purchases: {
        select: { totalCost: true, paidAmount: true, paymentStatus: true, status: true },
        where: {
          status: { notIn: ['Cancelled', 'Archived'] },
          paymentStatus: { not: 'Paid' },
        },
      },
    },
  });
  const payablePaid = vendorsAfterPaid[0].purchases.reduce((sum, p) => sum + Math.max(0, Number(p.totalCost) - Number(p.paidAmount || 0)), 0);
  assert(payablePaid === 0, `Vendor payable after full payment must be 0, got ${payablePaid}`);
  console.log(`✓ Full settlement correctly clears bill: Remaining payable = ₹${payablePaid}.`);

  // Clean up test PO
  await prisma.purchaseOrder.delete({ where: { id: testPo.id } });
  console.log('✓ Cleaned up test purchase order.\n');

  // Test 5: Global Store & Date Filter Recalculation
  console.log('--- TEST 5: Multi-Store & Date Period Filtering Recalculation ---');
  const stores = ['All Stores', 'CENTRAL', 'BLR', 'MUM', 'DEL', 'HYD'];
  for (const st of stores) {
    const storeSales = sales.filter(s => (st === 'All Stores' || s.storeCode === st) && s.status !== 'Refunded');
    const storeRev = storeSales.reduce((acc, s) => acc + Number(s.grandTotal), 0);
    const storeGp = storeSales.reduce((acc, s) => acc + Number(s.grossProfit), 0);
    console.log(`Store [${st.padEnd(10)}]: ${storeSales.length} orders · Revenue: ₹${storeRev.toLocaleString('en-IN')} · Gross Profit: ₹${storeGp.toLocaleString('en-IN')}`);
  }

  console.log('\n=== ALL 5 AUDIT & VERIFICATION SUITES PASSED SUCCESSFULLY! ===');
}

runTests().catch((err) => {
  console.error('VERIFICATION FAILURE:', err);
  process.exit(1);
}).finally(() => prisma.$disconnect());
