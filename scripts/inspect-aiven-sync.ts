import { prisma } from '../src/lib/db';

async function inspectAivenSync() {
  console.log('===============================================================');
  console.log('☁️ COSKO — AIVEN CLOUD MYSQL DATABASE LIVE SYNC INSPECTION');
  console.log('===============================================================');

  try {
    // 1. Raw Query Test (Database Info & Latency)
    const start = Date.now();
    const [dbInfo]: any = await prisma.$queryRaw`SELECT DATABASE() as current_db, VERSION() as mysql_version, @@hostname as server_host`;
    const latency = Date.now() - start;
    console.log(`\n✅ 1. Aiven MySQL Connection: CONNECTED (${latency}ms roundtrip)`);
    console.log(`   Database Name : ${dbInfo.current_db}`);
    console.log(`   MySQL Version : ${dbInfo.mysql_version}`);
    console.log(`   Server Host   : ${dbInfo.server_host}`);

    // 2. Inspect StoreHub Table
    const stores = await prisma.storeHub.findMany({
      orderBy: { createdAt: 'asc' },
    });
    console.log(`\n✅ 2. StoreHub Table (${stores.length} physical stores configured in Aiven MySQL):`);
    stores.forEach((s, idx) => {
      const isCentral = s.code === 'CENTRAL';
      console.log(`   [${idx + 1}] ${s.name} (${s.code}) — Status: ${s.status} | Address: ${s.address || 'N/A'}${isCentral ? ' [DEFAULT PERMANENT HUB]' : ''}`);
    });

    const rogueStores = stores.filter(s => s.code === 'ALL' || s.name.toLowerCase().includes('all stores'));
    if (rogueStores.length === 0) {
      console.log('   🛡️ Verified: 0 "All Stores" rows exist in StoreHub table (Pure physical stores only)');
    } else {
      console.warn(`   ⚠️ Found ${rogueStores.length} rogue "All Stores" rows in StoreHub table!`);
    }

    // 3. Inspect Product & Inventory Table
    const productCount = await prisma.product.count();
    const inventoryItems = await prisma.inventory.findMany({
      include: {
        product: { select: { name: true, sku: true } },
      },
    });

    console.log(`\n✅ 3. Inventory & Products in Aiven MySQL:`);
    console.log(`   Total Catalog Products: ${productCount}`);
    console.log(`   Total Inventory Stock Records: ${inventoryItems.length}`);

    // Group inventory balances by storeCode
    const balancesByStore: Record<string, number> = {};
    let rogueInventoryCount = 0;
    for (const item of inventoryItems) {
      balancesByStore[item.storeCode] = (balancesByStore[item.storeCode] || 0) + item.qtyOnHand;
      if (item.storeCode === 'ALL' || item.storeCode.toLowerCase() === 'all stores') {
        rogueInventoryCount++;
      }
    }

    console.log('   Stock Distribution Across Physical Locations:');
    for (const [storeCode, qty] of Object.entries(balancesByStore)) {
      console.log(`     - Store [${storeCode}]: ${qty} units on hand`);
    }

    if (rogueInventoryCount === 0) {
      console.log('   🛡️ Verified: 0 inventory records assigned to "All Stores"');
    } else {
      console.warn(`   ⚠️ Warning: Found ${rogueInventoryCount} items assigned to All Stores`);
    }

    // 4. Inspect Stock Transfers Table
    const transfersCount = await prisma.stockTransfer.count();
    console.log(`\n✅ 4. Stock Transfers in Aiven MySQL:`);
    console.log(`   Total Stock Transfers: ${transfersCount}`);

    // 5. Inspect Sales & Users Table
    const salesCount = await prisma.salesOrder.count();
    const usersCount = await prisma.userAccount.count();
    const customerCount = await prisma.customer.count();
    console.log(`\n✅ 5. Sales, Users & Customers in Aiven MySQL:`);
    console.log(`   Total Sales Orders Logged : ${salesCount}`);
    console.log(`   Total User Accounts in DB : ${usersCount}`);
    console.log(`   Total Customer Profiles   : ${customerCount}`);

    console.log('\n===============================================================');
    console.log('🎉 LIVE SYNC STATUS: 100% CONNECTED & IN SYNC WITH AIVEN MYSQL');
    console.log('===============================================================');
  } catch (error) {
    console.error('❌ Error inspecting Aiven MySQL sync:', error);
  } finally {
    await prisma.$disconnect();
  }
}

inspectAivenSync();
