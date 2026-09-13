import { prisma } from '../src/lib/db';

async function main() {
  console.log('Altering vendors table to make gstin optional...');
  await prisma.$executeRawUnsafe("ALTER TABLE vendors MODIFY COLUMN gstin VARCHAR(32) NULL DEFAULT ''");
  console.log('Successfully altered vendors table: gstin is now nullable with default empty string.');
  
  const cols: any = await prisma.$queryRawUnsafe("DESCRIBE vendors");
  const gstinCol = cols.find((c: any) => c.Field === 'gstin');
  console.log('Updated gstin column in MySQL:', gstinCol);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Error altering table:', err);
  process.exit(1);
});
