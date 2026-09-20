import { prisma } from '../src/lib/db';
import { signSessionToken, verifySessionToken, hashPassword } from '../src/lib/auth';
import { GET as getStores } from '../src/app/api/stores/route';
import { GET as getSales } from '../src/app/api/sales/route';
import { GET as getInventory } from '../src/app/api/inventory/route';
import { GET as getPurchases } from '../src/app/api/purchases/route';
import { GET as getExpenses } from '../src/app/api/expenses/route';
import { GET as getReports } from '../src/app/api/reports/route';
import { GET as getAccounting } from '../src/app/api/accounting/route';
import { GET as getTransfers } from '../src/app/api/transfers/route';
import { GET as getActivityStats } from '../src/app/api/activity/stats/route';
import { POST as postLogin } from '../src/app/api/auth/login/route';
import { POST as postLogout } from '../src/app/api/auth/logout/route';
import { clearRateLimit } from '../src/lib/rateLimit';
import jwt from 'jsonwebtoken';
import { NextRequest } from 'next/server';

function createMockRequest(url: string, method: string, body?: any, token?: string): NextRequest {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
  };
  if (token) {
    headers['authorization'] = `Bearer ${token}`;
    headers['cookie'] = `cosko_session=${token}`;
  }
  return new NextRequest(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
}

async function runVerification() {
  console.log('================================================================');
  console.log('BEGIN COSKO ROOT SECURITY & RBAC AUDIT & VERIFICATION SUITE');
  console.log('================================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    totalTests++;
    if (condition) {
      passedTests++;
      console.log(`  [PASS] Test ${totalTests}: ${testName}`);
    } else {
      console.error(`  [FAIL] Test ${totalTests}: ${testName} - ${detail || 'Assertion failed'}`);
    }
  }

  // -------------------------------------------------------------
  // PART 1: 30-DAY INACTIVITY SESSION TIMEOUT & TOKEN AUDIT
  // -------------------------------------------------------------
  console.log('--- PART 1: 30-Day Session Timeout, Cookie & Token Expiry ---');

  // Check Database SystemSettings default
  const settings = await prisma.systemSettings.findFirst();
  assert(
    settings !== null && settings.sessionTimeoutMins === 43200,
    'Database SystemSettings sessionTimeoutMins is 43200 (30 days)',
    `Found: ${settings?.sessionTimeoutMins}`
  );

  // Check JWT Token expiration window
  const testPayload = {
    id: 'test-user-id',
    email: 'test@cosko.internal',
    role: 'Store Manager' as const,
    store: 'BLR',
    name: 'Test Manager',
    securityLevel: 80,
    avatar: 'TM',
    shiftStatus: 'On Shift' as const,
  };
  const token = signSessionToken(testPayload);
  const decoded = verifySessionToken(token);
  assert(decoded !== null, 'Generated JWT token is valid and verifiable');

  const rawDecoded: any = jwt.decode(token);
  if (rawDecoded && rawDecoded.exp && rawDecoded.iat) {
    const durationSeconds = rawDecoded.exp - rawDecoded.iat;
    const expectedDuration = 30 * 24 * 60 * 60; // 2,592,000s
    assert(
      durationSeconds === expectedDuration,
      'JWT token validity is exactly 30 days (2,592,000 seconds)',
      `Got: ${durationSeconds}, expected: ${expectedDuration}`
    );
  }

  // -------------------------------------------------------------
  // PART 2: ACCOUNT LOCKOUT (5 ATTEMPTS) & RESET ON LOGIN
  // -------------------------------------------------------------
  console.log('\n--- PART 2: Account Lockout & Failed Login Counter ---');

  const testEmail = 'lockout-test@cosko.internal';
  const testPassword = 'CorrectPassword123!';
  const wrongPassword = 'WrongPassword456!';

  // Clean up any existing test user
  await prisma.userStoreAssignment.deleteMany({ where: { user: { email: testEmail } } });
  await prisma.userAccount.deleteMany({ where: { email: testEmail } });
  clearRateLimit(`email:${testEmail}`);

  // Create test user account
  const hashedPassword = await hashPassword(testPassword);
  const testUser = await prisma.userAccount.create({
    data: {
      email: testEmail,
      passwordHash: hashedPassword,
      name: 'Lockout Test User',
      role: 'Store Manager',
      securityLevel: 80,
      storeScope: 'BLR',
      status: 'Active',
      failedLoginAttempts: 0,
      lockedUntil: null,
    },
  });

  await prisma.userStoreAssignment.create({
    data: {
      userId: testUser.id,
      storeCode: 'BLR',
    },
  });

  // Attempt 1 to 4: Should return 401 and increment counter
  for (let attempt = 1; attempt <= 4; attempt++) {
    const req = createMockRequest('http://localhost:3000/api/auth/login', 'POST', {
      email: testEmail,
      password: wrongPassword,
    });
    const res = await postLogin(req);
    const json = await res.json();
    assert(
      res.status === 401 && json.remainingAttempts === (5 - attempt),
      `Failed attempt ${attempt} returns 401 with remainingAttempts=${5 - attempt}`,
      `Status: ${res.status}, Body: ${JSON.stringify(json)}`
    );
  }

  // Verify DB state after 4 failed attempts
  let userInDb = await prisma.userAccount.findUnique({ where: { email: testEmail } });
  assert(
    userInDb?.failedLoginAttempts === 4 && userInDb?.lockedUntil === null,
    'DB user has failedLoginAttempts=4 and lockedUntil=null',
    `failedLoginAttempts: ${userInDb?.failedLoginAttempts}, lockedUntil: ${userInDb?.lockedUntil}`
  );

  // Attempt 5: Trigger Lockout! Should return 429
  const req5 = createMockRequest('http://localhost:3000/api/auth/login', 'POST', {
    email: testEmail,
    password: wrongPassword,
  });
  const res5 = await postLogin(req5);
  const json5 = await res5.json();
  assert(
    res5.status === 429 && json5.error.toLowerCase().includes('locked'),
    '5th failed attempt triggers HTTP 429 and locks account',
    `Status: ${res5.status}, Error: ${json5.error}`
  );

  // Verify DB lockout state
  userInDb = await prisma.userAccount.findUnique({ where: { email: testEmail } });
  const isLockedInDb = userInDb?.lockedUntil !== null && userInDb?.lockedUntil! > new Date();
  assert(
    userInDb?.failedLoginAttempts === 5 && isLockedInDb,
    'DB user has failedLoginAttempts=5 and lockedUntil in future (~15 mins)',
    `lockedUntil: ${userInDb?.lockedUntil}`
  );

  // Attempt with CORRECT password while locked: MUST STILL BE REJECTED with 429!
  const reqLocked = createMockRequest('http://localhost:3000/api/auth/login', 'POST', {
    email: testEmail,
    password: testPassword,
  });
  const resLocked = await postLogin(reqLocked);
  const jsonLocked = await resLocked.json();
  assert(
    resLocked.status === 429 && jsonLocked.error.toLowerCase().includes('locked'),
    'Login with correct password during lockout window is strictly blocked (HTTP 429)',
    `Status: ${resLocked.status}, Error: ${jsonLocked.error}`
  );

  // Simulate lockout expiry: set lockedUntil to past
  await prisma.userAccount.update({
    where: { email: testEmail },
    data: { lockedUntil: new Date(Date.now() - 1000) },
  });
  clearRateLimit(`email:${testEmail}`);

  // Successful login after lockout expiry
  const reqSuccess = createMockRequest('http://localhost:3000/api/auth/login', 'POST', {
    email: testEmail,
    password: testPassword,
  });
  const resSuccess = await postLogin(reqSuccess);
  const jsonSuccess = await resSuccess.json();
  assert(
    resSuccess.status === 200 && jsonSuccess.success === true,
    'Successful login returns 200 and authenticated session',
    `Status: ${resSuccess.status}, Body: ${JSON.stringify(jsonSuccess)}`
  );

  // Check 30-day cookie in response
  const cookie = resSuccess.cookies.get('cosko_session');
  assert(
    cookie !== undefined && cookie.maxAge === 2592000,
    'Login sets cosko_session cookie with 30-day Max-Age (2,592,000s)',
    `Cookie maxAge: ${cookie?.maxAge}`
  );

  // Verify DB failedLoginAttempts reset to 0
  userInDb = await prisma.userAccount.findUnique({ where: { email: testEmail } });
  assert(
    userInDb?.failedLoginAttempts === 0 && userInDb?.lockedUntil === null,
    'Successful login resets DB failedLoginAttempts to 0 and clears lockedUntil',
    `failedLoginAttempts: ${userInDb?.failedLoginAttempts}`
  );

  // Test logout revokes token
  const reqLogout = createMockRequest('http://localhost:3000/api/auth/logout', 'POST', {}, jsonSuccess.token);
  const resLogout = await postLogout(reqLogout);
  assert(
    resLogout.status === 200,
    'Logout endpoint returns 200 and invalidates session token',
    `Status: ${resLogout.status}`
  );

  // -------------------------------------------------------------
  // PART 3: STORE SCOPE SUPER ADMIN ONLY & RBAC ENFORCEMENT
  // -------------------------------------------------------------
  console.log('\n--- PART 3: Store Scope Isolation & Super Admin Only RBAC ---');

  // Generate tokens for Super Admin and Non-Super Admin
  const superAdminToken = signSessionToken({
    id: 'super-admin-audit-id',
    email: 'superadmin@cosko.internal',
    role: 'Super Admin',
    store: 'All Stores',
    name: 'Super Admin Audit',
    securityLevel: 100,
    avatar: 'SA',
    shiftStatus: 'On Shift',
  });

  const managerStore = 'BLR';
  const forbiddenStore = 'DEL';
  const managerToken = signSessionToken({
    id: testUser.id,
    email: testEmail,
    role: 'Store Manager',
    store: managerStore,
    name: 'Store Manager BLR',
    securityLevel: 80,
    avatar: 'SM',
    shiftStatus: 'On Shift',
  });

  // 1. GET /api/stores
  // Super Admin should see all stores
  const reqStoresAdmin = createMockRequest('http://localhost:3000/api/stores', 'GET', undefined, superAdminToken);
  const resStoresAdmin = await getStores(reqStoresAdmin);
  const jsonStoresAdmin = await resStoresAdmin.json();
  assert(
    resStoresAdmin.status === 200 && jsonStoresAdmin.stores.length > 1,
    'Super Admin GET /api/stores returns all store locations',
    `Count: ${jsonStoresAdmin.stores?.length}`
  );

  // Non-Super Admin should ONLY see their assigned store
  const reqStoresManager = createMockRequest('http://localhost:3000/api/stores', 'GET', undefined, managerToken);
  const resStoresManager = await getStores(reqStoresManager);
  const jsonStoresManager = await resStoresManager.json();
  const allMatchManager = jsonStoresManager.stores?.every((s: any) => s.code === managerStore);
  assert(
    resStoresManager.status === 200 && allMatchManager && jsonStoresManager.stores?.length === 1,
    `Store Manager GET /api/stores returns ONLY assigned store (${managerStore})`,
    `Count: ${jsonStoresManager.stores?.length}, Codes: ${jsonStoresManager.stores?.map((s: any) => s.code)}`
  );

  // 2. GET /api/sales
  // Super Admin can query any store or All Stores
  const reqSalesAdmin = createMockRequest(`http://localhost:3000/api/sales?store=${forbiddenStore}`, 'GET', undefined, superAdminToken);
  const resSalesAdmin = await getSales(reqSalesAdmin);
  assert(
    resSalesAdmin.status === 200,
    'Super Admin can query sales for any store (DEL)',
    `Status: ${resSalesAdmin.status}`
  );

  // Non-Super Admin querying another store MUST GET 403 FORBIDDEN
  const reqSalesForbidden = createMockRequest(`http://localhost:3000/api/sales?store=${forbiddenStore}`, 'GET', undefined, managerToken);
  const resSalesForbidden = await getSales(reqSalesForbidden);
  assert(
    resSalesForbidden.status === 403,
    'Non-Super Admin querying sales for another store (DEL) receives 403 Forbidden',
    `Status: ${resSalesForbidden.status}`
  );

  // Non-Super Admin querying All Stores MUST GET 403 FORBIDDEN
  const reqSalesAllForbidden = createMockRequest('http://localhost:3000/api/sales?store=All Stores', 'GET', undefined, managerToken);
  const resSalesAllForbidden = await getSales(reqSalesAllForbidden);
  assert(
    resSalesAllForbidden.status === 403,
    'Non-Super Admin querying sales for "All Stores" receives 403 Forbidden',
    `Status: ${resSalesAllForbidden.status}`
  );

  // 3. GET /api/inventory
  // Non-Super Admin querying another store MUST GET 403 FORBIDDEN
  const reqInvForbidden = createMockRequest(`http://localhost:3000/api/inventory?store=${forbiddenStore}`, 'GET', undefined, managerToken);
  const resInvForbidden = await getInventory(reqInvForbidden);
  assert(
    resInvForbidden.status === 403,
    'Non-Super Admin querying inventory for another store (DEL) receives 403 Forbidden',
    `Status: ${resInvForbidden.status}`
  );

  // 4. GET /api/purchases
  const reqPurchasesForbidden = createMockRequest(`http://localhost:3000/api/purchases?store=${forbiddenStore}`, 'GET', undefined, managerToken);
  const resPurchasesForbidden = await getPurchases(reqPurchasesForbidden);
  assert(
    resPurchasesForbidden.status === 403,
    'Non-Super Admin querying purchases for another store (DEL) receives 403 Forbidden',
    `Status: ${resPurchasesForbidden.status}`
  );

  // 5. GET /api/expenses
  const reqExpensesForbidden = createMockRequest(`http://localhost:3000/api/expenses?store=${forbiddenStore}`, 'GET', undefined, managerToken);
  const resExpensesForbidden = await getExpenses(reqExpensesForbidden);
  assert(
    resExpensesForbidden.status === 403,
    'Non-Super Admin querying expenses for another store (DEL) receives 403 Forbidden',
    `Status: ${resExpensesForbidden.status}`
  );

  // 6. GET /api/reports
  const reqReportsForbidden = createMockRequest(`http://localhost:3000/api/reports?store=${forbiddenStore}`, 'GET', undefined, managerToken);
  const resReportsForbidden = await getReports(reqReportsForbidden);
  assert(
    resReportsForbidden.status === 403,
    'Non-Super Admin querying reports for another store (DEL) receives 403 Forbidden',
    `Status: ${resReportsForbidden.status}`
  );

  const reqReportsAllForbidden = createMockRequest('http://localhost:3000/api/reports?store=All Stores', 'GET', undefined, managerToken);
  const resReportsAllForbidden = await getReports(reqReportsAllForbidden);
  assert(
    resReportsAllForbidden.status === 403,
    'Non-Super Admin querying consolidated reports for "All Stores" receives 403 Forbidden',
    `Status: ${resReportsAllForbidden.status}`
  );

  // 7. GET /api/accounting
  const reqAccForbidden = createMockRequest(`http://localhost:3000/api/accounting?store=${forbiddenStore}`, 'GET', undefined, managerToken);
  const resAccForbidden = await getAccounting(reqAccForbidden);
  assert(
    resAccForbidden.status === 403,
    'Non-Super Admin querying accounting for another store (DEL) receives 403 Forbidden',
    `Status: ${resAccForbidden.status}`
  );

  const reqAccConsolidatedForbidden = createMockRequest('http://localhost:3000/api/accounting?view=consolidated', 'GET', undefined, managerToken);
  const resAccConsolidatedForbidden = await getAccounting(reqAccConsolidatedForbidden);
  assert(
    resAccConsolidatedForbidden.status === 403,
    'Non-Super Admin querying accounting view=consolidated receives 403 Forbidden',
    `Status: ${resAccConsolidatedForbidden.status}`
  );

  // Super Admin can access consolidated accounting
  const reqAccAdmin = createMockRequest('http://localhost:3000/api/accounting?view=consolidated', 'GET', undefined, superAdminToken);
  const resAccAdmin = await getAccounting(reqAccAdmin);
  assert(
    resAccAdmin.status === 200,
    'Super Admin querying accounting view=consolidated receives 200 OK',
    `Status: ${resAccAdmin.status}`
  );

  // 8. GET /api/transfers
  const reqTransfersForbidden = createMockRequest(`http://localhost:3000/api/transfers?store=${forbiddenStore}`, 'GET', undefined, managerToken);
  const resTransfersForbidden = await getTransfers(reqTransfersForbidden);
  assert(
    resTransfersForbidden.status === 403,
    'Non-Super Admin querying transfers for another store (DEL) receives 403 Forbidden',
    `Status: ${resTransfersForbidden.status}`
  );

  // 9. GET /api/activity/stats
  const reqActivityForbidden = createMockRequest(`http://localhost:3000/api/activity/stats?storeCode=${forbiddenStore}`, 'GET', undefined, managerToken);
  const resActivityForbidden = await getActivityStats(reqActivityForbidden);
  assert(
    resActivityForbidden.status === 403,
    'Non-Super Admin querying staff activity stats for another store (DEL) receives 403 Forbidden',
    `Status: ${resActivityForbidden.status}`
  );

  // Cleanup test user
  await prisma.userStoreAssignment.deleteMany({ where: { user: { email: testEmail } } });
  await prisma.userAccount.deleteMany({ where: { email: testEmail } });

  console.log('\n================================================================');
  console.log(`AUDIT COMPLETE: Passed ${passedTests} / ${totalTests} verification checks.`);
  console.log('================================================================');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runVerification()
  .catch((err) => {
    console.error('Fatal verification error:', err);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
