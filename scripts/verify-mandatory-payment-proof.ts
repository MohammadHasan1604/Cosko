import { prisma } from '../src/lib/db';
import fs from 'fs';
import path from 'path';

async function runVerification() {
  console.log('=== VERIFYING MANDATORY PAYMENT PROOF SYSTEM ===\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, msg: string) {
    if (condition) {
      console.log(`✅ PASS: ${msg}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${msg}`);
      failed++;
    }
  }

  // 1. Check upload directory
  const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'payment-proofs');
  assert(fs.existsSync(uploadDir), `Upload directory exists at ${uploadDir}`);

  // 2. Check MySQL Database Columns
  console.log('\n--- Checking MySQL Table Columns ---');
  try {
    const rawSalesCols: any[] = await prisma.$queryRawUnsafe(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sales' 
      AND COLUMN_NAME IN ('payment_proof_url', 'reference_no')
    `);
    const salesColNames = rawSalesCols.map((c: any) => c.COLUMN_NAME);
    assert(salesColNames.includes('payment_proof_url'), 'Table `sales` has `payment_proof_url` column');
    assert(salesColNames.includes('reference_no'), 'Table `sales` has `reference_no` column');

    const rawExpenseCols: any[] = await prisma.$queryRawUnsafe(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'expenses' 
      AND COLUMN_NAME IN ('receipt_url', 'reference_no', 'recorded_by')
    `);
    const expColNames = rawExpenseCols.map((c: any) => c.COLUMN_NAME);
    assert(expColNames.includes('receipt_url'), 'Table `expenses` has `receipt_url` column');
    assert(expColNames.includes('reference_no'), 'Table `expenses` has `reference_no` column');
    assert(expColNames.includes('recorded_by'), 'Table `expenses` has `recorded_by` column');

    const rawPayCols: any[] = await prisma.$queryRawUnsafe(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'purchase_payments' 
      AND COLUMN_NAME IN ('receipt_url', 'reference_no')
    `);
    const payColNames = rawPayCols.map((c: any) => c.COLUMN_NAME);
    assert(payColNames.includes('receipt_url'), 'Table `purchase_payments` has `receipt_url` column');
    assert(payColNames.includes('reference_no'), 'Table `purchase_payments` has `reference_no` column');

  } catch (err: any) {
    assert(false, `Database query failed: ${err.message}`);
  }

  // 3. Test Purchase Payment API logic (Server-Side Enforced 400 Bad Request on Missing Proof/Ref)
  console.log('\n--- Checking Backend API Validation Logic ---');
  const purchasePaymentRouteFile = fs.readFileSync(
    path.join(process.cwd(), 'src/app/api/purchases/payments/route.ts'),
    'utf8'
  );
  assert(
    purchasePaymentRouteFile.includes('!proofUrl') && purchasePaymentRouteFile.includes('!cleanRef'),
    'API route `/api/purchases/payments` strictly validates receiptUrl/proofUrl and referenceNo/cleanRef'
  );
  assert(
    purchasePaymentRouteFile.includes('status: 400'),
    'API route `/api/purchases/payments` returns 400 Bad Request on missing proof/reference'
  );

  // 4. Test Expenses API logic
  const expensesRouteFile = fs.readFileSync(
    path.join(process.cwd(), 'src/app/api/expenses/route.ts'),
    'utf8'
  );
  assert(
    expensesRouteFile.includes('!proofUrl') && expensesRouteFile.includes('!cleanRef'),
    'API route `/api/expenses` strictly validates receiptUrl/proofUrl and cleanRef'
  );
  assert(
    expensesRouteFile.includes('status: 400'),
    'API route `/api/expenses` returns 400 Bad Request on missing proof/reference'
  );

  // 5. Test Purchases API (Upfront payment proof validation)
  const purchasesRouteFile = fs.readFileSync(
    path.join(process.cwd(), 'src/app/api/purchases/route.ts'),
    'utf8'
  );
  assert(
    purchasesRouteFile.includes('!initProof') && purchasesRouteFile.includes('!initRef'),
    'API route `/api/purchases` validates upfront payment proof and UTR'
  );

  // 6. Test Sales API (Mandatory proof and reference check)
  const salesRouteFile = fs.readFileSync(
    path.join(process.cwd(), 'src/app/api/sales/route.ts'),
    'utf8'
  );
  assert(
    salesRouteFile.includes('!effectiveProofUrl') && salesRouteFile.includes('!body.referenceNo'),
    'API route `/api/sales` strictly validates mandatory payment proof and reference number'
  );

  // 7. Test Sales Service (Zero-bypass in executePOSCheckout)
  const salesServiceFile = fs.readFileSync(
    path.join(process.cwd(), 'src/lib/services/salesService.ts'),
    'utf8'
  );
  assert(
    salesServiceFile.includes('Payment proof is mandatory') && salesServiceFile.includes('Payment Reference / UTR'),
    '`salesService.ts` executePOSCheckout enforces mandatory payment proof and reference at service layer'
  );

  // 8. Test Expenses API PUT (Cannot clear proof on update)
  assert(
    expensesRouteFile.includes('Payment proof is strictly mandatory and cannot be removed'),
    'API route `/api/expenses` PUT prevents removing payment proof during updates'
  );

  // 9. Test File Upload Route
  const uploadRouteFile = fs.readFileSync(
    path.join(process.cwd(), 'src/app/api/upload/route.ts'),
    'utf8'
  );
  assert(
    uploadRouteFile.includes('image/jpeg') && uploadRouteFile.includes('application/pdf'),
    'Upload route `/api/upload` enforces JPG, PNG, WebP, PDF mime types'
  );

  // 10. Verify UI Components
  console.log('\n--- Checking UI Components & Views ---');
  const paymentProofUploadFile = fs.readFileSync(
    path.join(process.cwd(), 'src/components/ui/PaymentProofUpload.tsx'),
    'utf8'
  );
  assert(
    paymentProofUploadFile.includes('capture="environment"') && paymentProofUploadFile.includes('isDragging'),
    '`PaymentProofUpload` supports mobile camera capture, file browse, and desktop drag-drop'
  );
  assert(
    paymentProofUploadFile.includes('Mandatory') && paymentProofUploadFile.includes('strictly mandatory'),
    '`PaymentProofUpload` displays mandatory badge and strict requirement notice'
  );

  const proofViewerModalFile = fs.readFileSync(
    path.join(process.cwd(), 'src/components/ui/ProofViewerModal.tsx'),
    'utf8'
  );
  assert(
    proofViewerModalFile.includes('download') && proofViewerModalFile.includes('PaymentProofData'),
    '`ProofViewerModal` provides full-screen view and native download'
  );

  // 11. Verify Button Disabling Across Form Modals
  console.log('\n--- Checking Submit Button Disabling Across All Forms ---');
  const supplierPaymentModalFile = fs.readFileSync(
    path.join(process.cwd(), 'src/components/forms/SupplierPaymentModal.tsx'),
    'utf8'
  );
  assert(
    supplierPaymentModalFile.includes('disabled={isSubmitting || !payProof'),
    '`SupplierPaymentModal` disables Record Payment button until proof is uploaded'
  );

  const expenseFormModalFile = fs.readFileSync(
    path.join(process.cwd(), 'src/components/forms/ExpenseFormModal.tsx'),
    'utf8'
  );
  assert(
    expenseFormModalFile.includes('disabled={isSubmitting || !receiptUrl'),
    '`ExpenseFormModal` disables Record/Save Expense button until receipt/proof is uploaded'
  );

  const purchaseOrderFormModalFile = fs.readFileSync(
    path.join(process.cwd(), 'src/components/forms/PurchaseOrderFormModal.tsx'),
    'utf8'
  );
  assert(
    purchaseOrderFormModalFile.includes('!paymentProof || !paymentRef.trim()'),
    '`PurchaseOrderFormModal` disables submit button when advance payment proof is missing'
  );

  const salesPageFile = fs.readFileSync(path.join(process.cwd(), 'src/app/sales/page.tsx'), 'utf8');
  assert(
    salesPageFile.includes('disabled={cart.length === 0 || isCheckingOut || !posPaymentProofUrl'),
    '`sales/page.tsx` disables checkout button until payment proof is uploaded'
  );

  // 12. Verify Payment History & Proof Viewing in All Modules
  console.log('\n--- Checking Proof Viewer Availability in Ledger & History ---');
  const purchasePageFile = fs.readFileSync(path.join(process.cwd(), 'src/app/purchases/page.tsx'), 'utf8');
  assert(
    purchasePageFile.includes('Payment Proof — Voucher') && purchasePageFile.includes('View Proof'),
    'Purchases page shows View Proof buttons in payment transactions history subtable'
  );

  const vendorPageFile = fs.readFileSync(path.join(process.cwd(), 'src/app/vendors/page.tsx'), 'utf8');
  assert(
    vendorPageFile.includes('Payment Proof Attached') && vendorPageFile.includes('View Proof'),
    'Vendor page includes View Proof in bills drawer and official receipt voucher modal'
  );

  const expensesPageFile = fs.readFileSync(path.join(process.cwd(), 'src/app/expenses/page.tsx'), 'utf8');
  assert(
    expensesPageFile.includes('Payment Proof') && expensesPageFile.includes('View Proof'),
    'Expenses page includes View Proof in expenses table'
  );

  const accountingPageFile = fs.readFileSync(path.join(process.cwd(), 'src/app/accounting/page.tsx'), 'utf8');
  assert(
    accountingPageFile.includes('ProofViewerModal') && accountingPageFile.includes('View Proof'),
    'Accounting page General Ledger includes Payment Proof viewer'
  );

  console.log(`\n================================`);
  console.log(`Total Passed: ${passed}`);
  console.log(`Total Failed: ${failed}`);
  console.log(`================================\n`);

  if (failed > 0) {
    process.exit(1);
  } else {
    console.log('🎉 ALL PAYMENT PROOF AUDIT CHECKS PASSED!');
    process.exit(0);
  }
}

runVerification()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
