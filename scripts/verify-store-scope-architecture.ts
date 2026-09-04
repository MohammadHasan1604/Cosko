import { prisma } from '../src/lib/db';
import { NextRequest } from 'next/server';
import { DELETE as deleteStore, POST as saveStore } from '../src/app/api/stores/route';
import { POST as saveInventory } from '../src/app/api/inventory/route';
import { POST as executeSale } from '../src/app/api/sales/route';
import { POST as executeTransfer } from '../src/app/api/transfers/route';
import { signSessionToken, SessionUser } from '../src/lib/auth';

interface TestResult {
  group: string;
  name: string;
  passed: boolean;
  message: string;
}

const results: TestResult[] = [];

function record(group: string, name: string, passed: boolean, message: string) {
  results.push({ group, name, passed, message });
  const icon = passed ? '✅ [PASS]' : '❌ [FAIL]';
  console.log(`  ${icon} ${name}: ${message}`);
}

async function runSuite() {
  console.log('===============================================================');
  console.log('🏛️ COSKO PRODUCTION — STORE SCOPE ARCHITECTURE VERIFICATION');
  console.log('===============================================================\n');

  // Generate mock authenticated cookies for Super Admin
  const mockUser: SessionUser = {
    id: 'usr-super-admin',
    email: 'cosko@gmail.com',
    name: 'Super Admin',
    role: 'Super Admin',
    store: 'CENTRAL',
    allowedStores: ['CENTRAL', 'BLR', 'HYD', 'DEL', 'MUM'],
    securityLevel: 100,
    avatar: 'SA',
    shiftStatus: 'On Shift',
    mustChangePassword: false,
  };
  const superAdminToken = signSessionToken(mockUser);

  const authHeaders = {
    'Content-Type': 'application/json',
    Cookie: `cosko_session=${superAdminToken}`,
  };

  // Group 1: Central Warehouse Permanent Hub Protection
  console.log('--- Test Group 1: Permanent Central Warehouse Protection ---');
  try {
    const centralInDb = await prisma.storeHub.findUnique({ where: { code: 'CENTRAL' } });
    const exists = !!centralInDb && centralInDb.status === 'Active';
    record(
      'Group 1',
      'Central Warehouse exists and is Active in MySQL',
      exists,
      `Central Hub: ${centralInDb?.name || 'Not found'} (${centralInDb?.status})`
    );

    // Attempt to delete CENTRAL via DELETE API
    const reqDeleteCentral = new NextRequest('http://localhost/api/stores?id=CENTRAL&permanent=true', {
      method: 'DELETE',
      headers: authHeaders,
    });
    const resDeleteCentral = await deleteStore(reqDeleteCentral);
    const deleteJson = await resDeleteCentral.json();
    const deleteBlocked = resDeleteCentral.status === 400 && deleteJson.error?.includes('permanent and cannot be deactivated or deleted');
    record(
      'Group 1',
      'API strictly blocks deleting/deactivating CENTRAL',
      deleteBlocked,
      `Status: ${resDeleteCentral.status}, Message: "${deleteJson.error}"`
    );

    // Verify CENTRAL remains Active in DB
    const centralAfter = await prisma.storeHub.findUnique({ where: { code: 'CENTRAL' } });
    record(
      'Group 1',
      'CENTRAL remains fully Active and untouched in MySQL',
      centralAfter?.status === 'Active',
      `Status in DB: ${centralAfter?.status}`
    );
  } catch (err: any) {
    record('Group 1', 'Central Warehouse Protection Suite', false, err.message);
  }

  // Group 2: All Stores Cannot Be Created as a Store Hub
  console.log('\n--- Test Group 2: Rejection of "All Stores" as a Physical Store ---');
  try {
    const reqCreateAll = new NextRequest('http://localhost/api/stores', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        code: 'ALL',
        name: 'All Stores (Enterprise)',
        city: 'Virtual',
      }),
    });
    const resCreateAll = await saveStore(reqCreateAll);
    const createAllJson = await resCreateAll.json();
    const createAllBlocked = resCreateAll.status === 400 && createAllJson.error?.includes('reporting/aggregation scope only');
    record(
      'Group 2',
      'POST /api/stores rejects code "ALL"',
      createAllBlocked,
      `Status: ${resCreateAll.status}, Error: "${createAllJson.error}"`
    );

    const reqCreateAllName = new NextRequest('http://localhost/api/stores', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        code: 'TEST',
        name: 'All Stores',
        city: 'Virtual',
      }),
    });
    const resCreateAllName = await saveStore(reqCreateAllName);
    const createAllNameJson = await resCreateAllName.json();
    const createAllNameBlocked = resCreateAllName.status === 400;
    record(
      'Group 2',
      'POST /api/stores rejects name "All Stores"',
      createAllNameBlocked,
      `Status: ${resCreateAllName.status}, Error: "${createAllNameJson.error}"`
    );

    const allStoreInDb = await prisma.storeHub.findFirst({
      where: {
        OR: [{ code: 'ALL' }, { name: { contains: 'All Stores' } }],
      },
    });
    record(
      'Group 2',
      'MySQL StoreHub table contains 0 "All Stores" rows',
      !allStoreInDb,
      allStoreInDb ? `Found rogue store: ${allStoreInDb.name}` : 'Zero rogue store rows found (Clean)'
    );
  } catch (err: any) {
    record('Group 2', 'All Stores Physical Store Suite', false, err.message);
  }

  // Group 3: Disallowing Inventory, POS Sales & Transfers for "All Stores"
  console.log('\n--- Test Group 3: Disallow Inventory, POS & Transfers for "All Stores" ---');
  try {
    // 1. Inventory creation for 'All Stores'
    const reqInvAll = new NextRequest('http://localhost/api/inventory', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        sku: 'TEST-SKU-ALL',
        name: 'Test All Item',
        store: 'All Stores',
        qtyOnHand: 10,
      }),
    });
    const resInvAll = await saveInventory(reqInvAll);
    const invAllJson = await resInvAll.json();
    const invBlocked = resInvAll.status === 400 && invAllJson.error?.includes('reporting/aggregation scope only');
    record(
      'Group 3',
      'POST /api/inventory rejects assigning stock to "All Stores"',
      invBlocked,
      `Status: ${resInvAll.status}, Error: "${invAllJson.error}"`
    );

    // 2. Sales execution for 'All Stores'
    const reqSaleAll = new NextRequest('http://localhost/api/sales', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        storeCode: 'All Stores',
        customerName: 'Test Buyer',
        customerPhone: '+91 99999 88888',
        subtotal: 100,
        taxTotal: 18,
        discount: 0,
        total: 118,
        paymentMethod: 'Cash',
        items: [{ productId: 'dummy-id', qty: 1, unitPrice: 100 }],
      }),
    });
    const resSaleAll = await executeSale(reqSaleAll);
    const saleAllJson = await resSaleAll.json();
    const saleBlocked = resSaleAll.status === 400 && saleAllJson.error?.includes('reporting scope only');
    record(
      'Group 3',
      'POST /api/sales rejects POS checkout under "All Stores"',
      saleBlocked,
      `Status: ${resSaleAll.status}, Error: "${saleAllJson.error}"`
    );

    // 3. Stock transfer with 'All Stores' as source
    const reqTransferAll = new NextRequest('http://localhost/api/transfers', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        sourceStore: 'All Stores',
        destStore: 'BLR',
        items: [{ productId: 'dummy-id', qty: 1, costPerUnit: 100, transferPricePerUnit: 120 }],
      }),
    });
    const resTransferAll = await executeTransfer(reqTransferAll);
    const transferAllJson = await resTransferAll.json();
    const transferBlocked = resTransferAll.status === 400 && transferAllJson.error?.includes('reporting scope only');
    record(
      'Group 3',
      'POST /api/transfers rejects "All Stores" as transfer source',
      transferBlocked,
      `Status: ${resTransferAll.status}, Error: "${transferAllJson.error}"`
    );
  } catch (err: any) {
    record('Group 3', 'Operations Disallow Suite', false, err.message);
  }

  // Group 4: Real Regional Stores Support & Normal CRUD
  console.log('\n--- Test Group 4: Real Regional Store Support (Add, Edit, Archive) ---');
  try {
    // 1. Create a test regional store
    const testCode = 'KOL';
    const reqCreateRegional = new NextRequest('http://localhost/api/stores', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        code: testCode,
        name: 'Kolkata Tech Hub',
        city: 'Kolkata',
        address: 'Salt Lake Sector V',
        managerName: 'Amitabha Ghosh',
        registersCount: 3,
      }),
    });
    const resCreateRegional = await saveStore(reqCreateRegional);
    const regionalJson = await resCreateRegional.json();
    const regionalCreated = resCreateRegional.status === 201 && regionalJson.store?.code === testCode;
    record(
      'Group 4',
      'Super Admin can create a new regional store (Kolkata)',
      regionalCreated,
      `Created store: ${regionalJson.store?.name} (${regionalJson.store?.code})`
    );

    // 2. Edit regional store
    const reqEditRegional = new NextRequest('http://localhost/api/stores', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        code: testCode,
        name: 'Kolkata Metro Hub (Updated)',
        city: 'Kolkata',
        address: 'Park Street, Kolkata',
      }),
    });
    const resEditRegional = await saveStore(reqEditRegional);
    const editJson = await resEditRegional.json();
    const regionalUpdated = editJson.store?.name === 'Kolkata Metro Hub (Updated)';
    record(
      'Group 4',
      'Super Admin can edit regional store details',
      regionalUpdated,
      `Updated name: "${editJson.store?.name}"`
    );

    // 3. Delete/Archive unused regional store
    const reqDeleteRegional = new NextRequest(`http://localhost/api/stores?id=${testCode}&permanent=true`, {
      method: 'DELETE',
      headers: authHeaders,
    });
    const resDeleteRegional = await deleteStore(reqDeleteRegional);
    const deleteRegJson = await resDeleteRegional.json();
    const regionalDeleted = resDeleteRegional.status === 200 && deleteRegJson.success;
    record(
      'Group 4',
      'Super Admin can safely delete/archive an unused regional store',
      regionalDeleted,
      `Message: "${deleteRegJson.message}"`
    );
  } catch (err: any) {
    record('Group 4', 'Regional Store Support Suite', false, err.message);
  }

  // Summary
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = total - passed;

  console.log('\n===============================================================');
  console.log(`📊 STORE SCOPE ARCHITECTURE TEST SUMMARY:`);
  console.log(`  - Passed: ${passed} / ${total} (${((passed / total) * 100).toFixed(1)}%)`);
  console.log(`  - Failed: ${failed} / ${total}`);
  console.log('===============================================================\n');

  await prisma.$disconnect();

  if (failed > 0) {
    process.exit(1);
  }
}

runSuite().catch((e) => {
  console.error('Fatal test error:', e);
  process.exit(1);
});
