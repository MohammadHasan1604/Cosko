import { GET as getStoreStock } from '../src/app/api/inventory/store-stock/route';
import { GET as getInventory } from '../src/app/api/inventory/route';
import { NextRequest } from 'next/server';
import { signSessionToken, SessionUser } from '../src/lib/auth';

async function testApi() {
  console.log('=== TESTING API ENDPOINTS DIRECTLY ===\n');

  // Generate a valid Super Admin auth token
  const testUser: SessionUser = {
    id: 'user-superadmin-test',
    name: 'Super Admin',
    email: 'admin@cosko.com',
    role: 'Super Admin',
    store: 'All Stores',
    securityLevel: 100,
    avatar: 'SA',
    shiftStatus: 'On Shift',
  };
  const token = signSessionToken(testUser);

  // 1. Test /api/inventory/store-stock with SKU APP-7598
  const req1 = new NextRequest('http://localhost:3000/api/inventory/store-stock?sku=APP-7598', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const res1 = await getStoreStock(req1);
  const json1 = await res1.json();
  console.log('/api/inventory/store-stock response status:', res1.status);
  console.log('Success:', json1.success);
  console.log('Product:', json1.product?.name, `(${json1.product?.sku})`);
  console.log('Total Stock:', json1.totalStock);
  console.log('Active Stores Count:', json1.activeStoresCount);
  console.log('Store Allocations:');
  json1.stores.forEach((s: any) => {
    console.log(`  - ${s.displayName} (${s.storeCode}): ${s.qtyOnHand} units [LowStock: ${s.isLowStock}, InStock: ${s.inStock}]`);
  });

  if (!json1.success || json1.totalStock !== 50 || json1.stores.length < 3) {
    throw new Error('API store-stock validation failed!');
  }

  // 2. Test /api/inventory with sku=APP-7598 to verify attached storeStock
  const req2 = new NextRequest('http://localhost:3000/api/inventory?sku=APP-7598', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const res2 = await getInventory(req2);
  const json2 = await res2.json();
  console.log('\n/api/inventory?sku=APP-7598 response status:', res2.status);
  console.log('Attached storeStock:', json2.storeStock);

  if (!json2.success || !Array.isArray(json2.storeStock)) {
    throw new Error('API single product storeStock validation failed!');
  }

  console.log('\nAll API route tests passed with flying colors!');
  const { prisma } = await import('../src/lib/db');
  await prisma.$disconnect();
  process.exit(0);
}

testApi().catch((err) => {
  console.error('API test failed:', err);
  process.exit(1);
});
