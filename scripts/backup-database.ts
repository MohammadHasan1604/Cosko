import fs from 'fs';
import path from 'path';
import { prisma } from '../src/lib/db';

async function backupDatabase() {
  console.log('\n===============================================================');
  console.log('📦 COSKO ENTERPRISE — DATABASE BACKUP & EXPORT PROTOCOL');
  console.log('===============================================================\n');

  try {
    const backupDir = path.join(process.cwd(), 'backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFilePath = path.join(backupDir, `database_backup_${timestamp}.json`);

    console.log('🔄 Fetching records across all database tables...');

    const backupData = {
      metadata: {
        exportedAt: new Date().toISOString(),
        version: '1.0',
        system: 'COSKO Enterprise Retail & POS',
      },
      tables: {
        stores: await prisma.storeHub.findMany(),
        users: await prisma.userAccount.findMany({ select: { id: true, email: true, name: true, phone: true, role: true, securityLevel: true, storeScope: true, status: true, shiftStatus: true, mustChangePassword: true, avatarUrl: true, lastLogin: true, createdAt: true, updatedAt: true } }),
        userStoreAssignments: await prisma.userStoreAssignment.findMany(),
        roles: await prisma.role.findMany(),
        permissions: await prisma.permission.findMany(),
        userPermissionOverrides: await prisma.userPermissionOverride.findMany(),
        categories: await prisma.category.findMany(),
        products: await prisma.product.findMany(),
        inventory: await prisma.inventory.findMany(),
        inventoryLedgers: await prisma.inventoryLedger.findMany(),
        stockTransfers: await prisma.stockTransfer.findMany(),
        stockTransferItems: await prisma.stockTransferItem.findMany(),
        salesOrders: await prisma.salesOrder.findMany({ include: { items: true } }),
        salesOrderItems: await prisma.salesOrderItem.findMany(),
        purchaseOrders: await prisma.purchaseOrder.findMany({ include: { items: true } }),
        purchaseOrderItems: await prisma.purchaseOrderItem.findMany(),
        customers: await prisma.customer.findMany(),
        customerExternalLinks: await prisma.customerExternalLink.findMany(),
        vendors: await prisma.vendor.findMany(),
        expenses: await prisma.expense.findMany(),
        centralExpenses: await prisma.centralExpense.findMany(),
        repairEnquiries: await prisma.repairEnquiry.findMany(),
        auditLogs: await prisma.auditLog.findMany(),
        brandingSettings: await prisma.brandingSetting.findMany(),
        legacyDataSources: await prisma.legacyDataSourceConfig.findMany(),
      },
      counts: {} as Record<string, number>,
    };

    let totalRecords = 0;
    for (const [table, rows] of Object.entries(backupData.tables)) {
      const count = Array.isArray(rows) ? rows.length : 0;
      backupData.counts[table] = count;
      totalRecords += count;
      console.log(`  - ${table}: ${count} records exported`);
    }

    fs.writeFileSync(backupFilePath, JSON.stringify(backupData, null, 2), 'utf-8');

    const stats = fs.statSync(backupFilePath);
    if (stats.size === 0) {
      throw new Error('Backup file was created with 0 bytes size!');
    }

    console.log('\n===============================================================');
    console.log(`✅ Backup successfully created!`);
    console.log(`📁 File: ${backupFilePath}`);
    console.log(`📊 Total Records: ${totalRecords} records across 25 tables`);
    console.log(`💾 Size: ${(stats.size / 1024).toFixed(2)} KB`);
    console.log('===============================================================\n');

    process.exit(0);
  } catch (error: any) {
    console.error('❌ Database backup failed:', error);
    process.exit(1);
  }
}

backupDatabase();
