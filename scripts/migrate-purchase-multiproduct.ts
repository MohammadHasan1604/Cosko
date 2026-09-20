import { prisma } from '../src/lib/db';

async function main() {
  console.log('Running safe migration for purchases & purchase_items multi-product fields...');

  // Helper to check if column exists
  const checkColumnExists = async (table: string, column: string): Promise<boolean> => {
    const cols: any = await prisma.$queryRawUnsafe(`DESCRIBE \`${table}\``);
    return cols.some((c: any) => c.Field === column);
  };

  // 1. purchases table
  const purchasesCols = [
    { name: 'subtotal', sql: 'ALTER TABLE `purchases` ADD COLUMN `subtotal` DECIMAL(15, 2) NULL DEFAULT 0.00 AFTER `received_date`' },
    { name: 'tax_amount', sql: 'ALTER TABLE `purchases` ADD COLUMN `tax_amount` DECIMAL(15, 2) NULL DEFAULT 0.00 AFTER `subtotal`' },
    { name: 'discount_amount', sql: 'ALTER TABLE `purchases` ADD COLUMN `discount_amount` DECIMAL(15, 2) NULL DEFAULT 0.00 AFTER `tax_amount`' },
  ];

  for (const col of purchasesCols) {
    const exists = await checkColumnExists('purchases', col.name);
    if (!exists) {
      console.log(`Adding column ${col.name} to purchases...`);
      await prisma.$executeRawUnsafe(col.sql);
      console.log(`Added ${col.name} to purchases.`);
    } else {
      console.log(`Column ${col.name} already exists in purchases.`);
    }
  }

  // 2. purchase_items table
  const itemCols = [
    { name: 'tax_rate', sql: 'ALTER TABLE `purchase_items` ADD COLUMN `tax_rate` DECIMAL(5, 2) NULL DEFAULT 0.00 AFTER `unit_cost`' },
    { name: 'tax_amount', sql: 'ALTER TABLE `purchase_items` ADD COLUMN `tax_amount` DECIMAL(12, 2) NULL DEFAULT 0.00 AFTER `tax_rate`' },
    { name: 'discount', sql: 'ALTER TABLE `purchase_items` ADD COLUMN `discount` DECIMAL(12, 2) NULL DEFAULT 0.00 AFTER `tax_amount`' },
  ];

  for (const col of itemCols) {
    const exists = await checkColumnExists('purchase_items', col.name);
    if (!exists) {
      console.log(`Adding column ${col.name} to purchase_items...`);
      await prisma.$executeRawUnsafe(col.sql);
      console.log(`Added ${col.name} to purchase_items.`);
    } else {
      console.log(`Column ${col.name} already exists in purchase_items.`);
    }
  }

  console.log('Safe migration completed successfully!');
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Migration error:', err);
  process.exit(1);
});
