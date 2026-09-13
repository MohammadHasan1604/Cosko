import { NextRequest } from 'next/server';
import { prisma } from '../src/lib/db';
import { signSessionToken } from '../src/lib/auth';

// Import Route Handlers
import * as vendorsRoute from '../src/app/api/vendors/route';
import * as inventoryRoute from '../src/app/api/inventory/route';
import * as transfersRoute from '../src/app/api/transfers/route';
import * as categoriesRoute from '../src/app/api/categories/route';
import * as purchasesRoute from '../src/app/api/purchases/route';
import * as customersRoute from '../src/app/api/customers/route';
import * as expensesRoute from '../src/app/api/expenses/route';
import * as storesRoute from '../src/app/api/stores/route';
import * as usersRoute from '../src/app/api/users/route';

async function runFullCrudSuite() {
  console.log('\n========================================================================');
  console.log('🚀 COSKO COMPREHENSIVE END-TO-END CRUD & AUDIT VERIFICATION SUITE');
  console.log('========================================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    total++;
    if (condition) {
      console.log(`  ✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${testName}${detail ? ` - ${detail}` : ''}`);
    }
  }

  // Create mock Super Admin session token
  const superAdminToken = signSessionToken({
    id: 'test-super-admin',
    name: 'Super Admin',
    email: 'cosko@gmail.com',
    role: 'Super Admin',
    securityLevel: 100,
    store: 'All Stores',
    avatar: 'SA',
    shiftStatus: 'On Shift',
  });

  function createReq(url: string, method: string, body?: any): NextRequest {
    const init: any = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${superAdminToken}`,
        'Cookie': `cosko_session=${superAdminToken}`,
      },
    };
    if (body) {
      init.body = JSON.stringify(body);
    }
    return new NextRequest(new URL(url, 'http://localhost:3000'), init);
  }

  try {
    // ------------------------------------------------------------------------
    // 1. VENDORS MODULE CRUD (Testing Optional GSTIN & Hard Delete)
    // ------------------------------------------------------------------------
    console.log('--- 1. Vendors Module CRUD ---');
    const vCode = `VND-TEST-${Date.now().toString().slice(-4)}`;
    
    // Create with empty GSTIN (must NOT block)
    const vCreateReq = createReq('http://localhost:3000/api/vendors', 'POST', {
      name: 'Test Vendor No GSTIN',
      code: vCode,
      gstin: '',
      category: 'Electronics',
      contactPerson: 'Vendor Mgr',
    });
    const vCreateRes = await vendorsRoute.POST(vCreateReq);
    const vCreateData = await vCreateRes.json();
    assert(vCreateRes.status === 201 && vCreateData.success, 'Vendor created successfully with empty GSTIN');

    // Read back from MySQL
    const vInDb = await (prisma as any).vendor.findUnique({ where: { code: vCode } });
    assert(vInDb && vInDb.name === 'Test Vendor No GSTIN', 'Vendor persisted in MySQL root database');

    // Update vendor with valid GSTIN
    const vUpdateReq1 = createReq('http://localhost:3000/api/vendors', 'PUT', {
      id: vInDb.id,
      name: 'Test Vendor With GSTIN',
      gstin: '29ABCDE1234F1Z5',
    });
    const vUpdateRes1 = await vendorsRoute.PUT(vUpdateReq1);
    const vUpdateData1 = await vUpdateRes1.json();
    assert(vUpdateRes1.status === 200 && vUpdateData1.vendor?.gstin === '29ABCDE1234F1Z5', 'Vendor updated with valid GSTIN');

    // Update vendor clearing GSTIN back to empty string (must NOT block)
    const vUpdateReq2 = createReq('http://localhost:3000/api/vendors', 'PUT', {
      id: vInDb.id,
      gstin: '',
    });
    const vUpdateRes2 = await vendorsRoute.PUT(vUpdateReq2);
    const vUpdateData2 = await vUpdateRes2.json();
    assert(vUpdateRes2.status === 200 && vUpdateData2.vendor?.gstin === '', 'Vendor updated to clear GSTIN without validation block');

    // Update vendor with malformed GSTIN (should reject)
    const vUpdateReqBad = createReq('http://localhost:3000/api/vendors', 'PUT', {
      id: vInDb.id,
      gstin: 'INVALID_GSTIN_123',
    });
    const vUpdateResBad = await vendorsRoute.PUT(vUpdateReqBad);
    assert(vUpdateResBad.status === 400, 'Invalid GSTIN rejected when non-empty value provided');

    // Delete vendor permanently
    const vDeleteReq = createReq(`http://localhost:3000/api/vendors?id=${vInDb.id}&permanent=true`, 'DELETE');
    const vDeleteRes = await vendorsRoute.DELETE(vDeleteReq);
    const vDeleteData = await vDeleteRes.json();
    assert(vDeleteData.success && vDeleteData.mode === 'deleted', 'Vendor permanently deleted from MySQL');
    const vAfterDelete = await (prisma as any).vendor.findUnique({ where: { id: vInDb.id } });
    assert(!vAfterDelete, 'Vendor no longer exists in MySQL');

    // ------------------------------------------------------------------------
    // 2. INVENTORY MODULE CRUD (Testing Synthetic ID Deletion & Cascade)
    // ------------------------------------------------------------------------
    console.log('\n--- 2. Inventory Module CRUD ---');
    const testSku = `TEST-PROD-${Date.now().toString().slice(-4)}`;
    
    // Create product without image (optional)
    const pCreateReq = createReq('http://localhost:3000/api/inventory', 'POST', {
      name: 'Test Audit Product',
      sku: testSku,
      category: 'Smartphones',
      baseCostPrice: 5000,
      baseSellingPrice: 7500,
      mrp: 8000,
      storeCode: 'CENTRAL',
      qtyOnHand: 20,
    });
    const pCreateRes = await inventoryRoute.POST(pCreateReq);
    const pCreateData = await pCreateRes.json();
    assert(pCreateRes.status === 201 && pCreateData.success, 'Product created without mandatory image requirement');

    const pInDb = await prisma.product.findUnique({
      where: { sku: testSku },
      include: { inventoryItems: true },
    });
    assert(Boolean(pInDb && pInDb.inventoryItems.length > 0), 'Product and store inventory record created in MySQL');

    // Update product details
    const pUpdateReq = createReq('http://localhost:3000/api/inventory', 'PUT', {
      id: pInDb!.id,
      sellingPrice: 8500,
      qtyOnHand: 25,
      store: 'CENTRAL',
    });
    const pUpdateRes = await inventoryRoute.PUT(pUpdateReq);
    const pUpdateData = await pUpdateRes.json();
    assert(pUpdateRes.status === 200 && pUpdateData.success, 'Product updated in MySQL');

    // Delete using synthetic ID: `${pInDb.id}-CENTRAL`
    const syntheticId = `${pInDb!.id}-CENTRAL`;
    const pDeleteReq = createReq(`http://localhost:3000/api/inventory?id=${encodeURIComponent(syntheticId)}&permanent=true`, 'DELETE');
    const pDeleteRes = await inventoryRoute.DELETE(pDeleteReq);
    const pDeleteData = await pDeleteRes.json();
    assert(pDeleteData.success && (pDeleteData.mode === 'deleted' || pDeleteData.mode === 'archived'), 'Product deletion resolved synthetic ID');
    
    const pAfter = await prisma.product.findUnique({ where: { id: pInDb!.id } });
    assert(!pAfter || pAfter.status === 'archived', 'Product cleaned up in MySQL');
    await prisma.inventory.deleteMany({ where: { productId: pInDb!.id } });
    if (pAfter) await prisma.product.delete({ where: { id: pInDb!.id } });

    // ------------------------------------------------------------------------
    // 3. STOCK TRANSFERS CRUD (Atomic Transfer & Cancel Reversal)
    // ------------------------------------------------------------------------
    console.log('\n--- 3. Stock Transfers CRUD & Reversal ---');
    // Setup a product at CENTRAL with 30 units
    const transferSku = `TRF-PROD-${Date.now().toString().slice(-4)}`;
    const trfProduct = await prisma.product.create({
      data: {
        sku: transferSku,
        name: 'Transfer Test Product',
        category: 'Accessories',
        baseCostPrice: 1000,
        baseSellingPrice: 1500,
        status: 'active',
        inventoryItems: {
          create: {
            storeCode: 'CENTRAL',
            qtyOnHand: 30,
            reorderPt: 5,
          },
        },
      },
      include: { inventoryItems: true },
    });

    // Execute transfer of 10 units from CENTRAL to BLR
    const trfReq = createReq('http://localhost:3000/api/transfers', 'POST', {
      sourceStore: 'CENTRAL',
      destStore: 'BLR',
      notes: 'Audit transfer test',
      items: [
        {
          productId: trfProduct.id,
          qty: 10,
          costPerUnit: 1000,
          transferPricePerUnit: 1200,
        },
      ],
    });
    const trfRes = await transfersRoute.POST(trfReq);
    const trfData = await trfRes.json();
    assert(trfRes.status === 201 && trfData.success, 'Stock transfer created and executed');

    // Verify stock deduction at CENTRAL (30 - 10 = 20) and credit at BLR (10)
    const centralInv1 = await prisma.inventory.findUnique({
      where: { productId_storeCode: { productId: trfProduct.id, storeCode: 'CENTRAL' } },
    });
    const blrInv1 = await prisma.inventory.findUnique({
      where: { productId_storeCode: { productId: trfProduct.id, storeCode: 'BLR' } },
    });
    assert(centralInv1?.qtyOnHand === 20, 'CENTRAL stock deducted to 20 units');
    assert(blrInv1?.qtyOnHand === 10, 'BLR stock credited with 10 units');

    // Cancel and reverse transfer
    const cancelReq = createReq('http://localhost:3000/api/transfers', 'PUT', {
      id: trfData.transfer.id,
      status: 'Cancelled',
    });
    const cancelRes = await transfersRoute.PUT(cancelReq);
    const cancelData = await cancelRes.json();
    assert(cancelRes.status === 200 && cancelData.success, 'Stock transfer cancellation processed');

    // Verify stock restored at CENTRAL (20 + 10 = 30) and deducted from BLR (10 - 10 = 0)
    const centralInv2 = await prisma.inventory.findUnique({
      where: { productId_storeCode: { productId: trfProduct.id, storeCode: 'CENTRAL' } },
    });
    const blrInv2 = await prisma.inventory.findUnique({
      where: { productId_storeCode: { productId: trfProduct.id, storeCode: 'BLR' } },
    });
    assert(centralInv2?.qtyOnHand === 30, 'CENTRAL stock successfully restored to 30 units');
    assert(blrInv2?.qtyOnHand === 0, 'BLR stock successfully reversed to 0 units');

    // Clean up transfer test records
    await prisma.stockTransferItem.deleteMany({ where: { transferId: trfData.transfer.id } });
    await prisma.stockTransfer.delete({ where: { id: trfData.transfer.id } });
    await prisma.inventoryLedger.deleteMany({ where: { productId: trfProduct.id } });
    await prisma.inventory.deleteMany({ where: { productId: trfProduct.id } });
    await prisma.product.delete({ where: { id: trfProduct.id } });

    // ------------------------------------------------------------------------
    // 4. CATEGORIES CRUD
    // ------------------------------------------------------------------------
    console.log('\n--- 4. Categories CRUD ---');
    const catName = `Test Category ${Date.now().toString().slice(-4)}`;
    const catCreateReq = createReq('http://localhost:3000/api/categories', 'POST', {
      name: catName,
      categoryType: 'Product',
      description: 'Audit test description',
    });
    const catCreateRes = await categoriesRoute.POST(catCreateReq);
    const catCreateData = await catCreateRes.json();
    assert(catCreateRes.status === 200 && catCreateData.success, 'Category created');

    const catUpdateReq = createReq('http://localhost:3000/api/categories', 'PUT', {
      id: catCreateData.category.id,
      description: 'Updated description',
    });
    const catUpdateRes = await categoriesRoute.PUT(catUpdateReq);
    const catUpdateData = await catUpdateRes.json();
    assert(catUpdateRes.status === 200 && catUpdateData.category?.description === 'Updated description', 'Category updated');

    const catDeleteReq = createReq(`http://localhost:3000/api/categories?id=${catCreateData.category.id}&permanent=true`, 'DELETE');
    const catDeleteRes = await categoriesRoute.DELETE(catDeleteReq);
    const catDeleteData = await catDeleteRes.json();
    assert(catDeleteData.success && catDeleteData.mode === 'deleted', 'Category permanently deleted');

    // ------------------------------------------------------------------------
    // 5. CUSTOMERS CRUD (Testing Address Persistence)
    // ------------------------------------------------------------------------
    console.log('\n--- 5. Customers CRUD ---');
    const custPhone = `98${Math.floor(10000000 + Math.random() * 90000000)}`;
    const custCreateReq = createReq('http://localhost:3000/api/customers', 'POST', {
      name: 'Audit Test Customer',
      phone: custPhone,
      email: 'audit.cust@example.com',
      city: 'Bengaluru',
      address: '123 MG Road, Bengaluru',
    });
    const custCreateRes = await customersRoute.POST(custCreateReq);
    const custCreateData = await custCreateRes.json();
    assert(custCreateRes.status === 201 && custCreateData.success, 'Customer created with address');

    const custInDb = await (prisma as any).customer.findUnique({ where: { id: custCreateData.customer.id } });
    assert(custInDb && custInDb.address === '123 MG Road, Bengaluru', 'Customer address properly persisted in MySQL');

    const custUpdateReq = createReq('http://localhost:3000/api/customers', 'PUT', {
      id: custInDb.id,
      address: '456 Brigade Road, Bengaluru',
    });
    const custUpdateRes = await customersRoute.PUT(custUpdateReq);
    const custUpdateData = await custUpdateRes.json();
    assert(custUpdateRes.status === 200 && custUpdateData.customer?.address === '456 Brigade Road, Bengaluru', 'Customer address updated');

    const custDeleteReq = createReq(`http://localhost:3000/api/customers?id=${custInDb.id}&permanent=true`, 'DELETE');
    const custDeleteRes = await customersRoute.DELETE(custDeleteReq);
    const custDeleteData = await custDeleteRes.json();
    assert(custDeleteData.success && custDeleteData.mode === 'deleted', 'Customer permanently deleted');

    // ------------------------------------------------------------------------
    // 6. EXPENSES CRUD
    // ------------------------------------------------------------------------
    console.log('\n--- 6. Expenses CRUD ---');
    const expCreateReq = createReq('http://localhost:3000/api/expenses', 'POST', {
      category: 'Utilities',
      amount: 1500,
      storeCode: 'CENTRAL',
      description: 'Audit Test Electricity Bill',
      paymentMethod: 'UPI',
    });
    const expCreateRes = await expensesRoute.POST(expCreateReq);
    const expCreateData = await expCreateRes.json();
    assert(expCreateRes.status === 201 && expCreateData.success, 'Expense created');

    const expUpdateReq = createReq('http://localhost:3000/api/expenses', 'PUT', {
      id: expCreateData.expense.id,
      amount: 1750,
    });
    const expUpdateRes = await expensesRoute.PUT(expUpdateReq);
    const expUpdateData = await expUpdateRes.json();
    assert(expUpdateRes.status === 200 && expUpdateData.expense?.amount === 1750, 'Expense updated');

    const expDeleteReq = createReq(`http://localhost:3000/api/expenses?id=${expCreateData.expense.id}`, 'DELETE');
    const expDeleteRes = await expensesRoute.DELETE(expDeleteReq);
    const expDeleteData = await expDeleteRes.json();
    assert(expDeleteData.success, 'Expense deleted from MySQL');

    // ------------------------------------------------------------------------
    // 7. STORES CRUD
    // ------------------------------------------------------------------------
    console.log('\n--- 7. Stores CRUD ---');
    const stCode = `ST-${Date.now().toString().slice(-4)}`;
    const stCreateReq = createReq('http://localhost:3000/api/stores', 'POST', {
      code: stCode,
      name: `Audit Store ${stCode}`,
      city: 'Mysuru',
      address: 'Test Store Address',
    });
    const stCreateRes = await storesRoute.POST(stCreateReq);
    const stCreateData = await stCreateRes.json();
    assert(stCreateRes.status === 201 && stCreateData.success, 'Store created');

    const stUpdateReq = createReq('http://localhost:3000/api/stores', 'PUT', {
      code: stCode,
      name: `Updated Audit Store ${stCode}`,
      city: 'Mysuru',
    });
    const stUpdateRes = await storesRoute.PUT(stUpdateReq);
    const stUpdateData = await stUpdateRes.json();
    assert(stUpdateRes.status === 201 && stUpdateData.store?.name.includes('Updated'), 'Store updated');

    const stDeleteReq = createReq(`http://localhost:3000/api/stores?id=${stCode}&permanent=true`, 'DELETE');
    const stDeleteRes = await storesRoute.DELETE(stDeleteReq);
    const stDeleteData = await stDeleteRes.json();
    assert(stDeleteData.success && stDeleteData.mode === 'deleted', 'Store permanently deleted');

    // ------------------------------------------------------------------------
    // 8. USERS CRUD
    // ------------------------------------------------------------------------
    console.log('\n--- 8. Users Module CRUD ---');
    const testEmail = `audit.user.${Date.now()}@cosko.com`;
    const uCreateReq = createReq('http://localhost:3000/api/users', 'POST', {
      name: 'Audit Test User',
      email: testEmail,
      password: 'AuditPassword2026@',
      role: 'Store Manager',
      store: 'CENTRAL',
    });
    const uCreateRes = await usersRoute.POST(uCreateReq);
    const uCreateData = await uCreateRes.json();
    assert(uCreateRes.status === 201 && uCreateData.success, 'User account provisioned in MySQL');

    const uUpdateReq = createReq('http://localhost:3000/api/users', 'PUT', {
      id: uCreateData.userId,
      name: 'Updated Audit User',
    });
    const uUpdateRes = await usersRoute.PUT(uUpdateReq);
    const uUpdateData = await uUpdateRes.json();
    assert(uUpdateRes.status === 200 && uUpdateData.success, 'User updated in MySQL');

    const uDeleteReq = createReq(`http://localhost:3000/api/users?id=${uCreateData.userId}&permanent=true`, 'DELETE');
    const uDeleteRes = await usersRoute.DELETE(uDeleteReq);
    const uDeleteData = await uDeleteRes.json();
    assert(uDeleteData.success && uDeleteData.mode === 'deleted', 'User permanently deleted from MySQL');

    // ------------------------------------------------------------------------
    // SUMMARY
    // ------------------------------------------------------------------------
    console.log('\n========================================================================');
    console.log(`🏁 CRUD VERIFICATION COMPLETE: ${passed} / ${total} TESTS PASSED`);
    console.log('========================================================================\n');

    if (passed === total) {
      console.log('🎉 ALL CRUD ACTIONS VERIFIED END-TO-END IN ROOT MYSQL ARCHITECTURE!');
      process.exit(0);
    } else {
      console.error(`⚠️ ${total - passed} test(s) failed.`);
      process.exit(1);
    }
  } catch (error: any) {
    console.error('Fatal error during CRUD verification suite:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runFullCrudSuite();
