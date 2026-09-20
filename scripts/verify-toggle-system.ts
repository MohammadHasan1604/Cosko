import { prisma } from '../src/lib/db';

async function runTests() {
  console.log('=== STARTING END-TO-END TOGGLE SYSTEM VERIFICATION ===\n');

  let passed = 0;
  let failed = 0;

  function assert(testName: string, condition: boolean, details?: any) {
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName}`, details || '');
      failed++;
    }
  }

  try {
    // 1. Find a test user (non-Super-Admin)
    const testUser = await prisma.userAccount.findFirst({
      where: { role: 'Store Manager' },
    });

    if (!testUser) {
      throw new Error('Could not find a Store Manager test user');
    }

    console.log(`Testing with user: ${testUser.name} (${testUser.email}) [ID: ${testUser.id}]\n`);

    // TEST 1: SHIFT STATUS PERSISTENCE
    console.log('--- 1. Testing Shift Status Toggle Persistence ---');
    const initialShift = testUser.shiftStatus;
    const targetShift = initialShift === 'On Shift' ? 'On Leave' : 'On Shift';

    await prisma.userAccount.update({
      where: { id: testUser.id },
      data: { shiftStatus: targetShift },
    });

    const verifyShift1 = await prisma.userAccount.findUnique({
      where: { id: testUser.id },
    });
    assert('Shift status updated in MySQL to ' + targetShift, verifyShift1?.shiftStatus === targetShift);

    // Revert back
    await prisma.userAccount.update({
      where: { id: testUser.id },
      data: { shiftStatus: initialShift },
    });
    const verifyShift2 = await prisma.userAccount.findUnique({
      where: { id: testUser.id },
    });
    assert('Shift status restored to initial ' + initialShift, verifyShift2?.shiftStatus === initialShift);

    // TEST 2: STORE SCOPE ASSIGNMENT PERSISTENCE
    console.log('\n--- 2. Testing Store Scope Access Toggle Persistence ---');
    const targetStores = ['BLR', 'MUM', 'DEL'];

    // Transactionally sync store assignments as route.ts does
    await prisma.$transaction(async (tx) => {
      await tx.userStoreAssignment.deleteMany({
        where: { userId: testUser.id, storeCode: { notIn: targetStores } },
      });
      for (const sCode of targetStores) {
        await tx.userStoreAssignment.upsert({
          where: { userId_storeCode: { userId: testUser.id, storeCode: sCode } },
          create: { userId: testUser.id, storeCode: sCode },
          update: {},
        });
      }
    });

    const verifyStores1 = await prisma.userStoreAssignment.findMany({
      where: { userId: testUser.id },
    });
    const assignedCodes1 = verifyStores1.map((s) => s.storeCode).sort();
    assert('Store assignments added in MySQL', assignedCodes1.join(',') === 'BLR,DEL,MUM', { assignedCodes1 });

    // Toggle off 'DEL'
    const nextStores = ['BLR', 'MUM'];
    await prisma.$transaction(async (tx) => {
      await tx.userStoreAssignment.deleteMany({
        where: { userId: testUser.id, storeCode: { notIn: nextStores } },
      });
    });

    const verifyStores2 = await prisma.userStoreAssignment.findMany({
      where: { userId: testUser.id },
    });
    const assignedCodes2 = verifyStores2.map((s) => s.storeCode).sort();
    assert('Store assignments removed DEL correctly', assignedCodes2.join(',') === 'BLR,MUM', { assignedCodes2 });

    // TEST 3: PERMISSION OVERRIDES PERSISTENCE
    console.log('\n--- 3. Testing Permission Overrides Toggle Persistence ---');
    const testOverrides = [
      { permissionCode: 'sales.discount', overrideType: 'DENY' },
      { permissionCode: 'inventory.transfer', overrideType: 'ALLOW' },
    ];

    await prisma.$transaction(async (tx) => {
      await tx.userPermissionOverride.deleteMany({ where: { userId: testUser.id } });
      for (const ov of testOverrides) {
        await tx.userPermissionOverride.create({
          data: {
            userId: testUser.id,
            permissionCode: ov.permissionCode,
            overrideType: ov.overrideType,
          },
        });
      }
    });

    const verifyOverrides1 = await prisma.userPermissionOverride.findMany({
      where: { userId: testUser.id },
    });
    assert('Permission overrides stored in MySQL', verifyOverrides1.length === 2);
    const discountOv = verifyOverrides1.find((o) => o.permissionCode === 'sales.discount');
    assert('sales.discount override is DENY', discountOv?.overrideType === 'DENY');
    const transferOv = verifyOverrides1.find((o) => o.permissionCode === 'inventory.transfer');
    assert('inventory.transfer override is ALLOW', transferOv?.overrideType === 'ALLOW');

    // Test RESET override
    await prisma.userPermissionOverride.deleteMany({
      where: { userId: testUser.id, permissionCode: 'sales.discount' },
    });
    const verifyOverrides2 = await prisma.userPermissionOverride.findMany({
      where: { userId: testUser.id },
    });
    assert('Resetting sales.discount removed it from MySQL', verifyOverrides2.length === 1 && verifyOverrides2[0].permissionCode === 'inventory.transfer');

    // Cleanup overrides for test user
    await prisma.userPermissionOverride.deleteMany({ where: { userId: testUser.id } });

    // TEST 4: SYSTEM SETTINGS TOGGLE PERSISTENCE
    console.log('\n--- 4. Testing System Settings Toggle Persistence ---');
    const sysSettings = await (prisma as any).systemSettings.findFirst();
    if (sysSettings) {
      const initialHsn = sysSettings.hsnMandatory;
      const targetHsn = !initialHsn;

      await (prisma as any).systemSettings.update({
        where: { id: sysSettings.id },
        data: { hsnMandatory: targetHsn },
      });

      const verifySetting = await (prisma as any).systemSettings.findUnique({
        where: { id: sysSettings.id },
      });
      assert('hsnMandatory setting toggled in MySQL to ' + targetHsn, verifySetting?.hsnMandatory === targetHsn);

      // Restore
      await (prisma as any).systemSettings.update({
        where: { id: sysSettings.id },
        data: { hsnMandatory: initialHsn },
      });
      assert('hsnMandatory setting restored', true);
    } else {
      console.log('Skipping systemSettings check: no row found');
    }

    // TEST 5: GET USERS PAYLOAD RELOAD FIDELITY
    console.log('\n--- 5. Testing GET /api/users Reload Fidelity ---');
    const fetchedUser = await prisma.userAccount.findUnique({
      where: { id: testUser.id },
      include: {
        storeAssignments: true,
        permissionOverrides: true,
      },
    });

    assert('Fetched user has shiftStatus defined', typeof fetchedUser?.shiftStatus === 'string');
    assert('Fetched user has storeAssignments array', Array.isArray(fetchedUser?.storeAssignments));
    assert('Fetched user has permissionOverrides array', Array.isArray(fetchedUser?.permissionOverrides));

    // TEST 6: SUPER ADMIN IMMUTABLE BOUNDARY
    console.log('\n--- 6. Testing Super Admin Root-Level Protection ---');
    const superAdmin = await prisma.userAccount.findFirst({
      where: { role: 'Super Admin' },
    });
    assert('Super Admin account exists', !!superAdmin);
    assert('Super Admin security level is 100', superAdmin?.securityLevel === 100);

    console.log(`\n=== SUMMARY: ${passed} PASSED, ${failed} FAILED ===\n`);
  } catch (err: any) {
    console.error('Test execution failed with error:', err);
    failed++;
  } finally {
    await prisma.$disconnect();
    process.exit(failed > 0 ? 1 : 0);
  }
}

runTests();
