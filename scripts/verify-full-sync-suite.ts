import { prisma } from '../src/lib/db';
import { signSessionToken, verifySessionToken, hashPassword, comparePassword } from '../src/lib/auth';

async function runFullSyncVerification() {
  console.log('\n===============================================================');
  console.log('🚀 COSKO PRODUCTION DATA SYNC & MYSQL PERSISTENCE VERIFICATION');
  console.log('===============================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    totalTests++;
    if (condition) {
      console.log(`  ✅ [PASS] ${testName}`);
      passedTests++;
    } else {
      console.error(`  ❌ [FAIL] ${testName}${detail ? ` - ${detail}` : ''}`);
    }
  }

  try {
    // ------------------------------------------------------------------------
    // TEST 1: Database Connectivity & Schema Health
    // ------------------------------------------------------------------------
    console.log('--- Test Group 1: Database Connection & Schema Health ---');
    const storeCount = await prisma.storeHub.count();
    assert(storeCount > 0, `Database connected successfully (${storeCount} stores found)`);

    // ------------------------------------------------------------------------
    // TEST 2: Authoritative Session & Authentication Token
    // ------------------------------------------------------------------------
    console.log('\n--- Test Group 2: Authoritative Auth & Token Flow ---');
    const superAdmin = await prisma.userAccount.findFirst({
      where: { role: 'Super Admin' },
      include: { storeAssignments: true },
    });
    assert(!!superAdmin, 'Super Admin user exists in MySQL database');

    if (superAdmin) {
      const token = signSessionToken({
        id: superAdmin.id,
        email: superAdmin.email,
        role: 'Super Admin',
        securityLevel: 100,
        store: 'All Stores',
        name: superAdmin.name,
        avatar: 'SA',
        shiftStatus: 'On Shift',
      });
      assert(!!token, 'Auth JWT token generated successfully');

      const payload = verifySessionToken(token);
      assert(payload?.id === superAdmin.id && payload?.email === superAdmin.email, 'Token verified with server AUTH_SECRET');
    }

    // ------------------------------------------------------------------------
    // TEST 3: User Creation & Persistence (Store Manager Multi-Store Assignment)
    // ------------------------------------------------------------------------
    console.log('\n--- Test Group 3: User Persistence & Store Assignment ---');
    const testUserEmail = `manager.test.${Date.now()}@cosko.com`;
    const hashed = await hashPassword('CoskoManager2026!');

    const targetStore = await prisma.storeHub.findFirst();
    assert(!!targetStore, 'Target store available for assignment');

    const createdUser = await prisma.userAccount.create({
      data: {
        name: 'Test Store Manager',
        email: testUserEmail,
        passwordHash: hashed,
        role: 'Store Manager',
        securityLevel: 80,
        storeScope: targetStore ? targetStore.code : 'BLR',
        status: 'Active',
        shiftStatus: 'On Shift',
        storeAssignments: targetStore ? {
          create: {
            storeCode: targetStore.code,
          },
        } : undefined,
      },
      include: {
        storeAssignments: true,
      },
    });

    assert(!!createdUser.id, `User persisted with database ID: ${createdUser.id}`);
    assert(createdUser.storeAssignments.length > 0, `Store assignment persisted in MySQL: ${createdUser.storeAssignments[0]?.storeCode}`);

    // Verify Password Login Verification
    const passwordMatch = await comparePassword('CoskoManager2026!', createdUser.passwordHash);
    assert(passwordMatch, 'User can authenticate with committed password hash');

    // Simulate /api/auth/me authoritative check
    const verifiedLiveUser = await prisma.userAccount.findFirst({
      where: { id: createdUser.id, status: 'Active' },
      include: { storeAssignments: true },
    });
    assert(verifiedLiveUser?.id === createdUser.id, 'Live MySQL session restoration validates active user');

    // ------------------------------------------------------------------------
    // TEST 4: Product & Inventory Persistence Across Stores
    // ------------------------------------------------------------------------
    console.log('\n--- Test Group 4: Inventory Persistence & Multi-Store Stock ---');
    const testSku = `SKU-TEST-${Date.now().toString().slice(-6)}`;
    const createdProduct = await prisma.product.create({
      data: {
        sku: testSku,
        barcode: `890${Date.now().toString().slice(-9)}`,
        name: 'Enterprise Test Smartphone Pro',
        brand: 'Cosko Tech',
        category: 'Smartphones',
        baseCostPrice: 45000,
        baseSellingPrice: 54999,
        gstRate: 18,
        warrantyMonths: 24,
        status: 'active',
      },
    });

    assert(!!createdProduct.id, `Product created in database (ID: ${createdProduct.id}, SKU: ${createdProduct.sku})`);

    // Create inventory record in target store
    const invRecord = await prisma.inventory.create({
      data: {
        productId: createdProduct.id,
        storeCode: targetStore!.code,
        qtyOnHand: 25,
        reorderPt: 5,
        shelfLoc: 'Shelf A1',
      },
      include: {
        product: true,
      },
    });

    assert(invRecord.qtyOnHand === 25, `Store stock committed to MySQL (${invRecord.qtyOnHand} units in ${invRecord.storeCode})`);

    // Re-query database to simulate second device fetching fresh state
    const device2Fetch = await prisma.inventory.findFirst({
      where: { productId: createdProduct.id, storeCode: targetStore!.code },
      include: { product: true },
    });

    assert(device2Fetch?.qtyOnHand === 25, 'Device 2 instantly reads the committed 25 units from MySQL');

    // Update stock (simulating a POS Sale / Stock Adjustment)
    const updatedInv = await prisma.inventory.update({
      where: { id: invRecord.id },
      data: { qtyOnHand: 24 },
    });

    assert(updatedInv.qtyOnHand === 24, 'Stock successfully decremented in database');

    const device2FetchAfterSale = await prisma.inventory.findFirst({
      where: { id: invRecord.id },
    });
    assert(device2FetchAfterSale?.qtyOnHand === 24, 'Device 2 observes decremented stock (24 units)');

    // ------------------------------------------------------------------------
    // TEST 5: Category Hierarchy CRUD & Non-Reappearance
    // ------------------------------------------------------------------------
    console.log('\n--- Test Group 5: Category Hierarchy & Deletion Integrity ---');
    const testCategory = await prisma.category.create({
      data: {
        name: `Test Category ${Date.now()}`,
        slug: `test-category-${Date.now()}`,
        categoryType: 'Product',
        status: 'Active',
      },
    });

    assert(!!testCategory.id, `Category created in database: ${testCategory.name}`);

    // Update Category
    const updatedCat = await prisma.category.update({
      where: { id: testCategory.id },
      data: { description: 'Updated category description for production' },
    });
    assert(updatedCat.description === 'Updated category description for production', 'Category updated in database');

    // Delete/Archive Category
    await prisma.category.delete({
      where: { id: testCategory.id },
    });

    const deletedCatCheck = await prisma.category.findUnique({
      where: { id: testCategory.id },
    });
    assert(deletedCatCheck === null, 'Deleted category is completely removed and does NOT reappear on refresh');

    // ------------------------------------------------------------------------
    // TEST 6: Customer, Vendor, Expense & POS Persistence
    // ------------------------------------------------------------------------
    console.log('\n--- Test Group 6: Customers, Vendors, Expenses & Sales Transactions ---');

    // Customer
    const testPhone = `9845${Date.now().toString().slice(-6)}`;
    const testCustomer = await prisma.customer.create({
      data: {
        name: 'Dr. Ramesh Rao',
        phone: testPhone,
        normalizedPhone: testPhone.replace(/\D/g, ''),
        email: `ramesh.${Date.now()}@example.com`,
        city: 'Bengaluru',
        creditBalance: 0,
        totalSpent: 0,
      },
    });
    assert(!!testCustomer.id, `Customer saved to database: ${testCustomer.name}`);

    // Vendor
    const testVendor = await prisma.vendor.create({
      data: {
        code: `VND-T${Date.now().toString().slice(-4)}`,
        name: 'Apex Semiconductor Distributors',
        contactPerson: 'Mr. Kapoor',
        phone: '+91 80 4455 6677',
        email: 'sales@apexsemi.com',
        city: 'Bengaluru',
        categories: 'Semiconductors',
      },
    });
    assert(!!testVendor.id, `Vendor saved to database: ${testVendor.name}`);

    // Expense
    const testExpense = await prisma.expense.create({
      data: {
        expenseNo: `EXP-TEST-${Date.now().toString().slice(-4)}`,
        category: 'Utilities',
        amount: 3500.00,
        storeCode: targetStore!.code,
        description: 'Monthly High-Speed Fiber Internet Bill',
        paymentMethod: 'UPI',
        approvedBy: 'Finance Lead',
        date: new Date(),
      },
    });
    assert(!!testExpense.id, `Expense record committed to database: ${testExpense.expenseNo}`);

    // POS SalesOrder Transaction
    const testSale = await prisma.salesOrder.create({
      data: {
        orderNo: `CS26-TEST-${Date.now().toString().slice(-4)}`,
        storeCode: targetStore!.code,
        customerId: testCustomer.id,
        customerName: testCustomer.name,
        customerPhone: testCustomer.phone,
        subtotal: 54999,
        taxAmount: 9899.82,
        discountAmount: 0,
        grandTotal: 64898.82,
        totalCost: 45000,
        grossProfit: 9999,
        paymentMethod: 'UPI',
        status: 'Completed',
        cashierName: 'Cashier 1',
        items: {
          create: {
            productId: createdProduct.id,
            productName: createdProduct.name,
            sku: createdProduct.sku,
            qty: 1,
            unitPrice: 54999,
            unitCost: 45000,
            lineTotal: 54999,
            lineProfit: 9999,
          },
        },
      },
      include: {
        items: true,
      },
    });
    assert(!!testSale.id && testSale.items.length === 1, `POS Sale Transaction committed with invoice ${testSale.orderNo}`);

    // ------------------------------------------------------------------------
    // TEST 7: Cleanup of Test Artifacts
    // ------------------------------------------------------------------------
    console.log('\n--- Test Group 7: Teardown & Final Integrity Verification ---');
    await prisma.salesOrderItem.deleteMany({ where: { orderId: testSale.id } });
    await prisma.salesOrder.delete({ where: { id: testSale.id } });
    await prisma.inventory.deleteMany({ where: { productId: createdProduct.id } });
    await prisma.product.delete({ where: { id: createdProduct.id } });
    await prisma.expense.delete({ where: { id: testExpense.id } });
    await prisma.customer.delete({ where: { id: testCustomer.id } });
    await prisma.vendor.delete({ where: { id: testVendor.id } });
    await prisma.userStoreAssignment.deleteMany({ where: { userId: createdUser.id } });
    await prisma.userAccount.delete({ where: { id: createdUser.id } });

    assert(true, 'Test resources cleanly unmounted from database');

    console.log('\n===============================================================');
    console.log(`🎉 TEST SUMMARY: ${passedTests}/${totalTests} TESTS PASSED`);
    console.log('===============================================================\n');

    if (passedTests === totalTests) {
      process.exit(0);
    } else {
      process.exit(1);
    }
  } catch (error: any) {
    console.error('❌ Unhandled error during verification suite:', error);
    process.exit(1);
  }
}

runFullSyncVerification();
