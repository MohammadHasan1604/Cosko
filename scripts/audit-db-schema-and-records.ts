import { prisma } from '../src/lib/db';

async function audit() {
  console.log('================================================================');
  console.log('   COSKO DATABASE ROOT-TO-ROOT AUDIT & INTEGRITY VERIFICATION   ');
  console.log('================================================================\n');

  // 1. STORES INSPECTION
  const stores = await prisma.storeHub.findMany();
  const validStoreCodes = new Set(stores.map(s => s.code));
  console.log(`🏬 Stores in DB (${stores.length}):`, stores.map(s => `${s.code} (${s.name}, ${s.status})`));

  // 2. USERS & ROLES AUDIT
  const users = await prisma.userAccount.findMany({
    include: { storeAssignments: true },
  });
  console.log(`\n👥 Users in DB (${users.length}):`);
  const validRoles = new Set(['Super Admin', 'Store Manager', 'Sales Manager']);
  const superAdmins: string[] = [];
  const invalidRoleUsers: any[] = [];

  for (const u of users) {
    console.log(`  - [${u.id.slice(0, 8)}] ${u.email} | Role: "${u.role}" | Level: ${u.securityLevel} | StoreScope: ${u.storeScope} | Status: ${u.status}`);
    if (u.role === 'Super Admin' || u.securityLevel === 100) {
      superAdmins.push(u.email);
    }
    if (!validRoles.has(u.role)) {
      invalidRoleUsers.push(u);
    }
  }

  console.log(`\n👑 Super Admins (Found ${superAdmins.length}):`, superAdmins);
  if (superAdmins.length === 1) {
    console.log('  ✅ Exactly ONE Super Admin exists.');
  } else {
    console.warn(`  ⚠️ Found ${superAdmins.length} Super Admins (Requirement: Exactly ONE).`);
  }

  console.log(`\n🎭 Invalid/Obsolete Roles (Found ${invalidRoleUsers.length}):`);
  if (invalidRoleUsers.length === 0) {
    console.log('  ✅ All users have one of the 3 valid role types.');
  } else {
    for (const iu of invalidRoleUsers) {
      console.warn(`  ⚠️ User ${iu.email} has obsolete role "${iu.role}"!`);
    }
  }

  // 3. PAYMENT METHODS AUDIT
  const paymentMethods = await prisma.paymentMethod.findMany();
  console.log(`\n💳 Payment Methods in DB (${paymentMethods.length}):`);
  for (const pm of paymentMethods) {
    console.log(`  - ${pm.code}: ${pm.name} (${pm.type}, status: ${pm.status})`);
  }

  // 4. ORPHAN ROWS INSPECTION
  console.log('\n🔍 Checking for orphan records across all models...');

  // UserStoreAssignment
  const invalidUserStore = await prisma.userStoreAssignment.findMany({
    where: { storeCode: { notIn: Array.from(validStoreCodes) } },
  });
  console.log(`  - UserStoreAssignment invalid store references: ${invalidUserStore.length}`);

  // Inventory
  const invalidInvStore = await prisma.inventory.findMany({
    where: { storeCode: { notIn: Array.from(validStoreCodes) } },
  });
  console.log(`  - Inventory invalid store references: ${invalidInvStore.length}`);

  // InventoryLedger
  const invalidLedgerStore = await prisma.inventoryLedger.findMany({
    where: { storeCode: { notIn: Array.from(validStoreCodes) } },
  });
  console.log(`  - InventoryLedger invalid store references: ${invalidLedgerStore.length}`);

  // SalesOrder
  const invalidSaleStore = await prisma.salesOrder.findMany({
    where: { storeCode: { notIn: Array.from(validStoreCodes) } },
  });
  console.log(`  - SalesOrder invalid store references: ${invalidSaleStore.length}`);

  // PurchaseOrder
  const invalidPoStore = await prisma.purchaseOrder.findMany({
    where: { storeCode: { notIn: Array.from(validStoreCodes) } },
  });
  console.log(`  - PurchaseOrder invalid store references: ${invalidPoStore.length}`);

  // AttendanceDay
  const invalidAttStore = await prisma.attendanceDay.findMany({
    where: { storeCode: { notIn: Array.from(validStoreCodes) } },
  });
  console.log(`  - AttendanceDay invalid store references: ${invalidAttStore.length}`);

  // 5. INVENTORY RECONCILIATION SNAPSHOT
  console.log('\n📊 Inventory vs Ledger Reconciliation Check:');
  const inventoryItems = await prisma.inventory.findMany();
  let mismatches = 0;
  for (const inv of inventoryItems) {
    const movements = await prisma.inventoryLedger.aggregate({
      where: { productId: inv.productId, storeCode: inv.storeCode },
      _sum: { qtyChange: true },
    });
    const ledgerSum = movements._sum.qtyChange || 0;
    if (inv.qtyOnHand !== ledgerSum) {
      mismatches++;
      console.warn(`  ⚠️ Product ${inv.productId.slice(0, 8)} @ ${inv.storeCode}: Inv Qty = ${inv.qtyOnHand}, Ledger Sum = ${ledgerSum}`);
    }
  }
  if (mismatches === 0) {
    console.log(`  ✅ All ${inventoryItems.length} inventory records match ledger sums perfectly!`);
  } else {
    console.warn(`  ⚠️ Found ${mismatches} inventory vs ledger sum mismatches out of ${inventoryItems.length} records.`);
  }

  console.log('\n================================================================');
  console.log('                      AUDIT COMPLETE                            ');
  console.log('================================================================');
}

audit().catch(console.error).finally(() => prisma.$disconnect());
