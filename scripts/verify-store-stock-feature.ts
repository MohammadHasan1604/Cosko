import { prisma } from '../src/lib/db';

async function verifyStoreStockFeature() {
  console.log('=== VERIFYING INVENTORY STORE STOCK BACKEND & DYNAMIC QUERIES ===\n');

  // 1. Fetch active stores
  const activeStores = await prisma.storeHub.findMany({
    where: { status: 'Active' },
  });

  activeStores.sort((a, b) => {
    if (a.code === 'CENTRAL') return -1;
    if (b.code === 'CENTRAL') return 1;
    return a.code.localeCompare(b.code);
  });

  console.log(`Found ${activeStores.length} active stores in DB:`);
  activeStores.forEach((s) => console.log(`  - [${s.code}] ${s.name} (${s.city || 'HQ'})`));

  // 2. Query target product iPhone 18 Pro (SKU: APP-7598)
  const sku = 'APP-7598';
  const product = await prisma.product.findFirst({
    where: { sku },
    include: {
      inventoryItems: true,
    },
  });

  if (!product) {
    throw new Error(`Target product ${sku} not found!`);
  }

  console.log(`\nFound product: ${product.name} (SKU: ${product.sku})`);

  let totalStock = 0;
  const storeBreakdown = activeStores.map((store) => {
    const inv = product.inventoryItems.find((i) => i.storeCode.toUpperCase() === store.code.toUpperCase());
    const qtyOnHand = inv ? inv.qtyOnHand : 0;
    const qtyReserved = inv ? inv.qtyReserved : 0;
    const reorderPt = inv ? inv.reorderPt : 5;
    totalStock += qtyOnHand;

    let cleanLocationName = store.city || store.name;
    if (store.code === 'CENTRAL') {
      cleanLocationName = 'Central';
    } else if (store.name.toLowerCase().includes('bengaluru') || store.name.toLowerCase().includes('bangalore')) {
      cleanLocationName = 'Bangalore';
    } else if (store.name.toLowerCase().includes('hyderabad')) {
      cleanLocationName = 'Hyderabad';
    } else if (store.name.toLowerCase().includes('mumbai')) {
      cleanLocationName = 'Mumbai';
    } else if (store.name.toLowerCase().includes('delhi')) {
      cleanLocationName = 'Delhi';
    }

    return {
      storeCode: store.code,
      storeName: store.name,
      displayName: cleanLocationName,
      qtyOnHand,
      qtyReserved,
      reorderPt,
      inStock: qtyOnHand > 0,
    };
  });

  console.log('\n--- Real-Time Store Stock Breakdown ---');
  storeBreakdown.forEach((s) => {
    console.log(`  * ${s.displayName} (${s.storeCode}) — ${s.qtyOnHand} units [${s.inStock ? 'IN STOCK' : 'OUT OF STOCK / 0 UNITS'}]`);
  });

  console.log(`\nTotal Consolidated Stock: ${totalStock} units`);

  // Assertions
  const centralStore = storeBreakdown.find((s) => s.storeCode === 'CENTRAL');
  const blrStore = storeBreakdown.find((s) => s.storeCode === 'BLR');
  const hydStore = storeBreakdown.find((s) => s.storeCode === 'HYD');

  if (!centralStore || centralStore.qtyOnHand !== 25) {
    throw new Error(`Expected CENTRAL to have 25 units, got ${centralStore?.qtyOnHand}`);
  }
  if (!blrStore || blrStore.qtyOnHand !== 25) {
    throw new Error(`Expected BLR to have 25 units, got ${blrStore?.qtyOnHand}`);
  }
  if (!hydStore || hydStore.qtyOnHand !== 0) {
    throw new Error(`Expected HYD to be present with 0 units, got ${hydStore?.qtyOnHand}`);
  }
  if (totalStock !== 50) {
    throw new Error(`Expected totalStock to be 50, got ${totalStock}`);
  }

  console.log('\nAll assertions passed successfully!');
  await prisma.$disconnect();
}

verifyStoreStockFeature().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
