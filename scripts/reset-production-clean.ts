import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('================================================================');
  console.log('  COSKO PRODUCTION DATA RESET — CLEAN START FOR REAL DATA ENTRY ');
  console.log('================================================================\n');

  console.log('1. Clearing transaction line items...');
  await prisma.salesOrderItem.deleteMany({});
  await prisma.purchaseOrderItem.deleteMany({});
  await prisma.stockTransferItem.deleteMany({});

  console.log('2. Clearing operational orders & transfers...');
  await prisma.salesOrder.deleteMany({});
  await prisma.purchaseOrder.deleteMany({});
  await prisma.stockTransfer.deleteMany({});

  console.log('3. Clearing inventory stock ledgers and physical stock...');
  await prisma.inventoryLedger.deleteMany({});
  await prisma.inventory.deleteMany({});
  await prisma.product.deleteMany({});
  await (prisma as any).category.deleteMany({});

  console.log('4. Clearing CRM, repairs, and external links...');
  await (prisma as any).customerExternalLink.deleteMany({});
  await prisma.repairEnquiry.deleteMany({});
  await prisma.customer.deleteMany({});
  await prisma.vendor.deleteMany({});

  console.log('5. Clearing expenses & audit logs...');
  await prisma.expense.deleteMany({});
  await prisma.auditLog.deleteMany({});

  console.log('\n================================================================');
  console.log('  SUMMARY OF PRESERVED SYSTEM INFRASTRUCTURE:');
  console.log(`  - Store Hub Outlets: ${await prisma.storeHub.count()} stores preserved`);
  console.log(`  - User Accounts:     ${await prisma.userAccount.count()} user accounts preserved`);
  console.log(`  - Roles & Privileges: ${await prisma.role.count()} system roles preserved`);
  console.log(`  - Products Count:     ${await prisma.product.count()} (CLEARED FOR REAL DATA)`);
  console.log(`  - Categories Count:   ${await (prisma as any).category.count()} (CLEARED FOR REAL DATA)`);
  console.log(`  - Customers Count:    ${await prisma.customer.count()} (CLEARED FOR REAL DATA)`);
  console.log(`  - Vendors Count:      ${await prisma.vendor.count()} (CLEARED FOR REAL DATA)`);
  console.log(`  - Sales Orders Count: ${await prisma.salesOrder.count()} (CLEARED FOR REAL DATA)`);
  console.log('================================================================\n');
  console.log('SUCCESS: COSKO is clean and ready for production real-world data entry!');
}

main()
  .catch((e) => {
    console.error('Data reset failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
