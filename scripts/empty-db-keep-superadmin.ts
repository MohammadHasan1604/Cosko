import { prisma } from '../src/lib/db';

async function emptyDatabaseKeepSuperAdmin() {
  console.log('===============================================================');
  console.log('🧹 COSKO — ATOMIC DATABASE PURGE (KEEPING SUPER ADMIN & CENTRAL)');
  console.log('===============================================================\n');

  try {
    // 1. Verify Super Admin exists
    const superAdmin = await prisma.userAccount.findFirst({
      where: {
        OR: [
          { role: 'Super Admin' },
          { email: 'cosko@gmail.com' },
          { securityLevel: { gte: 100 } },
        ],
      },
      orderBy: { securityLevel: 'desc' },
    });

    if (!superAdmin) {
      throw new Error('No Super Admin account found to preserve! Aborting purge.');
    }

    console.log(`👤 Preserving Super Admin: ${superAdmin.name} (${superAdmin.email}) [ID: ${superAdmin.id}]`);

    // 2. Perform atomic purge inside transaction
    await prisma.$transaction(async (tx) => {
      console.log('1. Clearing POS sales & line items...');
      await tx.salesOrderItem.deleteMany({});
      await tx.salesOrder.deleteMany({});

      console.log('2. Clearing Purchase Orders, payments, GRNs & items...');
      await tx.purchaseOrderItem.deleteMany({});
      await tx.goodsReceivedNote.deleteMany({});
      await tx.purchasePayment.deleteMany({});
      await tx.purchaseOrder.deleteMany({});

      console.log('3. Clearing Stock Transfers...');
      await tx.stockTransferItem.deleteMany({});
      await tx.stockTransfer.deleteMany({});

      console.log('4. Clearing Inventory Ledgers, Stock & Catalog...');
      await tx.inventoryLedger.deleteMany({});
      await tx.inventory.deleteMany({});
      await tx.product.deleteMany({});
      await tx.category.deleteMany({});
      await tx.categoryType.deleteMany({});
      await tx.brand.deleteMany({});
      await tx.unit.deleteMany({});

      console.log('5. Clearing Customers & CRM profiles...');
      await tx.customerStoreProfile.deleteMany({});
      await tx.customerExternalLink.deleteMany({});
      await tx.customer.deleteMany({});

      console.log('6. Clearing Vendors...');
      await tx.vendor.deleteMany({});

      console.log('7. Clearing Repairs...');
      await tx.repairEnquiry.deleteMany({});

      console.log('8. Clearing Expenses & Financial Ledgers...');
      await tx.expense.deleteMany({});
      await tx.centralExpense.deleteMany({});
      await tx.financialLedgerEntry.deleteMany({});
      await tx.idempotencyRecord.deleteMany({});

      console.log('9. Clearing Logs, Attendance, Files & Notifications...');
      await tx.auditLog.deleteMany({});
      await tx.attendanceDay.deleteMany({});
      await tx.deleteRequest.deleteMany({});
      await tx.notification.deleteMany({});
      await tx.fileAsset.deleteMany({});
      await tx.realtimeOutbox.deleteMany({});
      await tx.userPresence.deleteMany({});

      console.log('10. Clearing other user accounts (Preserving ONLY Super Admin)...');
      // Delete permission overrides and sessions for other users
      await tx.userPermissionOverride.deleteMany({
        where: { userId: { not: superAdmin.id } },
      });
      await tx.userSession.deleteMany({
        where: { userId: { not: superAdmin.id } },
      });
      await tx.userStoreAssignment.deleteMany({
        where: { userId: { not: superAdmin.id } },
      });
      await tx.userAccount.deleteMany({
        where: { id: { not: superAdmin.id } },
      });

      console.log('11. Ensuring CENTRAL store hub is preserved & clearing other stores...');
      // Ensure CENTRAL store exists
      await tx.storeHub.upsert({
        where: { code: 'CENTRAL' },
        update: {
          name: 'Central Warehouse & Hub',
          city: 'Bengaluru',
          address: 'Plot 42, Electronic City Phase 1',
          status: 'Active',
          timezone: 'Asia/Kolkata',
        },
        create: {
          code: 'CENTRAL',
          name: 'Central Warehouse & Hub',
          city: 'Bengaluru',
          address: 'Plot 42, Electronic City Phase 1',
          status: 'Active',
          timezone: 'Asia/Kolkata',
        },
      });

      // Delete all store hubs except CENTRAL
      await tx.storeHub.deleteMany({
        where: { code: { not: 'CENTRAL' } },
      });

      // Update Super Admin store assignment to CENTRAL
      await tx.userStoreAssignment.deleteMany({
        where: { userId: superAdmin.id },
      });
      await tx.userStoreAssignment.create({
        data: {
          userId: superAdmin.id,
          storeCode: 'CENTRAL',
        },
      });

      // Ensure Super Admin has clean active status
      await tx.userAccount.update({
        where: { id: superAdmin.id },
        data: {
          status: 'Active',
          securityLevel: 100,
          role: 'Super Admin',
          storeScope: 'All Stores',
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      });
    });

    console.log('\n===============================================================');
    console.log('✅ DATABASE PURGE COMPLETED SUCCESSFULLY');
    console.log('===============================================================');

    // Verification queries
    const storeCount = await prisma.storeHub.count();
    const stores = await prisma.storeHub.findMany();
    const userCount = await prisma.userAccount.count();
    const users = await prisma.userAccount.findMany({
      include: { storeAssignments: true },
    });
    const productCount = await prisma.product.count();
    const categoryCount = await prisma.category.count();
    const customerCount = await prisma.customer.count();
    const vendorCount = await prisma.vendor.count();
    const orderCount = await prisma.salesOrder.count();
    const poCount = await prisma.purchaseOrder.count();
    const transferCount = await prisma.stockTransfer.count();
    const expenseCount = await prisma.expense.count();

    console.log('\n📊 POST-PURGE DATABASE STATE:');
    console.log(`- Store Hubs (${storeCount}):`, stores.map((s) => `${s.name} (${s.code})`).join(', '));
    console.log(`- User Accounts (${userCount}):`, users.map((u) => `${u.name} <${u.email}> [Role: ${u.role}]`).join(', '));
    console.log(`- Catalog Products: ${productCount}`);
    console.log(`- Categories:       ${categoryCount}`);
    console.log(`- Customers:        ${customerCount}`);
    console.log(`- Vendors:          ${vendorCount}`);
    console.log(`- Sales Orders:     ${orderCount}`);
    console.log(`- Purchase Orders:  ${poCount}`);
    console.log(`- Stock Transfers:  ${transferCount}`);
    console.log(`- Expenses:         ${expenseCount}`);
    console.log('\n🎉 System is 100% clean and ready for you to create all data from scratch!');
  } catch (error) {
    console.error('❌ Database purge failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

emptyDatabaseKeepSuperAdmin();
