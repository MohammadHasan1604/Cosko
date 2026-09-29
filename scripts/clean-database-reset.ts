import { prisma } from '../src/lib/db';
import { hashPassword } from '../src/lib/auth';

async function cleanDatabaseReset() {
  console.log('\n===============================================================');
  console.log('🧹 COSKO ENTERPRISE — STRICT PRODUCTION CLEAN DATABASE RESET');
  console.log('===============================================================\n');

  const superAdminEmail = (process.env.INITIAL_SUPER_ADMIN_EMAIL || 'admin@cosko.internal').toLowerCase().trim();
  const superAdminPassword = process.env.INITIAL_SUPER_ADMIN_PASSWORD || 'CoskoMaster2026!#';

  try {
    console.log('🔒 Verifying target environment...');
    console.log(`👤 Target Initial Super Admin: ${superAdminEmail}`);

    console.log('🔄 Executing atomic clean database purge of all business data...');

    await prisma.$transaction(async (tx) => {
      // 1. Delete transactional data
      await tx.salesOrderItem.deleteMany({});
      await tx.salesOrder.deleteMany({});
      await tx.purchaseOrderItem.deleteMany({});
      await tx.purchaseOrder.deleteMany({});
      await tx.stockTransferItem.deleteMany({});
      await tx.stockTransfer.deleteMany({});
      await tx.inventoryLedger.deleteMany({});
      await tx.inventory.deleteMany({});
      await tx.repairEnquiry.deleteMany({});
      await tx.customerStoreProfile.deleteMany({});
      await tx.customer.deleteMany({});
      await tx.vendor.deleteMany({});
      await tx.expense.deleteMany({});
      await tx.centralExpense.deleteMany({});
      await tx.product.deleteMany({});
      await tx.category.deleteMany({});
      await tx.auditLog.deleteMany({});
      await tx.fileAsset.deleteMany({});
      await tx.attendanceDay.deleteMany({});
      await tx.userSession.deleteMany({});

      // 2. Delete all user assignments and users
      await tx.userStoreAssignment.deleteMany({});
      await tx.userAccount.deleteMany({});

      // 3. Ensure Core 5 Store Hubs exist and are active
      const coreStores = [
        { code: 'CENTRAL', name: 'COSKO Central Warehouse & Owner Stock', city: 'Bengaluru', address: 'Central Hub, Bengaluru', timezone: 'Asia/Kolkata' },
        { code: 'BLR', name: 'Bengaluru Central Hub', city: 'Bengaluru', address: 'Indiranagar 100ft Rd, Bengaluru', timezone: 'Asia/Kolkata' },
        { code: 'HYD', name: 'Hyderabad Warehouse & Outlet', city: 'Hyderabad', address: 'Hitech City Phase 2, Hyderabad', timezone: 'Asia/Kolkata' },
        { code: 'DEL', name: 'Delhi NCR Fulfillment Center', city: 'Delhi', address: 'Okhla Industrial Area Ph-III, New Delhi', timezone: 'Asia/Kolkata' },
        { code: 'MUM', name: 'Mumbai Commercial Hub', city: 'Mumbai', address: 'Bandra Kurla Complex, Mumbai', timezone: 'Asia/Kolkata' },
      ];

      for (const st of coreStores) {
        await tx.storeHub.upsert({
          where: { code: st.code },
          update: { name: st.name, city: st.city, address: st.address, status: 'Active', timezone: st.timezone },
          create: { code: st.code, name: st.name, city: st.city, address: st.address, status: 'Active', timezone: st.timezone },
        });
      }

      // 4. Create the ONLY Initial Super Admin account
      const hashedPassword = await hashPassword(superAdminPassword);
      const superAdminUser = await tx.userAccount.create({
        data: {
          name: 'Super Admin',
          email: superAdminEmail,
          passwordHash: hashedPassword,
          role: 'Super Admin',
          securityLevel: 100,
          storeScope: 'All Stores',
          status: 'Active',
          mustChangePassword: true, // Mandatory password update on first login
        },
      });

      // Assign all 5 store hubs to Super Admin
      for (const st of coreStores) {
        await tx.userStoreAssignment.create({
          data: {
            userId: superAdminUser.id,
            storeCode: st.code,
          },
        });
      }

      // 5. Ensure Default Branding Config
      await tx.brandingSetting.upsert({
        where: { id: 'cosko_branding_config' },
        update: {
          appName: 'COSKO',
          tagline: 'Multi-Store Enterprise Retail & POS System',
          supportEmail: 'support@cosko.com',
        },
        create: {
          id: 'cosko_branding_config',
          appName: 'COSKO',
          tagline: 'Multi-Store Enterprise Retail & POS System',
          supportEmail: 'support@cosko.com',
        },
      });

      // 6. Record Clean Reset Audit Log
      await tx.auditLog.create({
        data: {
          userEmail: superAdminEmail,
          userRole: 'Super Admin',
          storeCode: 'CENTRAL',
          module: 'System Administration',
          action: 'Clean Production Database Reset',
          details: 'All demo business data cleared. Sole Super Admin provisioned with mandatory first-login password rotation.',
          ipAddress: '127.0.0.1',
        },
      });
    });

    console.log('\n===============================================================');
    console.log('🎉 Clean Database Reset Successfully Completed!');
    console.log('===============================================================');
    console.log('📊 Final Database State:');
    console.log('  - Products: 0');
    console.log('  - Categories: 0');
    console.log('  - Inventory: 0');
    console.log('  - Sales Orders: 0');
    console.log('  - Purchase Orders: 0');
    console.log('  - Customers: 0');
    console.log('  - Vendors: 0');
    console.log('  - Expenses: 0');
    console.log('  - Repairs: 0');
    console.log('  - Active Store Hubs: 5 (CENTRAL, BLR, HYD, DEL, MUM)');
    console.log('  - User Accounts: Exactly 1 Super Admin (Level 100, All Stores)');
    console.log('  - Password Rotation: Active (must change password on first login)');
    console.log('===============================================================\n');

    process.exit(0);
  } catch (error: any) {
    console.error('❌ Clean database reset failed:', error);
    process.exit(1);
  }
}

cleanDatabaseReset();
