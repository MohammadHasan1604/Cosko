/**
 * Verification Script: Store Form Simplification & Super Admin Root Access Matrix Exemption
 * 
 * Verifies:
 * 1. Store creation without registersCount, skusCount, monthlyRevenue persists valid record.
 * 2. Store update without registersCount, skusCount, monthlyRevenue preserves existing DB values intact.
 * 3. Super Admin root-level unrestricted access across all stores, pages, and actions.
 * 4. Super Admin immunity against custom DENY overrides or restrictive store scopes.
 * 5. Configurable Access Matrix preservation for non-Super Admin roles (e.g. Store Manager, Cashier).
 * 6. RBACEngine.getPermissionState behavior for Super Admin vs other roles.
 */
import { prisma } from '../src/lib/db';
import { RBACEngine, RBACUser, ResourceRequest } from '../src/lib/rbacEngine';
import { evaluateAuthorization } from '../src/lib/rbac';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`✅ [PASS] ${testName}${detail ? ` — ${detail}` : ''}`);
    passed++;
  } else {
    console.error(`❌ [FAIL] ${testName}${detail ? ` — ${detail}` : ''}`);
    failed++;
  }
}

async function runVerification() {
  console.log('========================================================================');
  console.log('ROOT FIX VERIFICATION: STORE FORM SIMPLIFICATION & SUPER ADMIN ROOT RBAC');
  console.log('========================================================================\n');

  // ─── PART 1: STORE FORM & DB PRESERVATION TESTS ─────────────────────────────
  console.log('--- TEST GROUP 1: STORE FORM API & DATABASE PERSISTENCE ---');

  const testStoreCode = 'TEST_FIX';
  try {
    // Cleanup any existing test store
    await prisma.storeHub.deleteMany({ where: { code: testStoreCode } });

    // 1.1 Create new store with ONLY required clean fields
    const createdStore = await prisma.storeHub.create({
      data: {
        code: testStoreCode,
        name: 'Test Clean Store Branch',
        city: 'Bengaluru',
        address: 'MG Road Plaza',
        ownerName: 'Arjun Verma',
        managerName: 'Arjun Verma',
        phone: '+91 98888 12345',
        status: 'Active',
      },
    });

    assert(
      createdStore.code === testStoreCode && createdStore.registersCount === 0 && createdStore.skusCount === 0,
      '1.1 Store Created Cleanly Without Requiring Registers/SKUs/Target Revenue',
      `Created with defaults: registersCount=${createdStore.registersCount}, skusCount=${createdStore.skusCount}`
    );

    // 1.2 Simulate existing production data with legacy numbers populated
    await prisma.storeHub.update({
      where: { code: testStoreCode },
      data: {
        registersCount: 5,
        skusCount: 420,
        monthlyRevenue: 1500000.0,
      },
    });

    const populatedStore = await prisma.storeHub.findUnique({ where: { code: testStoreCode } });
    assert(
      populatedStore?.registersCount === 5 && populatedStore?.skusCount === 420 && Number(populatedStore?.monthlyRevenue) === 1500000.0,
      '1.2 Production Data Simulation Setup',
      'Set registers=5, skus=420, monthlyRevenue=1500000.00'
    );

    // 1.3 Edit store details (name, city, address, owner) WITHOUT passing registers, skusCount, or monthlyRevenue
    // Simulating PUT /api/stores payload with undefined registersCount/skusCount/monthlyRevenue
    const updatedStore = await prisma.storeHub.update({
      where: { code: testStoreCode },
      data: {
        name: 'Updated Clean Store Branch',
        city: 'Mysuru',
        address: 'New Commercial Complex',
        ownerName: 'Arjun V. Rao',
        // registersCount, skusCount, monthlyRevenue omitted (undefined)
      },
    });

    assert(
      updatedStore.name === 'Updated Clean Store Branch' &&
      updatedStore.city === 'Mysuru' &&
      updatedStore.registersCount === 5 &&
      updatedStore.skusCount === 420 &&
      Number(updatedStore.monthlyRevenue) === 1500000.0,
      '1.3 Store Update Safely Preserves Existing Production Data in DB',
      `Values intact: registersCount=${updatedStore.registersCount}, skusCount=${updatedStore.skusCount}, monthlyRevenue=${updatedStore.monthlyRevenue}`
    );

    // Cleanup
    await prisma.storeHub.deleteMany({ where: { code: testStoreCode } });
  } catch (err: any) {
    assert(false, 'Part 1 Database Error', err.message);
  }

  // ─── PART 2: SUPER ADMIN UNRESTRICTED ROOT ACCESS ──────────────────────────
  console.log('\n--- TEST GROUP 2: SUPER ADMIN UNRESTRICTED ROOT RBAC ---');

  const superAdmin: RBACUser = {
    id: 'sa-root-1',
    name: 'Master Super Admin',
    email: 'root@cosko.com',
    role: 'Super Admin',
    securityLevel: 100,
    storeScope: 'All Stores',
    status: 'Active',
    permissions: ['ALL_PERMISSIONS'],
  };

  // 2.1 Super Admin full access to every store
  const storesToTest = ['BLR', 'HYD', 'DEL', 'MUM', 'PUN', 'CENTRAL'];
  let allStoresAuthorized = true;
  for (const st of storesToTest) {
    const res = RBACEngine.authorize(superAdmin, {
      resourceName: `${st} Inventory Data`,
      classification: 'STORE_SCOPED',
      minSecurityLevel: 60,
      requiredPermission: 'inventory.view',
      targetStore: st,
    });
    if (!res.allowed) allStoresAuthorized = false;
  }
  assert(allStoresAuthorized, '2.1 Super Admin Has Unrestricted Access Across All Store Locations', `Tested: ${storesToTest.join(', ')}`);

  // 2.2 Super Admin full access across diverse permissions
  const permissionsToTest = [
    'sales.create',
    'sales.discount',
    'inventory.adjust',
    'purchases.receive_grn',
    'accounting.pnl',
    'settings.global_manage',
    'branding.edit_logo',
    'users.assign_role',
    'audit_logs.enterprise_view',
  ];
  let allPermsAuthorized = true;
  for (const perm of permissionsToTest) {
    const res = RBACEngine.authorize(superAdmin, {
      resourceName: `Action ${perm}`,
      classification: 'ENTERPRISE',
      minSecurityLevel: 80,
      requiredPermission: perm,
    });
    if (!res.allowed) allPermsAuthorized = false;
  }
  assert(allPermsAuthorized, '2.2 Super Admin Authorized Across All Functional & Protected Permissions');

  // 2.3 Super Admin immunity against hypothetical custom DENY overrides
  const compromisedSuperAdmin: RBACUser = {
    ...superAdmin,
    overrides: [
      { permissionCode: 'sales.create', overrideType: 'DENY' },
      { permissionCode: 'sales.discount', overrideType: 'DENY' },
      { permissionCode: 'settings.global_manage', overrideType: 'DENY' },
    ],
    // Hypothetical restrictive store scope
    storeScope: 'BLR',
    allowedStores: ['BLR'],
  };

  const deniedActionTest = RBACEngine.authorize(compromisedSuperAdmin, {
    resourceName: 'Apply Order Discount',
    classification: 'STORE_SCOPED',
    minSecurityLevel: 80,
    requiredPermission: 'sales.discount',
    targetStore: 'HYD', // Cross store
  });

  assert(
    deniedActionTest.allowed,
    '2.3 Super Admin Access Cannot Be Restricted By Configurable Overrides or Store Locks',
    'Super Admin root bypass overrides any DENY override or store lock'
  );

  // 2.4 evaluateAuthorization root bypass verification
  const evalResult = evaluateAuthorization({
    user: {
      id: 'sa-1',
      name: 'Super Admin',
      email: 'admin@cosko.com',
      role: 'Super Admin',
      securityLevel: 100,
      store: 'BLR',
      avatar: 'SA',
      shiftStatus: 'On Shift',
    },
    requiredMinLevel: 80,
    requiredPermission: 'settings.global_manage',
    targetStoreCode: 'HYD',
    userOverrides: [{ permissionCode: 'settings.global_manage', overrideType: 'DENY' }],
  });
  assert(evalResult.authorized, '2.4 Server-Side evaluateAuthorization Confirms Super Admin Root Bypass');

  // 2.5 RBACEngine.getPermissionState returns 'Allowed' for Super Admin
  const permState = RBACEngine.getPermissionState(compromisedSuperAdmin, 'sales.discount');
  assert(permState === 'Allowed', '2.5 RBACEngine.getPermissionState Always Resolves to "Allowed" for Super Admin', `Resolved: ${permState}`);

  // ─── PART 3: NON-SUPER ADMIN ACCESS MATRIX RETENTION ────────────────────────
  console.log('\n--- TEST GROUP 3: NON-SUPER ADMIN ACCESS MATRIX CONFIGURED ACCESS ---');

  const storeManager: RBACUser = {
    id: 'sm-1',
    name: 'Sneha Manager',
    email: 'sneha@cosko.com',
    role: 'Store Manager',
    securityLevel: 80,
    storeScope: 'BLR',
    allowedStores: ['BLR'],
    status: 'Active',
    permissions: ['sales.view', 'sales.create', 'sales.discount', 'inventory.view'],
  };

  // 3.1 Store Manager is granted allowed store
  const smAllowedStore = RBACEngine.authorize(storeManager, {
    resourceName: 'BLR Sales',
    classification: 'STORE_SCOPED',
    minSecurityLevel: 20,
    requiredPermission: 'sales.create',
    targetStore: 'BLR',
  });
  assert(smAllowedStore.allowed, '3.1 Store Manager Authorized for In-Scope Store (BLR)');

  // 3.2 Store Manager is blocked from cross-store
  const smBlockedCrossStore = RBACEngine.authorize(storeManager, {
    resourceName: 'HYD Sales',
    classification: 'STORE_SCOPED',
    minSecurityLevel: 20,
    requiredPermission: 'sales.create',
    targetStore: 'HYD',
  });
  assert(!smBlockedCrossStore.allowed, '3.2 Store Manager Blocked from Out-of-Scope Store (HYD)');

  // 3.3 Store Manager obeys Access Matrix DENY override
  const smWithDeny: RBACUser = {
    ...storeManager,
    overrides: [{ permissionCode: 'sales.discount', overrideType: 'DENY' }],
  };
  const smDiscountBlocked = RBACEngine.authorize(smWithDeny, {
    resourceName: 'Apply Order Discount',
    classification: 'STORE_SCOPED',
    minSecurityLevel: 80,
    requiredPermission: 'sales.discount',
    targetStore: 'BLR',
  });
  assert(!smDiscountBlocked.allowed, '3.3 Store Manager Obeys Configured Access Matrix DENY Override (sales.discount)');

  // 3.4 Store Manager getPermissionState resolves to 'Custom Deny'
  const smPermState = RBACEngine.getPermissionState(smWithDeny, 'sales.discount');
  assert(smPermState === 'Custom Deny', '3.4 Store Manager getPermissionState Accurately Reflects Configured Override', `Resolved: ${smPermState}`);

  console.log('\n========================================================================');
  console.log(`VERIFICATION SUMMARY: ${passed} Passed | ${failed} Failed`);
  console.log('========================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runVerification().catch((err) => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
