import { prisma } from '../src/lib/db';

async function main() {
  const users = await prisma.userAccount.findMany({
    include: {
      storeAssignments: true,
    },
  });

  console.log(`TOTAL USERS: ${users.length}`);
  for (const u of users) {
    console.log(`- [${u.id}] ${u.name} <${u.email}> | Role: ${u.role} (Level: ${u.securityLevel}) | storeScope: ${u.storeScope} | assignments: [${u.storeAssignments.map(a => a.storeCode).join(', ')}] | status: ${u.status}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
