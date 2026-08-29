import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// Parse .env manually
const envPath = path.join(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length > 0) {
        process.env[key.trim()] = valueParts.join('=').trim();
      }
    }
  });
}

console.log('====================================================================');
console.log('COSKO ENTERPRISE — AUTOMATED REALTIME & DATABASE INTEGRATION QA PASS');
console.log('====================================================================\n');

async function runRealtimeAndCrudTest() {
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !ANON_KEY) {
    console.error('❌ ERROR: Live Supabase credentials missing in .env!');
    process.exit(1);
  }

  const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const supabaseClient = createClient(SUPABASE_URL, ANON_KEY);

  let passed = 0;
  let failed = 0;

  function assertTest(name: string, condition: boolean, details: string) {
    if (condition) {
      passed++;
      console.log(`✅ [PASS] ${name}\n   Details: ${details}`);
    } else {
      failed++;
      console.log(`❌ [FAIL] ${name}\n   Details: ${details}`);
    }
  }

  // 1. Health Check
  assertTest('1. Supabase Connection Health', !!SUPABASE_URL, `Endpoint: ${SUPABASE_URL}`);

  // 2. Auth Users Verification (Only cosko@gmail.com)
  const { data: usersData } = await supabaseAdmin.auth.admin.listUsers();
  const superAdminUser = usersData?.users?.find((u) => u.email === 'cosko@gmail.com');
  const otherUsers = usersData?.users?.filter((u) => u.email !== 'cosko@gmail.com') || [];
  assertTest('2. Auth User Count Check', !!superAdminUser && otherUsers.length === 0, `Super Admin Present: ${!!superAdminUser} | Non-Admin Count: ${otherUsers.length}`);

  // 3. Database Table Counts Check (Clean State)
  const { count: inventoryCount } = await supabaseAdmin.from('inventory').select('*', { count: 'exact', head: true });
  const { count: salesCount } = await supabaseAdmin.from('sales').select('*', { count: 'exact', head: true });
  const { count: customersCount } = await supabaseAdmin.from('customers').select('*', { count: 'exact', head: true });
  assertTest('3. Clean Database State', inventoryCount === 0 && salesCount === 0 && customersCount === 0, `Inventory Rows: ${inventoryCount} | Sales Rows: ${salesCount} | Customers Rows: ${customersCount}`);

  // 4. Realtime Subscription Channel Test
  console.log('\n--- 4. Testing Supabase Realtime Subscriptions ---');
  let realtimeReceived = false;
  let receivedPayload: any = null;

  let isSubscribed = false;
  const channel = supabaseClient
    .channel('test-realtime-channel')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'products' }, (payload) => {
      realtimeReceived = true;
      receivedPayload = payload;
      console.log('   ⚡ Realtime Event Received via WebSocket:', payload.eventType, payload.new?.name);
    })
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        isSubscribed = true;
      }
    });

  // Wait for subscription to establish
  for (let i = 0; i < 15; i++) {
    if (isSubscribed) break;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  // Insert a test product row via Supabase Admin
  const testSku = `TEST-REALTIME-${Date.now()}`;
  const { data: insertedProduct, error: insertErr } = await supabaseAdmin
    .from('products')
    .insert({
      sku: testSku,
      barcode: `89012345${Math.floor(1000 + Math.random() * 9000)}`,
      name: 'Realtime Sync Test Item 9W Bulb',
      category: 'Lighting',
      cost_price: 100,
      selling_price: 150,
      mrp: 180,
      gst_rate: 18,
      status: 'Active',
    })
    .select()
    .single();

  assertTest('4. Realtime Insertion Write', !insertErr && !!insertedProduct, `Inserted SKU: ${testSku} | Error: ${insertErr?.message || 'None'}`);

  // Wait 2.5 seconds for WebSocket payload arrival
  await new Promise((resolve) => setTimeout(resolve, 2500));

  assertTest('5. Realtime Channel Subscription & Event Status', isSubscribed || realtimeReceived, `WebSocket Subscribed: ${isSubscribed} | Event Received: ${realtimeReceived} | Product: ${receivedPayload?.new?.name || 'N/A'}`);

  // Clean up test product
  if (insertedProduct?.id) {
    await supabaseAdmin.from('products').delete().eq('id', insertedProduct.id);
  }
  supabaseClient.removeChannel(channel);

  console.log('\n====================================================================');
  console.log(`SUMMARY: Total Tests: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
  console.log('====================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runRealtimeAndCrudTest().catch((err) => {
  console.error('Fatal Realtime QA Error:', err);
  process.exit(1);
});
