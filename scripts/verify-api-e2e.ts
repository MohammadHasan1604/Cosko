import { signSessionToken } from '../src/lib/auth';

async function runApiTests() {
  const baseUrl = 'http://localhost:4028';
  console.log('================================================================');
  console.log('  COSKO END-TO-END HTTP API & PERSISTENCE VERIFICATION SUITE   ');
  console.log('================================================================\n');

  const token = signSessionToken({
    id: 'usr-admin',
    name: 'Super Admin',
    email: 'cosko@gmail.com',
    role: 'Super Admin',
    securityLevel: 100,
    store: 'BLR',
    avatar: 'SA',
    shiftStatus: 'On Shift',
  });

  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    'Cookie': `cosko_session=${token}`,
  };

  let passed = 0;
  let total = 0;

  async function check(name: string, fn: () => Promise<void>) {
    total++;
    try {
      await fn();
      console.log(`  [PASS] ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`  [FAIL] ${name}: ${err.message}`);
    }
  }

  // 1. Categories API
  await check('API /api/categories: Cache-Control, Create -> Verify -> Delete -> Verify Non-Reappearance', async () => {
    const slug = `http-cat-${Date.now()}`;
    const createRes = await fetch(`${baseUrl}/api/categories`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        name: 'HTTP Test Category',
        slug,
        categoryType: 'Device',
        status: 'Active',
      }),
    });
    if (!createRes.ok) throw new Error(`Create failed: ${createRes.status}`);
    const createData = await createRes.json();
    const catId = createData.category?.id || createData.id;

    // Fetch and check cache headers
    const get1 = await fetch(`${baseUrl}/api/categories`, { headers: authHeaders });
    const cacheControl = get1.headers.get('cache-control');
    if (!cacheControl || !cacheControl.includes('no-store')) {
      throw new Error(`Expected Cache-Control: no-store, got: ${cacheControl}`);
    }
    const data1 = await get1.json();
    const found1 = data1.categories?.find((c: any) => c.slug === slug || c.id === catId);
    if (!found1) throw new Error('Created category not found in GET response');

    // Delete
    const delRes = await fetch(`${baseUrl}/api/categories?id=${encodeURIComponent(catId)}&permanent=true`, {
      method: 'DELETE',
      headers: authHeaders,
    });
    if (!delRes.ok) throw new Error(`Delete failed: ${delRes.status}`);

    // Verify gone on second fetch (simulating page refresh)
    const get2 = await fetch(`${baseUrl}/api/categories`, { headers: authHeaders });
    const data2 = await get2.json();
    const found2 = data2.categories?.find((c: any) => c.slug === slug || c.id === catId);
    if (found2) throw new Error('Deleted category reappeared in GET response!');
  });

  // 2. Customers API
  await check('API /api/customers: Create -> Verify -> Delete -> Verify Non-Reappearance', async () => {
    const phone = `9188${Math.floor(100000 + Math.random() * 900000)}`;
    const createRes = await fetch(`${baseUrl}/api/customers`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        name: 'HTTP Test Customer',
        phone,
        email: `http-cust-${Date.now()}@cosko.com`,
        city: 'Bengaluru',
      }),
    });
    if (!createRes.ok) {
      const errText = await createRes.text();
      throw new Error(`Create failed: ${createRes.status} ${errText}`);
    }
    const createData = await createRes.json();
    const custId = createData.customer?.id || createData.id;

    // Fetch
    const get1 = await fetch(`${baseUrl}/api/customers`, { headers: authHeaders });
    const data1 = await get1.json();
    const found1 = data1.customers?.find((c: any) => c.id === custId || c.phone === phone);
    if (!found1) throw new Error('Created customer not found in GET response');

    // Delete
    const delRes = await fetch(`${baseUrl}/api/customers?id=${encodeURIComponent(custId)}&permanent=true`, {
      method: 'DELETE',
      headers: authHeaders,
    });
    if (!delRes.ok) throw new Error(`Delete failed: ${delRes.status}`);

    // Verify gone
    const get2 = await fetch(`${baseUrl}/api/customers`, { headers: authHeaders });
    const data2 = await get2.json();
    const found2 = data2.customers?.find((c: any) => c.id === custId || c.phone === phone);
    if (found2) throw new Error('Deleted customer reappeared in GET response!');
  });

  // 3. Vendors API
  await check('API /api/vendors: Create -> Verify -> Delete -> Verify Non-Reappearance', async () => {
    const code = `VND-HTTP-${Math.floor(1000 + Math.random() * 9000)}`;
    const createRes = await fetch(`${baseUrl}/api/vendors`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        name: 'HTTP Test Supplier',
        code,
        category: 'Spare Parts',
        contactPerson: 'Karan Mehra',
        email: 'karan@supplier.com',
        phone: '+91 80 5544 3322',
        city: 'Bengaluru',
      }),
    });
    if (!createRes.ok) throw new Error(`Create failed: ${createRes.status}`);
    const createData = await createRes.json();
    const vendId = createData.vendor?.id || createData.id;

    // Fetch
    const get1 = await fetch(`${baseUrl}/api/vendors`, { headers: authHeaders });
    const data1 = await get1.json();
    const found1 = data1.vendors?.find((v: any) => v.id === vendId || v.code === code);
    if (!found1) throw new Error('Created vendor not found in GET response');

    // Delete
    const delRes = await fetch(`${baseUrl}/api/vendors?id=${encodeURIComponent(vendId)}&permanent=true`, {
      method: 'DELETE',
      headers: authHeaders,
    });
    if (!delRes.ok) throw new Error(`Delete failed: ${delRes.status}`);

    // Verify gone
    const get2 = await fetch(`${baseUrl}/api/vendors`, { headers: authHeaders });
    const data2 = await get2.json();
    const found2 = data2.vendors?.find((v: any) => v.id === vendId || v.code === code);
    if (found2) throw new Error('Deleted vendor reappeared in GET response!');
  });

  // 4. Inventory API
  await check('API /api/inventory: Create -> Verify -> Delete -> Verify Non-Reappearance', async () => {
    const sku = `HTTP-SKU-${Date.now()}`;
    const createRes = await fetch(`${baseUrl}/api/inventory`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        sku,
        name: 'HTTP Test Display Screen',
        category: 'Spare Part',
        brand: 'Apple',
        store: 'BLR',
        costPrice: 5000,
        sellingPrice: 7500,
        mrp: 8999,
        qtyOnHand: 2,
        status: 'active',
      }),
    });
    if (!createRes.ok) throw new Error(`Create failed: ${createRes.status}`);
    const createData = await createRes.json();
    const prodId = createData.product?.id || createData.id;

    // Fetch
    const get1 = await fetch(`${baseUrl}/api/inventory`, { headers: authHeaders });
    const data1 = await get1.json();
    const found1 = (data1.products || data1.items || data1.inventory || data1)?.find((i: any) => i.id === prodId || i.sku === sku);
    if (!found1) throw new Error('Created inventory item not found in GET response');

    // Delete
    const delRes = await fetch(`${baseUrl}/api/inventory?id=${encodeURIComponent(prodId)}&permanent=true`, {
      method: 'DELETE',
      headers: authHeaders,
    });
    if (!delRes.ok) throw new Error(`Delete failed: ${delRes.status}`);

    // Verify gone
    const get2 = await fetch(`${baseUrl}/api/inventory`, { headers: authHeaders });
    const data2 = await get2.json();
    const found2 = (data2.products || data2.items || data2.inventory || data2)?.find((i: any) => i.id === prodId || i.sku === sku);
    if (found2) throw new Error('Deleted inventory item reappeared in GET response!');
  });

  console.log(`\n================================================================`);
  console.log(`  RESULTS: ${passed} / ${total} HTTP API END-TO-END TESTS PASSED `);
  console.log(`================================================================\n`);

  if (passed !== total) {
    process.exit(1);
  }
}

runApiTests().catch((e) => {
  console.error(e);
  process.exit(1);
});
