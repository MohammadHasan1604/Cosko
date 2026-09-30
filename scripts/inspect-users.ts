import { prisma } from '../src/lib/db';

async function main() {
  const users = await prisma.userAccount.findMany({
    include: { storeAssignments: true },
  });
  console.log('USERS IN DB:');
  for (const u of users) {
    console.log(`- ${u.id}: ${u.name} | ${u.email} | ${u.role} | store: ${u.storeScope} | assignments: ${u.storeAssignments.map(a => a.storeCode).join(',')}`);
  }

  const vendors = await prisma.vendor.findMany();
  console.log('\nVENDORS IN DB:');
  for (const v of vendors) {
    console.log(`- ${v.id}: ${v.name} | storeCode: ${v.storeCode}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
