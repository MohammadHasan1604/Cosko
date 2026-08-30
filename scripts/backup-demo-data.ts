import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function main() {
  console.log('Exporting backup of current database state...');

  const backupData = {
    timestamp: new Date().toISOString(),
    storeHubs: await prisma.storeHub.findMany(),
    userAccounts: await prisma.userAccount.findMany(),
    categories: await prisma.category.findMany(),
    products: await prisma.product.findMany(),
    inventory: await prisma.inventory.findMany(),
    customers: await prisma.customer.findMany(),
    vendors: await prisma.vendor.findMany(),
    purchaseOrders: await prisma.purchaseOrder.findMany({ include: { items: true } }),
    salesOrders: await prisma.salesOrder.findMany({ include: { items: true } }),
    repairs: await prisma.repairEnquiry.findMany(),
    expenses: await prisma.expense.findMany(),
    auditLogs: await prisma.auditLog.findMany(),
  };

  const backupPath = path.join(__dirname, 'backup_demo_data.json');
  fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2));

  console.log(`Backup successfully saved to: ${backupPath}`);
}

main()
  .catch((e) => {
    console.error('Backup failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
