import { prisma } from '../src/lib/db';

async function auditVendors() {
  console.log('Auditing vendor store assignments and data integrity...');

  const stores = await prisma.storeHub.findMany({ select: { code: true } });
  const validStoreCodes = new Set(stores.map((s) => s.code));

  const vendors = await prisma.vendor.findMany({
    select: {
      id: true,
      name: true,
      code: true,
      storeCode: true,
      status: true,
    },
  });

  console.log(`Found ${vendors.length} total vendors.`);

  let invalidCount = 0;
  for (const v of vendors) {
    if (!v.storeCode || !validStoreCodes.has(v.storeCode)) {
      console.warn(
        `[INVALID STORE] Vendor ${v.name} (${v.code}) has invalid storeCode: "${v.storeCode}"`
      );
      invalidCount++;
    }
  }

  if (invalidCount === 0) {
    console.log('✅ All vendors have valid storeCode assignments.');
  } else {
    console.warn(`⚠️ Found ${invalidCount} vendors with missing or invalid storeCode assignments.`);
  }
}

auditVendors()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
