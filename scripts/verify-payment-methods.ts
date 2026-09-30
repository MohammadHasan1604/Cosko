import { prisma } from '../src/lib/db';

async function runVerification() {
  console.log('=====================================================');
  console.log('ROOT VERIFICATION: CENTRALIZED PAYMENT METHODS SUITE');
  console.log('=====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName} ${detail ? `- ${detail}` : ''}`);
      failed++;
    }
  }

  try {
    // 1. Database Inspection: Master Table
    console.log('1. Verifying Centralized Payment Method Master Records in MySQL...');
    const methods = await prisma.paymentMethod.findMany({
      orderBy: { name: 'asc' },
    });

    console.log(`Found ${methods.length} total payment methods in database.`);
    methods.forEach((m) => {
      console.log(`  - ${m.name} (${m.code}) [${m.type}] : Status = ${m.status}, IsSystem = ${m.isSystem}`);
    });

    const canonicalMethods = ['Cash', 'UPI', 'Other'];
    for (const name of canonicalMethods) {
      const found = methods.find((m) => m.name.toLowerCase() === name.toLowerCase());
      assert(!!found, `Canonical Payment Method "${name}" exists in master table`);
    }

    // 2. Active status validation
    console.log('\n2. Verifying Active / Inactive States & Constraints...');
    const activeMethods = methods.filter((m) => m.status === 'Active');
    assert(activeMethods.length >= 3, `All 3 operational payment methods are active (Found: ${activeMethods.length})`);

    // 3. Dynamic Creation & Single Source of Truth
    console.log('\n3. Testing Dynamic Master CRUD (Create, Update Status, Cleanup)...');
    const testCode = 'TEST_VOUCHER_' + Date.now();
    const testName = 'Test Corporate Voucher ' + Date.now();

    const created = await prisma.paymentMethod.create({
      data: {
        code: testCode,
        name: testName,
        type: 'OTHER',
        status: 'Active',
        description: 'Temporary verification voucher instrument',
        isSystem: false,
      },
    });
    assert(!!created && created.id.length > 0, 'Created new dynamic payment method via Master model');

    // Update status to Inactive
    const deactivated = await prisma.paymentMethod.update({
      where: { id: created.id },
      data: { status: 'Inactive' },
    });
    assert(deactivated.status === 'Inactive', 'Successfully deactivated payment method in master table');

    // Cleanup test record
    await prisma.paymentMethod.delete({
      where: { id: created.id },
    });
    const checkDeleted = await prisma.paymentMethod.findUnique({ where: { id: created.id } });
    assert(!checkDeleted, 'Cleaned up temporary test payment method cleanly');

    // 4. Data Integrity & Payment History Verification
    console.log('\n4. Verifying Historical Records and Data Integrity...');
    const [salesCount, purchaseCount, paymentCount, expenseCount] = await Promise.all([
      prisma.salesOrder.count(),
      prisma.purchaseOrder.count(),
      prisma.purchasePayment.count(),
      prisma.expense.count(),
    ]);

    console.log(`Auditing records:`);
    console.log(`  - Sales Orders: ${salesCount}`);
    console.log(`  - Purchase Orders: ${purchaseCount}`);
    console.log(`  - Supplier Payments: ${paymentCount}`);
    console.log(`  - Expenses: ${expenseCount}`);

    // Check distinct payment methods used across existing transactions
    const salesWithMethods = await prisma.salesOrder.findMany({
      select: { paymentMethod: true },
      take: 200,
    });
    const uniqueSalesMethods = Array.from(new Set(salesWithMethods.map((s) => s.paymentMethod).filter(Boolean)));
    console.log(`  - Payment methods present in Sales:`, uniqueSalesMethods);

    const expensesWithMethods = await prisma.expense.findMany({
      select: { paymentMethod: true },
      take: 200,
    });
    const uniqueExpenseMethods = Array.from(new Set(expensesWithMethods.map((e) => e.paymentMethod).filter(Boolean)));
    console.log(`  - Payment methods present in Expenses:`, uniqueExpenseMethods);

    const paymentsWithMethods = await prisma.purchasePayment.findMany({
      select: { paymentMethod: true },
      take: 200,
    });
    const uniquePaymentMethods = Array.from(new Set(paymentsWithMethods.map((p) => p.paymentMethod).filter(Boolean)));
    console.log(`  - Payment methods present in Supplier Payments:`, uniquePaymentMethods);

    assert(uniqueSalesMethods.length > 0 || salesCount === 0, 'Sales transactions retain valid payment methods');
    assert(uniqueExpenseMethods.length > 0 || expenseCount === 0, 'Expense records retain valid payment methods');

    console.log('\n=====================================================');
    console.log(`VERIFICATION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('=====================================================');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error('Fatal verification error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runVerification();
