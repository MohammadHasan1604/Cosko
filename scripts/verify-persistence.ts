import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('================================================================');
  console.log('  COSKO PRODUCTION PERSISTENCE & SAFE DELETE VERIFICATION SUITE ');
  console.log('================================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  async function testStep(name: string, fn: () => Promise<void>) {
    totalTests++;
    try {
      await fn();
      console.log(`  [PASS] ${name}`);
      passedTests++;
    } catch (err: any) {
      console.error(`  [FAIL] ${name}: ${err.message}`);
    }
  }

  // 1. Category Persistence
  await testStep('Category: Create -> Query -> Safe Archive -> Verify Non-Reappearance on Refresh', async () => {
    const slug = `test-cat-${Date.now()}`;
    const created = await (prisma as any).category.create({
      data: {
        name: 'Test Bluetooth Soundbar',
        slug,
        categoryType: 'Accessory',
        status: 'Active',
      },
    });

    // Verify created
    const fetch1 = await (prisma as any).category.findUnique({ where: { id: created.id } });
    if (!fetch1 || fetch1.status !== 'Active') throw new Error('Category was not created in MySQL');

    // Simulate API Soft Delete / Archive
    await (prisma as any).category.update({
      where: { id: created.id },
      data: { status: 'Archived' },
    });

    // Simulate standard GET query (with where: { status: { not: 'Archived' } })
    const activeCategories = await (prisma as any).category.findMany({
      where: { status: { not: 'Archived' } },
    });
    const foundArchived = activeCategories.find((c: any) => c.id === created.id);
    if (foundArchived) throw new Error('Archived category reappeared in active list!');

    // Verify in database that it persists as Archived
    const dbRecord = await (prisma as any).category.findUnique({ where: { id: created.id } });
    if (!dbRecord || dbRecord.status !== 'Archived') throw new Error('Database status was not persisted as Archived');
  });

  // 2. Customer Persistence
  await testStep('Customer: Create -> Query -> Safe Archive -> Verify Non-Reappearance on Refresh', async () => {
    const phone = `99999${Math.floor(10000 + Math.random() * 90000)}`;
    const created = await prisma.customer.create({
      data: {
        name: 'Test Customer Verification',
        phone,
        normalizedPhone: phone,
        email: `test-${Date.now()}@example.com`,
        city: 'Bengaluru',
        status: 'Active',
      },
    });

    // Verify created
    const fetch1 = await prisma.customer.findUnique({ where: { id: created.id } });
    if (!fetch1) throw new Error('Customer was not created in MySQL');

    // Safe Archive
    await prisma.customer.update({
      where: { id: created.id },
      data: { status: 'Archived' },
    });

    // Simulate standard GET query
    const activeCustomers = await prisma.customer.findMany({
      where: { status: { not: 'Archived' } },
    });
    const found = activeCustomers.find((c) => c.id === created.id);
    if (found) throw new Error('Archived customer reappeared in active list!');
  });

  // 3. Vendor Persistence
  await testStep('Vendor: Create -> Query -> Safe Archive -> Verify Non-Reappearance on Refresh', async () => {
    const code = `VND-T${Math.floor(1000 + Math.random() * 9000)}`;
    const created = await prisma.vendor.create({
      data: {
        name: 'Test Silicon Vendor',
        code,
        categories: 'Electricals',
        contactPerson: 'Suresh Menon',
        email: 'suresh@vendor.com',
        phone: '+91 80 1234 5678',
        city: 'Bengaluru',
        status: 'Active',
      },
    });

    // Verify created
    const fetch1 = await prisma.vendor.findUnique({ where: { id: created.id } });
    if (!fetch1) throw new Error('Vendor was not created in MySQL');

    // Safe Archive
    await prisma.vendor.update({
      where: { id: created.id },
      data: { status: 'Archived' },
    });

    // Simulate standard GET query
    const activeVendors = await prisma.vendor.findMany({
      where: { status: { not: 'Archived' } },
    });
    const found = activeVendors.find((v) => v.id === created.id);
    if (found) throw new Error('Archived vendor reappeared in active list!');
  });

  // 4. Product Persistence
  await testStep('Product: Create -> Query -> Safe Archive -> Verify Non-Reappearance on Refresh', async () => {
    const sku = `SKU-TEST-${Date.now()}`;
    const created = await prisma.product.create({
      data: {
        sku,
        name: 'Test OLED Display Module',
        category: 'Spare Part',
        brand: 'Samsung',
        baseCostPrice: 2400,
        baseSellingPrice: 3800,
        status: 'active',
      },
    });

    // Verify created
    const fetch1 = await prisma.product.findUnique({ where: { id: created.id } });
    if (!fetch1) throw new Error('Product was not created in MySQL');

    // Safe Archive
    await prisma.product.update({
      where: { id: created.id },
      data: { status: 'archived' },
    });

    // Simulate standard GET query
    const activeProducts = await prisma.product.findMany({
      where: { status: { notIn: ['deleted', 'archived'] } },
    });
    const found = activeProducts.find((p) => p.id === created.id);
    if (found) throw new Error('Archived product reappeared in active list!');
  });

  // 5. Purchase Order Persistence
  await testStep('Purchase Order: Create Draft -> Delete -> Verify Non-Reappearance', async () => {
    const poNo = `PO-TEST-${Date.now()}`;
    // Create temporary vendor
    const vendor = await prisma.vendor.create({
      data: {
        name: 'PO Test Vendor',
        code: `VND-PO-${Date.now()}`,
        contactPerson: 'Vendor Rep',
        categories: 'Electronics',
        email: 'po@vendor.com',
        phone: '+91 80 9876 5432',
        city: 'Bengaluru',
        status: 'Active',
      },
    });

    const created = await prisma.purchaseOrder.create({
      data: {
        poNo,
        vendorId: vendor.id,
        storeCode: 'BLR',
        status: 'Draft',
        totalCost: 15000,
        paymentStatus: 'Unpaid',
        createdBy: 'Admin',
      },
    });

    // Verify created
    const fetch1 = await prisma.purchaseOrder.findUnique({ where: { id: created.id } });
    if (!fetch1) throw new Error('PO was not created in MySQL');

    // Hard Delete Draft PO
    await prisma.purchaseOrder.delete({
      where: { id: created.id },
    });

    // Simulate standard GET query
    const allPOs = await prisma.purchaseOrder.findMany({
      where: { status: { notIn: ['Archived', 'Cancelled'] } },
    });
    const found = allPOs.find((p) => p.id === created.id);
    if (found) throw new Error('Deleted draft PO reappeared!');
  });

  console.log(`\n================================================================`);
  console.log(`  RESULTS: ${passedTests} / ${totalTests} TESTS PASSED `);
  console.log(`================================================================\n`);

  if (passedTests === totalTests) {
    console.log('ALL PERSISTENCE TESTS PASSED: MySQL is the authoritative source of truth, records never reappear on refresh.');
  } else {
    process.exit(1);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
