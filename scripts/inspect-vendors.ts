import { prisma } from '../src/lib/db';

async function main() {
  const vendors = await prisma.vendor.findMany();
  console.log('Vendors count:', vendors.length);
  for (const v of vendors) {
    console.log(`[${v.code}] ${v.name} | GSTIN: "${v.gstin}" | Status: ${v.status}`);
  }
  await prisma.$disconnect();
}

main().catch(console.error);
