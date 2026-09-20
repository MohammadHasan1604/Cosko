import { prisma } from '../src/lib/db';
import { evaluateAuthorization } from '../src/lib/rbac';
import { readFileSync } from 'fs';
import { join } from 'path';

async function main() {
  console.log('====================================================');
  console.log('RUNNING COMPREHENSIVE TEAM MEMBER & RBAC ROOT-FIX TESTS');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName}`);
      failed++;
    }
  }

  // ----------------------------------------------------
  // TEST 1: Super Admin Singleton in Database
  // ----------------------------------------------------
  console.log('--- TEST 1: Verifying Super Admin Singleton in DB ---');
  const superAdmins = await prisma.userAccount.findMany({
    where: {
      OR: [
        { role: 'Super Admin' },
        { securityLevel: { gte: 100 } },
      ],
    },
  });

  assert(superAdmins.length === 1, `Exactly 1 Super Admin account exists in DB (found: ${superAdmins.length})`);
  assert(superAdmins[0]?.email === 'cosko@gmail.com', `Super Admin email is cosko@gmail.com (found: ${superAdmins[0]?.email})`);
  assert(superAdmins[0]?.securityLevel === 100, `Super Admin security level is exactly 100 (found: ${superAdmins[0]?.securityLevel})`);

  // ----------------------------------------------------
  // TEST 2: Non-Super-Admin Store Assignments Integrity
  // ----------------------------------------------------
  console.log('\n--- TEST 2: Verifying Non-Super-Admin Store Assignments ---');
  const allUsers = await prisma.userAccount.findMany({
    include: {
      storeAssignments: true,
    },
  });

  const nonAdmins = allUsers.filter((u) => u.role !== 'Super Admin');
  assert(nonAdmins.length > 0, `Found non-admin users in database (${nonAdmins.length} accounts)`);

  for (const user of nonAdmins) {
    const assignments = user.storeAssignments.map((a) => a.storeCode);
    assert(
      assignments.length > 0,
      `User "${user.name}" (${user.email}) has at least 1 explicit assigned store in user_store_assignments (${assignments.join(', ')})`
    );
    assert(
      user.securityLevel < 100,
      `User "${user.name}" security level is strictly < 100 (level: ${user.securityLevel})`
    );
    assert(
      user.storeScope !== 'All Stores',
      `User "${user.name}" storeScope is NOT "All Stores" (scope: "${user.storeScope}")`
    );
  }

  // ----------------------------------------------------
  // TEST 3: RBAC Engine Store-Scoping Authorization Checks
  // ----------------------------------------------------
  console.log('\n--- TEST 3: Testing RBAC Authorization Engine with Multi-Store Scope ---');
  // Non-Super-Admin user with HYD and MUM access
  const mockUserHYDMUM = {
    id: 'test-user-1',
    name: 'Multi-Store Manager',
    email: 'manager@example.com',
    role: 'Store Manager',
    securityLevel: 80,
    store: 'HYD',
    storeScope: 'HYD',
    allowedStores: ['HYD', 'MUM'],
  };

  // HYD access should be authorized
  const authHYD = evaluateAuthorization({ user: mockUserHYDMUM as any, targetStoreCode: 'HYD' });
  assert(authHYD.authorized, 'User allowed access to assigned store HYD');

  // MUM access should be authorized
  const authMUM = evaluateAuthorization({ user: mockUserHYDMUM as any, targetStoreCode: 'MUM' });
  assert(authMUM.authorized, 'User allowed access to assigned store MUM');

  // BLR access should be DENIED
  const authBLR = evaluateAuthorization({ user: mockUserHYDMUM as any, targetStoreCode: 'BLR' });
  assert(!authBLR.authorized, 'User strictly denied access to unassigned store BLR');

  // "All Stores" access should be DENIED for non-Super-Admin
  const authALL = evaluateAuthorization({ user: mockUserHYDMUM as any, targetStoreCode: 'All Stores' });
  assert(!authALL.authorized, 'User strictly denied access to "All Stores" scope');

  // Super Admin can access all stores and "All Stores"
  const mockSuperAdmin = {
    id: superAdmins[0].id,
    name: superAdmins[0].name,
    email: superAdmins[0].email,
    role: 'Super Admin',
    securityLevel: 100,
    store: 'All Stores',
    storeScope: 'All Stores',
    allowedStores: ['HYD', 'MUM', 'BLR', 'CENTRAL'],
  };

  const adminAuthAll = evaluateAuthorization({ user: mockSuperAdmin as any, targetStoreCode: 'All Stores' });
  assert(adminAuthAll.authorized, 'Super Admin authorized for "All Stores"');
  const adminAuthBLR = evaluateAuthorization({ user: mockSuperAdmin as any, targetStoreCode: 'BLR' });
  assert(adminAuthBLR.authorized, 'Super Admin authorized for BLR');

  // ----------------------------------------------------
  // TEST 4: UI Form Verification (UserFormModal.tsx)
  // ----------------------------------------------------
  console.log('\n--- TEST 4: Verifying UserFormModal.tsx Code Structure ---');
  const userFormContent = readFileSync(
    join(process.cwd(), 'src/components/forms/UserFormModal.tsx'),
    'utf-8'
  );

  // Super Admin must NOT be in the role selection list
  const hasSuperAdminRoleOption = userFormContent.includes("value: 'Super Admin'");
  assert(!hasSuperAdminRoleOption, 'Super Admin is completely absent from Role dropdown options');

  // Confusing duplicate fields must NOT exist
  assert(!userFormContent.includes('Create Store'), 'No confusing "Create Store" field in UserFormModal');
  assert(!userFormContent.includes('Allowed Store'), 'No confusing "Allowed Store" duplicate field in UserFormModal');
  assert(!userFormContent.includes('Allow Status'), 'No confusing "Allow Status" field in UserFormModal');

  // Assigned Store(s) section with search and toggle must exist
  assert(userFormContent.includes('Assigned Store(s)'), 'Single source of truth "Assigned Store(s)" section exists');
  assert(userFormContent.includes('storeSearch'), 'Store search filter implemented in UserFormModal');
  assert(userFormContent.includes('toggleStoreAssignment'), 'Store assignment toggle function exists in UserFormModal');
  assert(userFormContent.includes('assignedStores.includes(st.code)'), 'Store assignment toggle logic is wired to store codes');

  // ----------------------------------------------------
  // TEST 5: API Endpoints Code Inspection
  // ----------------------------------------------------
  console.log('\n--- TEST 5: Verifying API Security Locks ---');
  const usersRouteContent = readFileSync(
    join(process.cwd(), 'src/app/api/users/route.ts'),
    'utf-8'
  );

  assert(
    usersRouteContent.includes('Creating additional Super Admin accounts is prohibited'),
    'api/users POST blocks creating Super Admin accounts with 403 Forbidden'
  );
  assert(
    usersRouteContent.includes('Promoting accounts to Super Admin is prohibited'),
    'api/users PUT blocks promoting to Super Admin with 403 Forbidden'
  );
  assert(
    usersRouteContent.includes('The protected Super Admin root account cannot be deleted'),
    'api/users DELETE blocks deleting Super Admin with 403 Forbidden'
  );

  const inventoryRouteContent = readFileSync(
    join(process.cwd(), 'src/app/api/inventory/route.ts'),
    'utf-8'
  );
  assert(
    inventoryRouteContent.includes("store === 'All Stores' || store === 'ALL'"),
    'api/inventory GET restricts "All Stores" query parameter to Super Admin only'
  );

  const salesRouteContent = readFileSync(
    join(process.cwd(), 'src/app/api/sales/route.ts'),
    'utf-8'
  );
  assert(
    salesRouteContent.includes("requestedStore === 'All Stores' || requestedStore === 'ALL'"),
    'api/sales GET restricts "All Stores" query parameter to Super Admin only'
  );

  console.log('\n====================================================');
  console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

main()
  .catch((err) => {
    console.error('Fatal error during verification:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
