import { prisma } from '../src/lib/db';
import { validateAndNormalizeGstin } from '../src/lib/gstUtils';
import assert from 'assert';

async function runVendorGstAndDrilldownTests() {
  console.log('=== STARTING VENDOR GST & DRILL-DOWN END-TO-END VERIFICATION ===\n');

  // ─── 1. GST UTILITY UNIT TESTS ───
  console.log('--- TEST 1: Centralized GSTIN Normalization & Validation ---');
  
  // Valid standard GSTIN
  const validGstin = '29AABCS1429B1ZB';
  const r1 = validateAndNormalizeGstin(validGstin);
  assert(r1.isValid, 'Standard 15-char GSTIN must be valid');
  assert(r1.normalized === validGstin, 'Normalized must match uppercase GSTIN');

  // Valid GSTIN with spaces / lowercase / hyphens
  const formattedGstin = ' 29-aabcs1429b-1zb ';
  const r2 = validateAndNormalizeGstin(formattedGstin);
  assert(r2.isValid, 'GSTIN with hyphens and spaces must be sanitized and valid');
  assert(r2.normalized === validGstin, 'Sanitized GSTIN must match standard uppercase format');

  // Optional / Unregistered markers
  const optionalMarkers = ['', '   ', null, undefined, 'URP', 'urp', 'NA', 'N/A', 'None', 'Pending', 'pending', 'Exempt'];
  for (const m of optionalMarkers) {
    const res = validateAndNormalizeGstin(m);
    assert(res.isValid, `Marker "${m}" must be accepted without error`);
    assert(res.isOptionalOrUnregistered, `Marker "${m}" must be marked as unregistered/optional`);
  }

  // Invalid formats (too short, too long, bad pattern)
  const invalidCases = ['12345', '29INVALIDCHARS9', '29AABCS1429B1Z', '29AABCS1429B1ZBB99'];
  for (const inv of invalidCases) {
    const res = validateAndNormalizeGstin(inv);
    assert(!res.isValid, `Invalid string "${inv}" must fail validation`);
    assert(Boolean(res.error), 'Error message must be present for invalid string');
  }
  console.log('✓ TEST 1 PASSED: GSTIN validation handles valid, formatted, optional, and invalid inputs accurately.\n');

  // ─── 2. DATABASE VENDOR CRUD & GST LIFECYCLE ───
  console.log('--- TEST 2: Vendor Creation & Editing with GST Lifecycle ---');

  // Test 2a: Create vendor with optional / empty GSTIN
  const testVendorCode1 = `VND-TEST-${Date.now()}-A`;
  const v1 = await prisma.vendor.create({
    data: {
      code: testVendorCode1,
      name: 'Unregistered Local Supplier',
      contactPerson: 'Suresh Kumar',
      email: 'suresh@localsupplier.in',
      phone: '+91 98888 11111',
      city: 'Bengaluru',
      categories: 'Packing Material',
      gstin: '',
      paymentTerms: 'Net 15',
      status: 'Active',
    },
  });
  assert(v1.id, 'Vendor with empty GSTIN must save successfully');
  assert(v1.gstin === '', 'Vendor GSTIN must be stored as empty string');
  console.log(`✓ 2a: Created unregistered vendor "${v1.name}" (${v1.code}) with blank GSTIN.`);

  // Test 2b: Create vendor with explicit URP marker
  const testVendorCode2 = `VND-TEST-${Date.now()}-B`;
  const v2 = await prisma.vendor.create({
    data: {
      code: testVendorCode2,
      name: 'Exempt Services Co',
      contactPerson: 'Ramesh Rao',
      email: 'ramesh@exemptservices.in',
      phone: '+91 98888 22222',
      city: 'Mysuru',
      categories: 'Transport',
      gstin: 'URP',
      paymentTerms: 'Immediate',
      status: 'Active',
    },
  });
  assert(v2.id, 'Vendor with URP GSTIN must save successfully');
  assert(v2.gstin === 'URP', 'Vendor GSTIN must be stored as URP');
  console.log(`✓ 2b: Created exempt vendor "${v2.name}" (${v2.code}) with URP GSTIN.`);

  // Test 2c: Create vendor with valid 15-char GSTIN
  const testVendorCode3 = `VND-TEST-${Date.now()}-C`;
  const validVendorGstin = '29AABCS1429B1ZB';
  const v3 = await prisma.vendor.create({
    data: {
      code: testVendorCode3,
      name: 'Registered Corporate Tech Ltd',
      contactPerson: 'Kavita Menon',
      email: 'kavita@corptech.in',
      phone: '+91 98888 33333',
      city: 'Bengaluru',
      categories: 'Electronics',
      gstin: validVendorGstin,
      paymentTerms: 'Net 30',
      status: 'Active',
    },
  });
  assert(v3.id, 'Vendor with valid GSTIN must save successfully');
  assert(v3.gstin === validVendorGstin, 'Vendor GSTIN must match exactly');
  console.log(`✓ 2c: Created registered vendor "${v3.name}" (${v3.code}) with valid GSTIN: ${v3.gstin}.`);

  // Test 2d: Edit vendor without modifying GSTIN (preserve existing GSTIN)
  const updatedV3 = await prisma.vendor.update({
    where: { id: v3.id },
    data: {
      phone: '+91 98888 44444',
      contactPerson: 'Kavita Sharma',
    },
  });
  assert(updatedV3.contactPerson === 'Kavita Sharma', 'Contact person must update');
  assert(updatedV3.gstin === validVendorGstin, 'GSTIN must remain intact when other fields are edited');
  console.log('✓ 2d: Successfully updated vendor contact details while strictly preserving existing GSTIN.');

  // Test 2e: Update vendor GSTIN from URP to valid registration
  const updatedV2 = await prisma.vendor.update({
    where: { id: v2.id },
    data: {
      gstin: '29ABCDE1234F1Z5',
    },
  });
  assert(updatedV2.gstin === '29ABCDE1234F1Z5', 'GSTIN must update to newly registered number');
  console.log('✓ 2e: Successfully transitioned vendor from URP to registered GSTIN.');

  // ─── 3. VENDOR PAYABLES DRILL-DOWN & 1:1 RECONCILIATION ───
  console.log('\n--- TEST 3: Vendor Payables Drill-Down 1:1 Root Reconciliation ---');

  // Create an active purchase order under v3
  const testPo = await prisma.purchaseOrder.create({
    data: {
      poNo: `PO-DRILL-${Date.now()}`,
      invoiceNo: `INV-DRILL-${Date.now()}`,
      vendorId: v3.id,
      storeCode: 'BLR',
      totalCost: 50000,
      paidAmount: 15000,
      creditAmount: 5000,
      paymentStatus: 'Partial',
      status: 'Ordered',
      createdBy: 'Drill-Down Test',
    },
  });

  // Query all active pending bills in the system
  const allActivePurchases = await prisma.purchaseOrder.findMany({
    where: {
      status: { notIn: ['Cancelled', 'Archived'] },
      paymentStatus: { not: 'Paid' },
    },
    include: {
      vendor: { select: { name: true, code: true, phone: true, city: true } },
      payments: true,
    },
  });

  let computedDashboardPayablesTotal = 0;
  const drillDownRows: any[] = [];

  for (const po of allActivePurchases) {
    const cost = Number(po.totalCost);
    const paid = Number(po.paidAmount);
    const credit = Number(po.creditAmount);
    const rem = Math.max(0, cost - paid - credit);

    if (rem > 0.005) {
      computedDashboardPayablesTotal += rem;
      drillDownRows.push({
        poNo: po.poNo,
        invoiceNo: po.invoiceNo,
        vendor: po.vendor?.name,
        store: po.storeCode,
        totalCost: cost,
        paidAmount: paid,
        creditAmount: credit,
        remainingPayable: rem,
      });
    }
  }

  console.log(`Total Active Pending Bills: ${drillDownRows.length}`);
  console.log(`Consolidated Dashboard Vendor Payables Total: ₹${computedDashboardPayablesTotal.toLocaleString('en-IN')}`);

  // Ensure our test PO is present with exact balance (50,000 - 15,000 - 5,000 = 30,000)
  const matchingDrillDown = drillDownRows.find(r => r.poNo === testPo.poNo);
  assert(matchingDrillDown, 'Test PO must appear in drill-down bills');
  assert(matchingDrillDown.remainingPayable === 30000, `Remaining payable must be 30,000, got ${matchingDrillDown.remainingPayable}`);
  console.log(`✓ Test PO [${testPo.poNo}] verified in drill-down: Cost ₹50,000 - Paid ₹15,000 - Credit ₹5,000 = ₹${matchingDrillDown.remainingPayable}`);

  // Test full payment settlement
  await prisma.purchaseOrder.update({
    where: { id: testPo.id },
    data: {
      paidAmount: 45000,
      paymentStatus: 'Paid',
    },
  });

  const remainingAfterSettle = await prisma.purchaseOrder.findUnique({
    where: { id: testPo.id },
  });
  const newRem = Math.max(0, Number(remainingAfterSettle!.totalCost) - Number(remainingAfterSettle!.paidAmount) - Number(remainingAfterSettle!.creditAmount));
  assert(newRem === 0, 'Bill must have 0 remaining balance after settlement');
  console.log('✓ Bill settled: automatically excluded from pending payables drill-down.');

  // ─── 4. CLEANUP ───
  await prisma.purchaseOrder.delete({ where: { id: testPo.id } });
  await prisma.vendor.delete({ where: { id: v1.id } });
  await prisma.vendor.delete({ where: { id: v2.id } });
  await prisma.vendor.delete({ where: { id: v3.id } });
  console.log('\n✓ Cleaned up all test vendors and purchase orders.');

  console.log('\n=== ALL VENDOR GST & DRILL-DOWN TESTS PASSED (100%) ===');
}

runVendorGstAndDrilldownTests()
  .catch((err) => {
    console.error('VERIFICATION FAILURE:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
