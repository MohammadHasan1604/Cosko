import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { prisma } from '../src/lib/db';
import { signSessionToken, hashToken } from '../src/lib/auth';

// Import route handlers
import { GET as vendorsGET, POST as vendorsPOST, PUT as vendorsPUT, DELETE as vendorsDELETE } from '../src/app/api/vendors/route';
import { GET as storeStockGET } from '../src/app/api/inventory/store-stock/route';
import { GET as expensesGET } from '../src/app/api/expenses/route';
import { GET as accountingGET } from '../src/app/api/accounting/route';
import { GET as usersGET } from '../src/app/api/users/route';

interface TestUser {
  id: string;
  name: string;
  email: string;
  role: 'Super Admin' | 'Store Manager' | 'Sales Manager';
  store: string;
  token: string;
  sessionId: string;
}

let passed = 0;
let failed = 0;
const errors: string[] = [];

function assert(description: string, condition: boolean, detail?: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${description}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${description}${detail ? ` — ${detail}` : ''}`);
    errors.push(`${description}${detail ? ` (${detail})` : ''}`);
    failed++;
  }
}

async function createAuthenticatedSession(user: { id: string; name: string; email: string; role: any; storeScope: string }): Promise<{ token: string; sessionId: string }> {
  const sessionId = `test_sess_${crypto.randomUUID()}`;
  const dummyToken = `token_${crypto.randomUUID()}_${Date.now()}`;
  const tokenHash = hashToken(dummyToken);

  // Create DB session
  await prisma.userSession.create({
    data: {
      id: sessionId,
      userId: user.id,
      tokenHash,
      userAgent: 'CoskoSecurityIntegrationTest/1.0',
      ipAddress: '127.0.0.1',
      expiresAt: new Date(Date.now() + 3600 * 1000),
    },
  });

  // Sign JWT with sid
  const sessionUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    securityLevel: user.role === 'Super Admin' ? 100 : user.role === 'Store Manager' ? 80 : 40,
    store: user.storeScope,
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=120&auto=format&fit=crop&q=80',
    sessionId,
  };

  const token = signSessionToken(sessionUser, sessionId);
  const finalHash = hashToken(token);

  // Update tokenHash to match signed JWT
  await prisma.userSession.update({
    where: { id: sessionId },
    data: { tokenHash: finalHash },
  });

  return { token, sessionId };
}

function makeRequest(url: string, method: string, token: string, body?: any): NextRequest {
  const headers = new Headers();
  headers.set('authorization', `Bearer ${token}`);
  if (body) {
    headers.set('content-type', 'application/json');
  }

  return new NextRequest(new URL(url, 'http://localhost:3000'), {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
}

async function main() {
  console.log('====================================================================');
  console.log('PHASE 1 SECURITY INTEGRATION TEST MATRIX (REQUIREMENT N)');
  console.log('Testing direct backend APIs across roles and store boundaries');
  console.log('====================================================================\n');

  // 1. Setup test users and sessions
  console.log('📌 1. Resolving test accounts & provisioning sessions...');

  const superAdminUser = await prisma.userAccount.findFirst({ where: { role: 'Super Admin' } });
  if (!superAdminUser) throw new Error('Missing Super Admin account');

  const blrStoreManagerUser = await prisma.userAccount.findFirst({ where: { role: 'Store Manager', storeScope: 'BLR' } });
  if (!blrStoreManagerUser) throw new Error('Missing BLR Store Manager account');

  const blrSalesManagerUser = await prisma.userAccount.findFirst({ where: { role: 'Sales Manager', storeScope: 'BLR' } });
  if (!blrSalesManagerUser) throw new Error('Missing BLR Sales Manager account');

  let cheStoreManagerUser = await prisma.userAccount.findFirst({ where: { role: 'Store Manager', storeScope: 'CHE' } });
  if (!cheStoreManagerUser) throw new Error('Missing CHE Store Manager account');

  let cheSalesManagerUser = await prisma.userAccount.findFirst({ where: { role: 'Sales Manager', storeScope: 'CHE' } });
  if (!cheSalesManagerUser) {
    // Create CHE Sales Manager for full 5-user matrix
    cheSalesManagerUser = await prisma.userAccount.create({
      data: {
        id: `che_sales_${Date.now()}`,
        name: 'Dinesh Kumar',
        email: `dinesh.che.test_${Date.now()}@cosko.com`,
        passwordHash: '$2a$12$eX.dummyPasswordHashForTestRunner12345678901234567890',
        role: 'Sales Manager',
        storeScope: 'CHE',
        status: 'Active',
      },
    });
    await prisma.userStoreAssignment.create({
      data: {
        userId: cheSalesManagerUser.id,
        storeCode: 'CHE',
      },
    });
    console.log('   Created temporary CHE Sales Manager for test matrix');
  }

  const superAdminSession = await createAuthenticatedSession(superAdminUser);
  const blrManagerSession = await createAuthenticatedSession(blrStoreManagerUser);
  const blrSalesSession = await createAuthenticatedSession(blrSalesManagerUser);
  const cheManagerSession = await createAuthenticatedSession(cheStoreManagerUser);
  const cheSalesSession = await createAuthenticatedSession(cheSalesManagerUser);

  const sessionsToClean = [
    superAdminSession.sessionId,
    blrManagerSession.sessionId,
    blrSalesSession.sessionId,
    cheManagerSession.sessionId,
    cheSalesSession.sessionId,
  ];

  // 2. Ensure CENTRAL vendor Samsung exists
  const centralVendor = await prisma.vendor.findFirst({ where: { storeCode: 'CENTRAL', status: 'Active' } });
  assert('CENTRAL vendor exists in database', !!centralVendor, centralVendor ? `ID: ${centralVendor.id} (${centralVendor.name})` : 'No CENTRAL vendor');
  const centralVendorId = centralVendor?.id || 'non_existent_central';

  console.log('\n🔒 2. Testing Vendor Store Isolation (Requirement E & H)...');

  // Test: BLR manager cannot GET CENTRAL vendor
  const blrGetVendorsReq = makeRequest('/api/vendors', 'GET', blrManagerSession.token);
  const blrGetVendorsRes = await vendorsGET(blrGetVendorsReq);
  const blrGetVendorsData = await blrGetVendorsRes.json();
  const blrVendorsList = blrGetVendorsData.vendors || [];
  const centralInBlr = blrVendorsList.some((v: any) => v.storeCode === 'CENTRAL' || v.id === centralVendorId);
  assert(
    'BLR Store Manager cannot GET CENTRAL vendor',
    !centralInBlr && blrGetVendorsRes.status === 200,
    `Status ${blrGetVendorsRes.status}, returned ${blrVendorsList.length} vendors, contains CENTRAL: ${centralInBlr}`
  );

  // Test: Super Admin can GET all vendors including CENTRAL vendor
  const saGetVendorsReq = makeRequest('/api/vendors', 'GET', superAdminSession.token);
  const saGetVendorsRes = await vendorsGET(saGetVendorsReq);
  const saGetVendorsData = await saGetVendorsRes.json();
  const saVendorsList = saGetVendorsData.vendors || [];
  const centralInSa = saVendorsList.some((v: any) => v.id === centralVendorId);
  assert(
    'Super Admin can GET CENTRAL vendor',
    centralInSa && saGetVendorsRes.status === 200,
    `Status ${saGetVendorsRes.status}, returned ${saVendorsList.length} vendors, contains CENTRAL: ${centralInSa}`
  );

  // Test: BLR Sales Manager cannot access vendors API (403)
  const salesGetVendorsReq = makeRequest('/api/vendors', 'GET', blrSalesSession.token);
  const salesGetVendorsRes = await vendorsGET(salesGetVendorsReq);
  assert(
    'BLR Sales Manager denied access to vendors API (403 Forbidden)',
    salesGetVendorsRes.status === 403,
    `Status was ${salesGetVendorsRes.status}`
  );

  // Test: BLR manager cannot PUT CENTRAL vendor
  const blrPutVendorReq = makeRequest('/api/vendors', 'PUT', blrManagerSession.token, {
    id: centralVendorId,
    name: 'Tampered Samsung Name',
    category: 'Hardware',
  });
  const blrPutVendorRes = await vendorsPUT(blrPutVendorReq);
  assert(
    'BLR Store Manager cannot PUT CENTRAL vendor (403 Forbidden)',
    blrPutVendorRes.status === 403,
    `Status was ${blrPutVendorRes.status}`
  );

  // Test: BLR manager cannot DELETE CENTRAL vendor
  const blrDelVendorReq = makeRequest(`/api/vendors?id=${centralVendorId}`, 'DELETE', blrManagerSession.token);
  const blrDelVendorRes = await vendorsDELETE(blrDelVendorReq);
  assert(
    'BLR Store Manager cannot DELETE CENTRAL vendor (403 Forbidden)',
    blrDelVendorRes.status === 403,
    `Status was ${blrDelVendorRes.status}`
  );

  // Test: CHE manager cannot PUT/DELETE CENTRAL vendor
  const chePutVendorReq = makeRequest('/api/vendors', 'PUT', cheManagerSession.token, {
    id: centralVendorId,
    name: 'CHE Tampered Samsung',
  });
  const chePutVendorRes = await vendorsPUT(chePutVendorReq);
  assert(
    'CHE Store Manager cannot PUT CENTRAL vendor (403 Forbidden)',
    chePutVendorRes.status === 403,
    `Status was ${chePutVendorRes.status}`
  );

  // Test: BLR manager cannot forge store=CENTRAL when creating vendor
  const blrCreateVendorReq = makeRequest('/api/vendors', 'POST', blrManagerSession.token, {
    name: `Test Vendor Forged Central ${Date.now()}`,
    category: 'Electronics',
    phone: '9988776655',
    email: 'testforged@cosko.in',
    storeCode: 'CENTRAL', // Forged payload!
  });
  const blrCreateVendorRes = await vendorsPOST(blrCreateVendorReq);
  const blrCreateVendorData = await blrCreateVendorRes.json();
  const createdVendor = blrCreateVendorData.vendor;
  assert(
    'Server forces storeCode to BLR when Store Manager attempts to forge store=CENTRAL on POST',
    blrCreateVendorRes.status === 201 && createdVendor.storeCode === 'BLR',
    `Created with storeCode: ${createdVendor?.storeCode}`
  );

  if (createdVendor?.id) {
    await prisma.vendor.delete({ where: { id: createdVendor.id } }).catch(() => {});
  }

  console.log('\n🔒 3. Testing Store Stock & Cross-Store Inventory Protection (Requirement D)...');

  // Fetch a real product from DB for authentic 200 OK verification on store-stock
  const realProduct = await prisma.product.findFirst();
  const targetSku = realProduct?.sku || 'TEST-SKU';

  // Test: BLR Store Manager cannot request cross-store store-stock
  const blrStockReq = makeRequest(`/api/inventory/store-stock?sku=${targetSku}`, 'GET', blrManagerSession.token);
  const blrStockRes = await storeStockGET(blrStockReq);
  assert(
    'BLR Store Manager denied cross-store inventory access (403 Forbidden)',
    blrStockRes.status === 403,
    `Status was ${blrStockRes.status}`
  );

  // Test: BLR Sales Manager cannot request cross-store store-stock
  const salesStockReq = makeRequest(`/api/inventory/store-stock?sku=${targetSku}`, 'GET', blrSalesSession.token);
  const salesStockRes = await storeStockGET(salesStockReq);
  assert(
    'BLR Sales Manager denied cross-store inventory access (403 Forbidden)',
    salesStockRes.status === 403,
    `Status was ${salesStockRes.status}`
  );

  // Test: Super Admin CAN request cross-store store-stock
  const saStockReq = makeRequest(`/api/inventory/store-stock?sku=${targetSku}`, 'GET', superAdminSession.token);
  const saStockRes = await storeStockGET(saStockReq);
  assert(
    'Super Admin can access store-stock endpoint (200 OK)',
    saStockRes.status === 200,
    `Status was ${saStockRes.status}`
  );

  console.log('\n🔒 4. Testing Financial & Management Access Control (Requirement B)...');

  // Test: BLR Sales Manager cannot access expenses API
  const salesExpReq = makeRequest('/api/expenses', 'GET', blrSalesSession.token);
  const salesExpRes = await expensesGET(salesExpReq);
  assert(
    'BLR Sales Manager denied access to expenses API (403 Forbidden)',
    salesExpRes.status === 403,
    `Status was ${salesExpRes.status}`
  );

  // Test: BLR Store Manager can access own store expenses
  const blrExpReq = makeRequest('/api/expenses', 'GET', blrManagerSession.token);
  const blrExpRes = await expensesGET(blrExpReq);
  assert(
    'BLR Store Manager permitted to access expenses API (200 OK)',
    blrExpRes.status === 200,
    `Status was ${blrExpRes.status}`
  );

  // Test: BLR Sales Manager cannot access accounting API
  const salesAccReq = makeRequest('/api/accounting', 'GET', blrSalesSession.token);
  const salesAccRes = await accountingGET(salesAccReq);
  assert(
    'BLR Sales Manager denied access to accounting API (403 Forbidden)',
    salesAccRes.status === 403,
    `Status was ${salesAccRes.status}`
  );

  // Test: BLR Store Manager can access own store accounting
  const blrAccReq = makeRequest('/api/accounting', 'GET', blrManagerSession.token);
  const blrAccRes = await accountingGET(blrAccReq);
  assert(
    'BLR Store Manager permitted to access accounting API (200 OK)',
    blrAccRes.status === 200,
    `Status was ${blrAccRes.status}`
  );

  console.log('\n🔒 5. Testing Users Management Scoping (Requirement L)...');

  // Test: BLR Sales Manager cannot access users API
  const salesUsersReq = makeRequest('/api/users', 'GET', blrSalesSession.token);
  const salesUsersRes = await usersGET(salesUsersReq);
  assert(
    'BLR Sales Manager denied access to users API (403 Forbidden)',
    salesUsersRes.status === 403,
    `Status was ${salesUsersRes.status}`
  );

  // Test: BLR Store Manager sees only Sales Manager accounts of BLR
  const blrUsersReq = makeRequest('/api/users', 'GET', blrManagerSession.token);
  const blrUsersRes = await usersGET(blrUsersReq);
  const blrUsersData = await blrUsersRes.json();
  const returnedUsers = blrUsersData.users || [];
  const containsSuperAdmin = returnedUsers.some((u: any) => u.role === 'Super Admin');
  const containsCheManager = returnedUsers.some((u: any) => u.storeScope === 'CHE' || (u.allowedStores && u.allowedStores.includes('CHE')));
  const allAreSalesManagers = returnedUsers.every((u: any) => u.role === 'Sales Manager');
  const allAreBlr = returnedUsers.every((u: any) => u.storeScope === 'BLR' || (u.allowedStores && u.allowedStores.includes('BLR')));

  assert(
    'BLR Store Manager on /api/users does NOT see Super Admin',
    !containsSuperAdmin,
    `Returned ${returnedUsers.length} users, Super Admin present: ${containsSuperAdmin}`
  );
  assert(
    'BLR Store Manager on /api/users does NOT see CHE accounts',
    !containsCheManager,
    `Returned ${returnedUsers.length} users, CHE present: ${containsCheManager}`
  );
  assert(
    'BLR Store Manager on /api/users sees only Sales Managers of BLR',
    allAreSalesManagers && allAreBlr && returnedUsers.length > 0,
    `Count: ${returnedUsers.length}, allSalesManagers: ${allAreSalesManagers}, allBlr: ${allAreBlr}`
  );

  // Test: Super Admin sees all users across all roles and stores
  const saUsersReq = makeRequest('/api/users', 'GET', superAdminSession.token);
  const saUsersRes = await usersGET(saUsersReq);
  const saUsersData = await saUsersRes.json();
  const saUsersList = saUsersData.users || [];
  const saHasSuperAdmin = saUsersList.some((u: any) => u.role === 'Super Admin');
  const saHasBlr = saUsersList.some((u: any) => u.storeScope === 'BLR' || u.store === 'BLR' || (u.allowedStores && u.allowedStores.includes('BLR')));
  const saHasChe = saUsersList.some((u: any) => u.storeScope === 'CHE' || u.store === 'CHE' || (u.allowedStores && u.allowedStores.includes('CHE')));

  assert(
    'Super Admin sees all users across all roles and stores',
    saHasSuperAdmin && saHasBlr && saHasChe && saUsersRes.status === 200,
    `Total users: ${saUsersList.length}, saHasSuperAdmin: ${saHasSuperAdmin}, saHasBlr: ${saHasBlr}, saHasChe: ${saHasChe}`
  );

  // Clean up test sessions
  console.log('\n🧹 Cleaning up test sessions and temporary test records...');
  await prisma.userSession.deleteMany({
    where: { id: { in: sessionsToClean } },
  });

  console.log('\n' + '═'.repeat(60));
  console.log(`📊 PHASE 1 SECURITY TEST MATRIX RESULTS: ${passed} PASSED, ${failed} FAILED`);
  if (failed > 0) {
    console.log('\n❌ Failed tests:');
    errors.forEach((e) => console.log(`   • ${e}`));
  }
  console.log('═'.repeat(60) + '\n');

  if (failed > 0) {
    process.exit(1);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error('Test matrix execution fatal error:', err);
  process.exit(1);
}).finally(() => prisma.$disconnect());
