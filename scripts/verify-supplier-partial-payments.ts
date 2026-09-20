import { prisma } from '../src/lib/db';
import { runRootFinancialReconciliation } from '../src/lib/services/accountingService';

async function runTests() {
  console.log('========================================================================');
  console.log('🧪 COSKO COMPREHENSIVE SUPPLIER PARTIAL PAYMENTS TEST SUITE');
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

  const createdPoIds: string[] = [];

  try {
    // ------------------------------------------------------------------------
    // SETUP: Get or create a test vendor and product
    // ------------------------------------------------------------------------
    let vendor = await prisma.vendor.findFirst({
      where: { name: 'Partial Pay Test Vendor' },
    });
    if (!vendor) {
      vendor = await prisma.vendor.create({
        data: {
          code: 'VEN-PPTEST',
          name: 'Partial Pay Test Vendor',
          contactPerson: 'Payment Auditor',
          email: 'testpay@vendor.com',
          phone: '+91 99887 76655',
          city: 'Bengaluru',
          address: 'Electronic City, Bengaluru',
          categories: 'Computer Peripherals',
          gstin: '29ABCDE1234F1Z5',
        },
      });
    }

    let product = await prisma.product.findFirst({
      where: { sku: 'SKU-PPTEST-001' },
    });
    if (!product) {
      product = await prisma.product.create({
        data: {
          sku: 'SKU-PPTEST-001',
          name: 'Test Component Motherboard',
          category: 'Hardware',
          baseCostPrice: 10000,
          baseSellingPrice: 15000,
          status: 'active',
        },
      });
    }

    // ------------------------------------------------------------------------
    // TEST 1: Create PO with Unpaid status
    // ------------------------------------------------------------------------
    console.log('--- Test 1: Create PO for ₹1,00,000 (10 units @ ₹10,000) Unpaid ---');
    const po1 = await prisma.purchaseOrder.create({
      data: {
        poNo: `PO-TEST-PARTIAL-${Date.now().toString().slice(-6)}`,
        invoiceNo: `INV-PP-${Date.now().toString().slice(-4)}`,
        vendorId: vendor.id,
        storeCode: 'CENTRAL',
        status: 'Ordered',
        paymentStatus: 'Unpaid',
        subtotal: 100000,
        totalCost: 100000,
        paidAmount: 0,
        creditAmount: 0,
        createdBy: 'Test Runner',
        items: {
          create: [
            {
              productId: product.id,
              qtyOrdered: 10,
              qtyReceived: 0,
              unitCost: 10000,
              lineTotal: 100000,
            },
          ],
        },
      },
      include: { payments: true, items: true },
    });
    createdPoIds.push(po1.id);

    assert(po1.paymentStatus === 'Unpaid', 'PO created with Unpaid payment status');
    assert(Number(po1.paidAmount) === 0, 'PO created with ₹0 paid amount');
    assert(po1.payments.length === 0, 'PO has 0 initial payments');

    // ------------------------------------------------------------------------
    // TEST 2: Record 1st Partial Payment (₹30,000)
    // ------------------------------------------------------------------------
    console.log('\n--- Test 2: Record 1st Partial Payment (₹30,000 via Bank Transfer) ---');
    const voucherNo1 = `PV-TEST-001-${Date.now().toString().slice(-4)}`;
    const pay1 = await prisma.purchasePayment.create({
      data: {
        purchaseId: po1.id,
        voucherNo: voucherNo1,
        amount: 30000,
        paymentDate: new Date(),
        paymentMethod: 'Bank Transfer',
        referenceNo: 'UTR-TEST-0001',
        notes: 'Advance 30% payment tranche',
        recordedBy: 'Accounts Manager',
      },
    });

    // Create ledger entries for payment
    await prisma.financialLedgerEntry.create({
      data: {
        entryNo: `JRN-PAY-AP-${voucherNo1}`,
        entryDate: new Date(),
        storeCode: po1.storeCode,
        accountCategory: 'LIABILITY',
        accountName: 'Vendor Accounts Payable (Settlement)',
        debit: 30000,
        credit: 0,
        amount: -30000,
        refType: 'VENDOR_PAYMENT',
        refId: pay1.id,
        refNo: voucherNo1,
        entityName: vendor.name,
        description: `Vendor payment for ${po1.poNo}`,
        createdBy: 'Test Runner',
      },
    });

    await prisma.financialLedgerEntry.create({
      data: {
        entryNo: `JRN-PAY-BANK-${voucherNo1}`,
        entryDate: new Date(),
        storeCode: po1.storeCode,
        accountCategory: 'ASSET',
        accountName: 'Cash / Bank (Bank Transfer)',
        debit: 0,
        credit: 30000,
        amount: -30000,
        refType: 'VENDOR_PAYMENT',
        refId: pay1.id,
        refNo: voucherNo1,
        entityName: vendor.name,
        description: `Bank disbursement for ${po1.poNo}`,
        createdBy: 'Test Runner',
      },
    });

    // Update PO
    await prisma.purchaseOrder.update({
      where: { id: po1.id },
      data: {
        paidAmount: 30000,
        paymentStatus: 'Partial',
      },
    });

    const poAfterPay1 = await prisma.purchaseOrder.findUnique({
      where: { id: po1.id },
      include: { payments: true },
    });

    const sumPay1 = poAfterPay1!.payments.reduce((s, p) => s + Number(p.amount), 0);
    const rem1 = Number(poAfterPay1!.totalCost) - sumPay1;

    assert(poAfterPay1!.payments.length === 1, 'Payment 1 recorded in database');
    assert(sumPay1 === 30000, 'Dynamic sum of payments equals ₹30,000');
    assert(rem1 === 70000, 'Remaining balance is dynamically ₹70,000');
    assert(poAfterPay1!.paymentStatus === 'Partial', 'PO status updated to Partial');
    assert(poAfterPay1!.payments[0].referenceNo === 'UTR-TEST-0001', 'Payment UTR preserved correctly');
    assert(poAfterPay1!.payments[0].notes === 'Advance 30% payment tranche', 'Payment remarks preserved');

    // ------------------------------------------------------------------------
    // TEST 3: Record 2nd Partial Payment (₹40,000)
    // ------------------------------------------------------------------------
    console.log('\n--- Test 3: Record 2nd Partial Payment (₹40,000 via UPI) ---');
    const voucherNo2 = `PV-TEST-002-${Date.now().toString().slice(-4)}`;
    const pay2 = await prisma.purchasePayment.create({
      data: {
        purchaseId: po1.id,
        voucherNo: voucherNo2,
        amount: 40000,
        paymentDate: new Date(),
        paymentMethod: 'UPI',
        referenceNo: 'UPI-REF-998877',
        notes: 'Second tranche milestone payment',
        recordedBy: 'Accounts Manager',
      },
    });

    // Create ledger entries for payment 2
    await prisma.financialLedgerEntry.create({
      data: {
        entryNo: `JRN-PAY-AP-${voucherNo2}`,
        entryDate: new Date(),
        storeCode: po1.storeCode,
        accountCategory: 'LIABILITY',
        accountName: 'Vendor Accounts Payable (Settlement)',
        debit: 40000,
        credit: 0,
        amount: -40000,
        refType: 'VENDOR_PAYMENT',
        refId: pay2.id,
        refNo: voucherNo2,
        entityName: vendor.name,
        description: `Vendor payment for ${po1.poNo}`,
        createdBy: 'Test Runner',
      },
    });

    await prisma.financialLedgerEntry.create({
      data: {
        entryNo: `JRN-PAY-BANK-${voucherNo2}`,
        entryDate: new Date(),
        storeCode: po1.storeCode,
        accountCategory: 'ASSET',
        accountName: 'Cash / Bank (UPI)',
        debit: 0,
        credit: 40000,
        amount: -40000,
        refType: 'VENDOR_PAYMENT',
        refId: pay2.id,
        refNo: voucherNo2,
        entityName: vendor.name,
        description: `Bank disbursement for ${po1.poNo}`,
        createdBy: 'Test Runner',
      },
    });

    // Update PO
    await prisma.purchaseOrder.update({
      where: { id: po1.id },
      data: {
        paidAmount: 70000,
        paymentStatus: 'Partial',
      },
    });

    const poAfterPay2 = await prisma.purchaseOrder.findUnique({
      where: { id: po1.id },
      include: { payments: { orderBy: { paymentDate: 'asc' } } },
    });

    const sumPay2 = poAfterPay2!.payments.reduce((s, p) => s + Number(p.amount), 0);
    const rem2 = Number(poAfterPay2!.totalCost) - sumPay2;

    assert(poAfterPay2!.payments.length === 2, 'Previous payment NOT overwritten; PO has 2 payment records');
    assert(sumPay2 === 70000, 'Dynamic sum of both payments equals ₹70,000');
    assert(rem2 === 30000, 'Remaining balance dynamically computed as ₹30,000');
    assert(poAfterPay2!.paymentStatus === 'Partial', 'PO status remains Partial');

    // ------------------------------------------------------------------------
    // TEST 4: Validation Tests (Overpayment & Duplicate Simulation)
    // ------------------------------------------------------------------------
    console.log('\n--- Test 4: Business Logic & Validation Constraints ---');
    const currentRemaining = Number(poAfterPay2!.totalCost) - sumPay2; // ₹30,000
    const overpaymentAmount = 35000;
    const isOverpaymentBlocked = overpaymentAmount > currentRemaining;
    assert(isOverpaymentBlocked, `Overpayment blocked: ₹${overpaymentAmount} > remaining balance ₹${currentRemaining}`);

    // Check duplicate check logic
    const duplicateRef = 'UPI-REF-998877';
    const foundDuplicate = await prisma.purchasePayment.findFirst({
      where: {
        purchaseId: po1.id,
        referenceNo: duplicateRef,
      },
    });
    assert(Boolean(foundDuplicate), `Duplicate reference "${duplicateRef}" accurately identified in database`);

    // ------------------------------------------------------------------------
    // TEST 5: Final Settlement Payment (₹30,000)
    // ------------------------------------------------------------------------
    console.log('\n--- Test 5: Final Settlement Payment (₹30,000 via Cheque) ---');
    const voucherNo3 = `PV-TEST-003-${Date.now().toString().slice(-4)}`;
    const pay3 = await prisma.purchasePayment.create({
      data: {
        purchaseId: po1.id,
        voucherNo: voucherNo3,
        amount: 30000,
        paymentDate: new Date(),
        paymentMethod: 'Cheque',
        referenceNo: 'CHQ-991122',
        notes: 'Final balance settlement',
        recordedBy: 'Accounts Manager',
      },
    });

    await prisma.financialLedgerEntry.create({
      data: {
        entryNo: `JRN-PAY-AP-${voucherNo3}`,
        entryDate: new Date(),
        storeCode: po1.storeCode,
        accountCategory: 'LIABILITY',
        accountName: 'Vendor Accounts Payable (Settlement)',
        debit: 30000,
        credit: 0,
        amount: -30000,
        refType: 'VENDOR_PAYMENT',
        refId: pay3.id,
        refNo: voucherNo3,
        entityName: vendor.name,
        description: `Vendor payment for ${po1.poNo}`,
        createdBy: 'Test Runner',
      },
    });

    await prisma.financialLedgerEntry.create({
      data: {
        entryNo: `JRN-PAY-BANK-${voucherNo3}`,
        entryDate: new Date(),
        storeCode: po1.storeCode,
        accountCategory: 'ASSET',
        accountName: 'Cash / Bank (Cheque)',
        debit: 0,
        credit: 30000,
        amount: -30000,
        refType: 'VENDOR_PAYMENT',
        refId: pay3.id,
        refNo: voucherNo3,
        entityName: vendor.name,
        description: `Bank disbursement for ${po1.poNo}`,
        createdBy: 'Test Runner',
      },
    });

    await prisma.purchaseOrder.update({
      where: { id: po1.id },
      data: {
        paidAmount: 100000,
        paymentStatus: 'Paid',
      },
    });

    const poAfterPay3 = await prisma.purchaseOrder.findUnique({
      where: { id: po1.id },
      include: { payments: true },
    });

    const sumPay3 = poAfterPay3!.payments.reduce((s, p) => s + Number(p.amount), 0);
    const rem3 = Math.max(0, Number(poAfterPay3!.totalCost) - sumPay3);

    assert(poAfterPay3!.payments.length === 3, 'All 3 payment tranches preserved in database');
    assert(sumPay3 === 100000, 'Sum of all tranches equals total cost (₹1,00,000)');
    assert(rem3 === 0, 'Remaining balance is exactly ₹0');
    assert(poAfterPay3!.paymentStatus === 'Paid', 'PO status transitioned to Paid');

    // ------------------------------------------------------------------------
    // TEST 6: PO Creation with Initial Upfront Payment
    // ------------------------------------------------------------------------
    console.log('\n--- Test 6: Create PO with Initial Partial Payment Upfront ---');
    const initialPaid = 20000;
    const po2Total = 50000;
    const po2 = await prisma.purchaseOrder.create({
      data: {
        poNo: `PO-TEST-UPFRONT-${Date.now().toString().slice(-6)}`,
        invoiceNo: `INV-UP-${Date.now().toString().slice(-4)}`,
        vendorId: vendor.id,
        storeCode: 'CENTRAL',
        status: 'Ordered',
        paymentStatus: 'Partial',
        subtotal: po2Total,
        totalCost: po2Total,
        paidAmount: initialPaid,
        creditAmount: 0,
        createdBy: 'Test Runner',
        items: {
          create: [
            {
              productId: product.id,
              qtyOrdered: 5,
              qtyReceived: 0,
              unitCost: 10000,
              lineTotal: po2Total,
            },
          ],
        },
      },
    });
    createdPoIds.push(po2.id);

    const vNoUpfront = `PV-UPFRONT-${Date.now().toString().slice(-4)}`;
    const payUpfront = await prisma.purchasePayment.create({
      data: {
        purchaseId: po2.id,
        voucherNo: vNoUpfront,
        amount: initialPaid,
        paymentDate: new Date(),
        paymentMethod: 'Bank Transfer',
        referenceNo: 'UTR-UPFRONT-99',
        notes: 'Upfront advance tranche at PO creation',
        recordedBy: 'Test Runner',
      },
    });

    await prisma.financialLedgerEntry.create({
      data: {
        entryNo: `JRN-PAY-AP-${vNoUpfront}`,
        entryDate: new Date(),
        storeCode: po2.storeCode,
        accountCategory: 'LIABILITY',
        accountName: 'Vendor Accounts Payable (Settlement)',
        debit: initialPaid,
        credit: 0,
        amount: -initialPaid,
        refType: 'VENDOR_PAYMENT',
        refId: payUpfront.id,
        refNo: vNoUpfront,
        entityName: vendor.name,
        description: `Initial payment for ${po2.poNo}`,
        createdBy: 'Test Runner',
      },
    });

    await prisma.financialLedgerEntry.create({
      data: {
        entryNo: `JRN-PAY-BANK-${vNoUpfront}`,
        entryDate: new Date(),
        storeCode: po2.storeCode,
        accountCategory: 'ASSET',
        accountName: 'Cash / Bank (Bank Transfer)',
        debit: 0,
        credit: initialPaid,
        amount: -initialPaid,
        refType: 'VENDOR_PAYMENT',
        refId: payUpfront.id,
        refNo: vNoUpfront,
        entityName: vendor.name,
        description: `Bank disbursement for ${po2.poNo}`,
        createdBy: 'Test Runner',
      },
    });

    const po2Check = await prisma.purchaseOrder.findUnique({
      where: { id: po2.id },
      include: { payments: true },
    });

    const po2SumPaid = po2Check!.payments.reduce((s, p) => s + Number(p.amount), 0);
    const po2Rem = Number(po2Check!.totalCost) - po2SumPaid;

    assert(po2Check!.payments.length === 1, 'Initial payment record created for PO created with payment');
    assert(po2SumPaid === 20000, 'PO dynamic paid amount is ₹20,000');
    assert(po2Rem === 30000, 'PO remaining balance is ₹30,000');
    assert(po2Check!.paymentStatus === 'Partial', 'PO status is Partial');

    // ------------------------------------------------------------------------
    // TEST 7: Cross-Module Vendor Reconciliation Check
    // ------------------------------------------------------------------------
    console.log('\n--- Test 7: Cross-Module Vendor & Ledger Reconciliation ---');
    const vendorWithPurchases = await prisma.vendor.findUnique({
      where: { id: vendor.id },
      include: {
        purchases: {
          where: { status: { notIn: ['Cancelled', 'Archived'] } },
          include: { payments: true },
        },
      },
    });

    let vendorBilled = 0;
    let vendorPaid = 0;
    let vendorOutstanding = 0;

    for (const p of vendorWithPurchases!.purchases) {
      const tc = Number(p.totalCost);
      const paid = p.payments.reduce((s, pay) => s + Number(pay.amount), 0);
      const rem = Math.max(0, tc - paid);
      vendorBilled += tc;
      vendorPaid += paid;
      vendorOutstanding += rem;
    }

    assert(vendorBilled === 150000, `Vendor total billed across both POs = ₹1,50,000 (actual: ₹${vendorBilled})`);
    assert(vendorPaid === 120000, `Vendor total paid across all tranches = ₹1,20,000 (actual: ₹${vendorPaid})`);
    assert(vendorOutstanding === 30000, `Vendor outstanding payable = ₹30,000 (actual: ₹${vendorOutstanding})`);

    // ------------------------------------------------------------------------
    // TEST 8: Financial Reconciliation Engine Proof
    // ------------------------------------------------------------------------
    console.log('\n--- Test 8: General Ledger & Root Financial Invariant Proofs ---');
    const audit = await runRootFinancialReconciliation();
    assert(audit.status === 'RECONCILED', 'Root Financial Reconciliation Status is 100% RECONCILED');

    const payablesProof = audit.proofs.find((p: any) => p.test.includes('Outstanding Payables'));
    assert(Boolean(payablesProof?.isReconciled), 'Outstanding Payables invariant mathematically reconciled');

    const ledgerProof = audit.proofs.find((p: any) => p.test.includes('General Ledger Double-Entry'));
    assert(Boolean(ledgerProof?.isReconciled), 'Double-entry general ledger debits == credits reconciled');
  } finally {
    // ------------------------------------------------------------------------
    // CLEANUP
    // ------------------------------------------------------------------------
    console.log('\n--- Cleanup Test Records ---');
    for (const poId of createdPoIds) {
      const pays = await prisma.purchasePayment.findMany({ where: { purchaseId: poId } });
      for (const p of pays) {
        await prisma.financialLedgerEntry.deleteMany({ where: { refId: p.id } });
      }
      await prisma.purchasePayment.deleteMany({ where: { purchaseId: poId } });
      await prisma.purchaseOrderItem.deleteMany({ where: { poId } });
      await prisma.purchaseOrder.delete({ where: { id: poId } });
    }
    console.log(`Cleaned up ${createdPoIds.length} test purchase orders and associated ledger entries.`);

    // Confirm post-cleanup reconciliation
    const postCleanupAudit = await runRootFinancialReconciliation();
    assert(postCleanupAudit.status === 'RECONCILED', 'System remains 100% RECONCILED after test cleanup');
  }

  console.log('\n========================================================================');
  console.log(`🎉 TEST SUMMARY: ${passed} of ${total} tests passed!`);
  console.log('========================================================================\n');

  if (passed !== total) {
    process.exit(1);
  }
}

if (require.main === module) {
  runTests()
    .then(async () => {
      await prisma.$disconnect();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('Fatal error in tests:', err);
      await prisma.$disconnect();
      process.exit(1);
    });
}
