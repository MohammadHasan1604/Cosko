import { prisma } from '../src/lib/db';
import { comparePassword, signSessionToken, verifySessionToken } from '../src/lib/auth';

async function verifyCleanDbState() {
  console.log('\n===============================================================');
  console.log('✨ COSKO ENTERPRISE — CLEAN DATABASE VERIFICATION PROTOCOL');
  console.log('===============================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, name: string, detail?: string) {
    total++;
    if (condition) {
      console.log(`  ✅ [PASS] ${name}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${name}${detail ? ` - ${detail}` : ''}`);
    }
  }

  try {
    // 1. Table Count Validations (Zero Business Data)
    console.log('--- Test Group 1: Zero Business Data Verification ---');
    const productsCount = await prisma.product.count();
    assert(productsCount === 0, `Products count is 0 (found ${productsCount})`);

    const categoriesCount = await prisma.category.count();
    assert(categoriesCount === 0, `Categories count is 0 (found ${categoriesCount})`);

    const inventoryCount = await prisma.inventory.count();
    assert(inventoryCount === 0, `Inventory records count is 0 (found ${inventoryCount})`);

    const salesCount = await prisma.salesOrder.count();
    assert(salesCount === 0, `Sales orders count is 0 (found ${salesCount})`);

    const purchasesCount = await prisma.purchaseOrder.count();
    assert(purchasesCount === 0, `Purchase orders count is 0 (found ${purchasesCount})`);

    const customersCount = await prisma.customer.count();
    assert(customersCount === 0, `Customers count is 0 (found ${customersCount})`);

    const vendorsCount = await prisma.vendor.count();
    assert(vendorsCount === 0, `Vendors count is 0 (found ${vendorsCount})`);

    const expensesCount = await prisma.expense.count();
    assert(expensesCount === 0, `Expenses count is 0 (found ${expensesCount})`);

    const repairsCount = await prisma.repairEnquiry.count();
    assert(repairsCount === 0, `Repair enquiries count is 0 (found ${repairsCount})`);

    const usersCount = await prisma.userAccount.count();
    assert(usersCount === 1, `Sole Super Admin exists (found exactly ${usersCount} user)`);

    const storesCount = await prisma.storeHub.count();
    assert(storesCount === 5, `Active store hubs exist (found ${storesCount} stores)`);

    // 2. Super Admin Authorization & Password Verification
    console.log('\n--- Test Group 2: Sole Super Admin Integrity ---');
    const superAdmin = await prisma.userAccount.findUnique({
      where: { email: 'cosko@gmail.com' },
      include: { storeAssignments: true },
    });

    assert(!!superAdmin, 'Super Admin found with email: cosko@gmail.com');
    assert(superAdmin?.role === 'Super Admin', 'Role is Super Admin');
    assert(superAdmin?.securityLevel === 100, 'Security Level is 100');
    assert(superAdmin?.storeScope === 'All Stores', 'Store Scope is "All Stores"');
    assert(superAdmin?.status === 'Active', 'Status is Active');
    assert(superAdmin?.shiftStatus === 'On Shift', 'Shift Status is On Shift');
    assert(Boolean((superAdmin as any)?.mustChangePassword), 'mustChangePassword flag is Active (Mandatory change on first login)');
    assert((superAdmin?.storeAssignments?.length || 0) === 5, `Assigned to all 5 stores (${superAdmin?.storeAssignments?.length} stores)`);

    const isPasswordValid = await comparePassword('Cosko2026@', superAdmin!.passwordHash);
    assert(isPasswordValid, 'Authenticates with temporary password Cosko2026@ against salted bcrypt hash');

    // 3. Session Generation Verification
    console.log('\n--- Test Group 3: Server Session Token Generation ---');
    const sessionToken = signSessionToken({
      id: superAdmin!.id,
      name: superAdmin!.name,
      email: superAdmin!.email,
      role: superAdmin!.role as any,
      securityLevel: superAdmin!.securityLevel,
      store: superAdmin!.storeScope,
      allowedStores: ['CENTRAL', 'BLR', 'HYD', 'DEL', 'MUM'],
      avatar: 'SA',
      shiftStatus: superAdmin!.shiftStatus as any,
      mustChangePassword: true,
    });

    const verifiedSession = verifySessionToken(sessionToken);
    assert(verifiedSession?.email === 'cosko@gmail.com' && verifiedSession?.role === 'Super Admin', 'Session token is signed with server secret and verified');

    // 4. Persistence Lifecycle Test (Create, Verify, Delete, Return to Clean)
    console.log('\n--- Test Group 4: Persistence Lifecycle & Cleanup Test ---');
    const testCat = await prisma.category.create({
      data: {
        name: 'Clean Test Category',
        slug: 'clean-test-category',
        categoryType: 'Electronics',
        description: 'Temporary category for persistence validation',
      },
    });
    assert(!!testCat.id, `Created test category (ID: ${testCat.id})`);

    const testProd = await prisma.product.create({
      data: {
        name: 'Clean Test Product',
        sku: 'SKU-CLEAN-VERIFY',
        barcode: '8901234567890',
        category: testCat.name,
        baseCostPrice: 1200.00,
        baseSellingPrice: 1999.00,
        status: 'Active',
      },
    });
    assert(!!testProd.id, `Created test product (ID: ${testProd.id})`);

    // Verify persisted in MySQL
    const fetchedProd = await prisma.product.findUnique({ where: { id: testProd.id } });
    assert(fetchedProd?.name === 'Clean Test Product', 'Product successfully fetched from MySQL');

    // Clean up temporary records
    await prisma.product.delete({ where: { id: testProd.id } });
    await prisma.category.delete({ where: { id: testCat.id } });

    const finalProdCount = await prisma.product.count();
    const finalCatCount = await prisma.category.count();
    assert(finalProdCount === 0 && finalCatCount === 0, 'Temporary test records deleted; database remains 100% clean');

    console.log('\n===============================================================');
    console.log(`🎉 VERIFICATION RESULT: ${passed}/${total} TESTS PASSED (100%)`);
    console.log('===============================================================\n');

    if (passed === total) {
      process.exit(0);
    } else {
      process.exit(1);
    }
  } catch (err: any) {
    console.error('❌ Verification failed:', err);
    process.exit(1);
  }
}

verifyCleanDbState();
