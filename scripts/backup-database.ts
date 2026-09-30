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
        stores: await (prisma as any).storeHub.findMany(),
        users: await (prisma as any).userAccount.findMany(),
        userStoreAssignments: await (prisma as any).userStoreAssignment.findMany(),
        userSessions: await (prisma as any).userSession.findMany(),
        attendanceDays: await (prisma as any).attendanceDay.findMany(),
        categories: await (prisma as any).category.findMany(),
        categoryTypes: await (prisma as any).categoryType.findMany(),
        products: await (prisma as any).product.findMany(),
        inventory: await (prisma as any).inventory.findMany(),
        inventoryLedgers: await (prisma as any).inventoryLedger.findMany(),
        stockTransfers: await (prisma as any).stockTransfer.findMany(),
        stockTransferItems: await (prisma as any).stockTransferItem.findMany(),
        salesOrders: await (prisma as any).salesOrder.findMany({ include: { items: true } }),
        salesOrderItems: await (prisma as any).salesOrderItem.findMany(),
        purchaseOrders: await (prisma as any).purchaseOrder.findMany({ include: { items: true } }),
        purchaseOrderItems: await (prisma as any).purchaseOrderItem.findMany(),
        purchasePayments: await (prisma as any).purchasePayment.findMany(),
        goodsReceivedNotes: await (prisma as any).goodsReceivedNote.findMany(),
        customers: await (prisma as any).customer.findMany(),
        customerStoreProfiles: await (prisma as any).customerStoreProfile.findMany(),
        customerExternalLinks: await (prisma as any).customerExternalLink.findMany(),
        vendors: await (prisma as any).vendor.findMany(),
        expenses: await (prisma as any).expense.findMany(),
        centralExpenses: await (prisma as any).centralExpense.findMany(),
        repairEnquiries: await (prisma as any).repairEnquiry.findMany(),
        auditLogs: await (prisma as any).auditLog.findMany(),
        brandingSettings: await (prisma as any).brandingSetting.findMany(),
        systemSettings: await (prisma as any).systemSettings.findMany(),
        financialLedgerEntries: await (prisma as any).financialLedgerEntry.findMany(),
        idempotencyRecords: await (prisma as any).idempotencyRecord.findMany(),
        paymentMethods: await (prisma as any).paymentMethod.findMany(),
        brands: await (prisma as any).brand.findMany(),
        units: await (prisma as any).unit.findMany(),
        deleteRequests: await (prisma as any).deleteRequest.findMany(),
        notifications: await (prisma as any).notification.findMany(),
        fileAssets: await (prisma as any).fileAsset.findMany(),
        realtimeOutbox: await (prisma as any).realtimeOutbox.findMany(),
        userPresence: await (prisma as any).userPresence.findMany(),
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
    console.log(`📊 Total Records: ${totalRecords} records across tables`);
    console.log(`💾 Size: ${(stats.size / 1024).toFixed(2)} KB`);
    console.log('===============================================================\n');

    process.exit(0);
  } catch (error: any) {
    console.error('❌ Database backup failed:', error);
    process.exit(1);
  }
}

backupDatabase();
