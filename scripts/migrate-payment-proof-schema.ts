import { prisma } from '../src/lib/db';

async function main() {
  console.log('--- Applying Payment Proof Schema Migrations to MySQL ---');

  // Helper to check if column exists
  async function columnExists(table: string, column: string): Promise<boolean> {
    try {
      const cols: any = await prisma.$queryRawUnsafe(`DESCRIBE \`${table}\``);
      return cols.some((c: any) => c.Field === column);
    } catch (err: any) {
      console.warn(`Could not describe table ${table}:`, err.message);
      return false;
    }
  }

  // 1. Sales table
  const salesHasRef = await columnExists('sales', 'reference_no');
  if (!salesHasRef) {
    console.log('Adding reference_no to sales table...');
    await prisma.$executeRawUnsafe('ALTER TABLE sales ADD COLUMN reference_no VARCHAR(64) NULL AFTER payment_method');
  }

  const salesHasProof = await columnExists('sales', 'payment_proof_url');
  if (!salesHasProof) {
    console.log('Adding payment_proof_url to sales table...');
    await prisma.$executeRawUnsafe('ALTER TABLE sales ADD COLUMN payment_proof_url LONGTEXT NULL AFTER reference_no');
  }

  // 2. Expenses table
  const expHasRef = await columnExists('expenses', 'reference_no');
  if (!expHasRef) {
    console.log('Adding reference_no to expenses table...');
    await prisma.$executeRawUnsafe('ALTER TABLE expenses ADD COLUMN reference_no VARCHAR(64) NULL AFTER payment_method');
  }

  const expHasReceipt = await columnExists('expenses', 'receipt_url');
  if (!expHasReceipt) {
    console.log('Adding receipt_url to expenses table...');
    await prisma.$executeRawUnsafe('ALTER TABLE expenses ADD COLUMN receipt_url LONGTEXT NULL AFTER reference_no');
  }

  const expHasRecordedBy = await columnExists('expenses', 'recorded_by');
  if (!expHasRecordedBy) {
    console.log('Adding recorded_by to expenses table...');
    await prisma.$executeRawUnsafe('ALTER TABLE expenses ADD COLUMN recorded_by VARCHAR(128) NULL AFTER approved_by');
  }

  // 3. Central Expenses table
  const centralExpHasRef = await columnExists('central_expenses', 'reference_no');
  if (!centralExpHasRef) {
    console.log('Adding reference_no to central_expenses table...');
    await prisma.$executeRawUnsafe('ALTER TABLE central_expenses ADD COLUMN reference_no VARCHAR(64) NULL AFTER payment_method');
  }

  const centralExpHasReceipt = await columnExists('central_expenses', 'receipt_url');
  if (!centralExpHasReceipt) {
    console.log('Adding receipt_url to central_expenses table...');
    await prisma.$executeRawUnsafe('ALTER TABLE central_expenses ADD COLUMN receipt_url LONGTEXT NULL AFTER reference_no');
  }

  const centralExpHasRecordedBy = await columnExists('central_expenses', 'recorded_by');
  if (!centralExpHasRecordedBy) {
    console.log('Adding recorded_by to central_expenses table...');
    await prisma.$executeRawUnsafe('ALTER TABLE central_expenses ADD COLUMN recorded_by VARCHAR(128) NULL AFTER approved_by');
  }

  console.log('--- Migration statements completed successfully! ---');
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
