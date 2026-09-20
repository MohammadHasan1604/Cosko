import { prisma } from '../src/lib/db';

async function reconcileTeamStoreRBAC() {
  console.log('========================================================================');
  console.log('🛡️  RECONCILING TEAM MEMBER STORE ASSIGNMENTS & SUPER ADMIN SINGLETON');
  console.log('========================================================================\n');

  try {
    // 1. Fetch all store hubs
    const allStores = await prisma.storeHub.findMany({ select: { code: true, name: true } });
    const allStoreCodes = allStores.map((s) => s.code);
    console.log(`Found ${allStores.length} stores in DB: ${allStoreCodes.join(', ')}`);

    // 2. Locate or designate the single protected Super Admin
    let superAdmin = await prisma.userAccount.findFirst({
      where: { role: 'Super Admin' },
      include: { storeAssignments: true },
    });

    if (!superAdmin) {
      // Fallback lookup by email
      superAdmin = await prisma.userAccount.findUnique({
        where: { email: 'cosko@gmail.com' },
        include: { storeAssignments: true },
      });
    }

    if (!superAdmin) {
      console.error('❌ No Super Admin account found to protect! Please check DB.');
      process.exit(1);
    }

    console.log(`\nProtected Super Admin designated: [${superAdmin.id}] ${superAdmin.name} <${superAdmin.email}>`);

    // Ensure Super Admin has Level 100, All Stores scope, and assignments to all store hubs
    await prisma.userAccount.update({
      where: { id: superAdmin.id },
      data: {
        role: 'Super Admin',
        securityLevel: 100,
        storeScope: 'All Stores',
        status: 'Active',
      },
    });

    // Ensure store assignments exist for all stores
    for (const sCode of allStoreCodes) {
      await prisma.userStoreAssignment.upsert({
        where: { userId_storeCode: { userId: superAdmin.id, storeCode: sCode } },
        create: { userId: superAdmin.id, storeCode: sCode },
        update: {},
      });
    }
    console.log('✅ Super Admin singleton updated with Level 100 & All Stores assignments.');

    // 3. Demote any rogue / duplicate Super Admin accounts
    const rogueSuperAdmins = await prisma.userAccount.findMany({
      where: {
        role: 'Super Admin',
        id: { not: superAdmin.id },
      },
    });

    if (rogueSuperAdmins.length > 0) {
      console.log(`⚠️ Found ${rogueSuperAdmins.length} duplicate Super Admin account(s). Demoting to Store Manager...`);
      for (const rogue of rogueSuperAdmins) {
        await prisma.userAccount.update({
          where: { id: rogue.id },
          data: {
            role: 'Store Manager',
            securityLevel: 80,
            storeScope: rogue.storeScope === 'All Stores' ? (allStoreCodes[0] || 'BLR') : rogue.storeScope,
          },
        });
        console.log(`  -> Demoted [${rogue.id}] ${rogue.email} to Store Manager (Level 80)`);
      }
    } else {
      console.log('✅ Verified: Exactly ONE Super Admin account exists in the database.');
    }

    // 4. Reconcile non-Super-Admin store assignments
    const nonSuperAdmins = await prisma.userAccount.findMany({
      where: { id: { not: superAdmin.id } },
      include: { storeAssignments: true },
    });

    console.log(`\nReconciling ${nonSuperAdmins.length} non-Super-Admin team members...`);

    for (const u of nonSuperAdmins) {
      let existingStoreCodes = u.storeAssignments.map((a) => a.storeCode).filter((c) => allStoreCodes.includes(c));

      // If user has invalid storeScope (e.g. 'All Stores'), normalize it
      let effectiveStore = u.storeScope;
      if (!effectiveStore || effectiveStore === 'All Stores' || !allStoreCodes.includes(effectiveStore)) {
        effectiveStore = existingStoreCodes[0] || allStoreCodes.find((c) => c !== 'CENTRAL') || allStoreCodes[0] || 'BLR';
      }

      // Ensure user has at least one assignment
      if (existingStoreCodes.length === 0) {
        existingStoreCodes = [effectiveStore];
        await prisma.userStoreAssignment.create({
          data: { userId: u.id, storeCode: effectiveStore },
        });
      }

      // Update user record if storeScope was changed
      if (u.storeScope !== effectiveStore) {
        await prisma.userAccount.update({
          where: { id: u.id },
          data: { storeScope: effectiveStore },
        });
      }

      console.log(`  ✓ User [${u.name} <${u.email}>] Role: ${u.role} | Assigned Stores: [${existingStoreCodes.join(', ')}] | Primary: ${effectiveStore}`);
    }

    console.log('\n========================================================================');
    console.log('🎉 RECONCILIATION COMPLETE: ALL USERS HAVE CONSISTENT STORE ACCESS');
    console.log('========================================================================\n');
  } catch (error) {
    console.error('❌ Error during reconciliation:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

reconcileTeamStoreRBAC();
