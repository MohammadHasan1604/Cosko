import fs from 'fs';
import path from 'path';
import { prisma } from '../src/lib/db';
import { hashPassword } from '../src/lib/auth';

async function cleanDatabaseReset() {
  console.log('\n===============================================================');
  console.log('🧹 COSKO ENTERPRISE — CLEAN PRODUCTION DATABASE RESET');
  console.log('===============================================================\n');

  try {
    // 1. Verify backup existence
    const backupDir = path.join(process.cwd(), 'backups');
    if (!fs.existsSync(backupDir)) {
      throw new Error('Backup directory not found. You must run "npx tsx scripts/backup-database.ts" first.');
    }

    const backupFiles = fs.readdirSync(backupDir).filter((f) => f.startsWith('database_backup_') && f.endsWith('.json'));
    if (backupFiles.length === 0) {
      throw new Error('No valid database backup found in backups/ directory. Aborting clean reset.');
    }
    console.log(`✅ Verified existing backup: ${backupFiles[backupFiles.length - 1]}`);

    // Read super admin credentials from environment or default
    const superAdminEmail = (
      process.env.BOOTSTRAP_SUPERADMIN_EMAIL ||
      process.argv[2] ||
      'cosko@gmail.com'
    ).toLowerCase().trim();

    const superAdminPassword =
      process.env.BOOTSTRAP_SUPERADMIN_PASSWORD ||
      process.argv[3] ||
      'Cosko2026@';

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
      await tx.customerExternalLink.deleteMany({});
      await tx.customer.deleteMany({});
      await tx.vendor.deleteMany({});
      await tx.expense.deleteMany({});
      await tx.centralExpense.deleteMany({});
      await tx.product.deleteMany({});
      await tx.category.deleteMany({});
      await tx.auditLog.deleteMany({});

      // 2. Delete all user overrides, assignments, and users
      await tx.userPermissionOverride.deleteMany({});
      await tx.userStoreAssignment.deleteMany({});
      await tx.userAccount.deleteMany({});

      // 3. Ensure Core 5 Store Hubs exist and are active
      const coreStores = [
        { code: 'CENTRAL', name: 'COSKO Central Warehouse & Owner Stock', city: 'Bengaluru', address: 'Central Hub, Bengaluru', registersCount: 0, skusCount: 0, monthlyRevenue: 0 },
        { code: 'BLR', name: 'Bengaluru Central Hub', city: 'Bengaluru', address: 'Indiranagar 100ft Rd, Bengaluru', registersCount: 4, skusCount: 0, monthlyRevenue: 0 },
        { code: 'HYD', name: 'Hyderabad Warehouse & Outlet', city: 'Hyderabad', address: 'Hitech City Phase 2, Hyderabad', registersCount: 3, skusCount: 0, monthlyRevenue: 0 },
        { code: 'DEL', name: 'Delhi NCR Fulfillment Center', city: 'Delhi', address: 'Okhla Industrial Area Ph-III, New Delhi', registersCount: 5, skusCount: 0, monthlyRevenue: 0 },
        { code: 'MUM', name: 'Mumbai Commercial Hub', city: 'Mumbai', address: 'Bandra Kurla Complex, Mumbai', registersCount: 4, skusCount: 0, monthlyRevenue: 0 },
      ];

      for (const st of coreStores) {
        await tx.storeHub.upsert({
          where: { code: st.code },
          update: { name: st.name, city: st.city, address: st.address, registersCount: st.registersCount, skusCount: 0, monthlyRevenue: 0, status: 'Active' },
          create: { code: st.code, name: st.name, city: st.city, address: st.address, registersCount: st.registersCount, skusCount: 0, monthlyRevenue: 0, status: 'Active' },
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
          shiftStatus: 'On Shift',
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
