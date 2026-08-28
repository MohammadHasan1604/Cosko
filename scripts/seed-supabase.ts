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
console.log('COSKO MULTI-STORE ENTERPRISE — SUPABASE PRODUCTION SEEDER');
console.log('====================================================================\n');

async function seedSupabase() {
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  if (!SUPABASE_URL || SUPABASE_URL.includes('your-project') || !SERVICE_ROLE_KEY || SERVICE_ROLE_KEY.includes('your-service-role')) {
    console.error('❌ ERROR: Live Supabase credentials missing in .env file!');
    console.error('Please open .env and set:');
    console.error('  NEXT_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co');
    console.error('  NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>');
    console.error('  SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>\n');
    process.exit(1);
  }

  const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log(`Connecting to Supabase Project: ${SUPABASE_URL}...`);

  // 1. Seed Store Hubs
  console.log('\n--- 1. Seeding Stores / Hubs ---');
  const stores = [
    { code: 'BLR', name: 'Bengaluru Central Hub', city: 'Bengaluru', address: 'Indiranagar 100ft Rd, Bengaluru', manager_name: 'Sneha Patel', phone: '+91 80 2555 1234', registers_count: 4, skus_count: 1420, monthly_revenue: 1450000, status: 'Active' },
    { code: 'HYD', name: 'Hyderabad Warehouse & Outlet', city: 'Hyderabad', address: 'Hitech City Phase 2, Hyderabad', manager_name: 'Priya Sharma', phone: '+91 40 6677 8899', registers_count: 3, skus_count: 980, monthly_revenue: 1120000, status: 'Active' },
    { code: 'DEL', name: 'Delhi NCR Fulfillment Center', city: 'Delhi', address: 'Okhla Industrial Area Ph-III, New Delhi', manager_name: 'Rohan Sharma', phone: '+91 11 4100 9988', registers_count: 5, skus_count: 2100, monthly_revenue: 980000, status: 'Active' },
    { code: 'MUM', name: 'Mumbai Commercial Hub', city: 'Mumbai', address: 'Bandra Kurla Complex, Mumbai', manager_name: 'Rakesh Verma', phone: '+91 22 6688 9900', registers_count: 4, skus_count: 1200, monthly_revenue: 1350000, status: 'Active' },
  ];

  const { data: insertedStores, error: storesError } = await supabaseAdmin.from('stores').upsert(stores, { onConflict: 'code' }).select();
  if (storesError) {
    console.error('⚠️ Stores Seed Warning:', storesError.message);
  } else {
    console.log(`✅ ${insertedStores?.length || stores.length} Store Hubs seeded/updated successfully!`);
  }

  // 2. Seed Users & Auth Accounts
  console.log('\n--- 2. Seeding Auth Users & Profiles ---');
  const usersToSeed = [
    { email: 'cosko@gmail.com', password: 'Cosko2026@', name: 'Super Admin', role: 'Super Admin', security_level: 100, store_scope: 'All Stores' },
    { email: 'sneha@cosko.com', password: 'Password2026@', name: 'Sneha Patel', role: 'Store Manager', security_level: 80, store_scope: 'BLR' },
    { email: 'priya@cosko.com', password: 'Password2026@', name: 'Priya Sharma', role: 'Store Manager', security_level: 80, store_scope: 'HYD' },
    { email: 'rohan@cosko.com', password: 'Password2026@', name: 'Rohan Sharma', role: 'Inventory Auditor', security_level: 60, store_scope: 'DEL' },
    { email: 'karan@cosko.com', password: 'Password2026@', name: 'Karan Verma', role: 'POS Cashier', security_level: 20, store_scope: 'HYD' },
    { email: 'pooja@cosko.com', password: 'Password2026@', name: 'Pooja Deshmukh', role: 'Sales Executive', security_level: 40, store_scope: 'BLR' },
    { email: 'rakesh@cosko.com', password: 'Password2026@', name: 'Rakesh Verma', role: 'Store Manager', security_level: 80, store_scope: 'MUM' },
  ];

  for (const u of usersToSeed) {
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existing = existingUsers?.users?.find((usr) => usr.email?.toLowerCase() === u.email.toLowerCase());

    let userId = existing?.id;
    if (!userId) {
      const { data: newUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email: u.email,
        password: u.password,
        email_confirm: true,
        user_metadata: { name: u.name, role: u.role, store: u.store_scope },
      });
      if (createErr) {
        console.error(`⚠️ Auth User Creation Error (${u.email}):`, createErr.message);
      } else {
        userId = newUser.user?.id;
        console.log(`✅ Auth user created: ${u.email}`);
      }
    } else {
      console.log(`ℹ️ Auth user already exists: ${u.email}`);
    }

    if (userId) {
      const profileData = {
        id: userId,
        name: u.name,
        email: u.email,
        role: u.role,
        security_level: u.security_level,
        store_scope: u.store_scope,
        status: 'Active',
        shift_status: 'On Shift',
      };

      const { error: profileErr } = await supabaseAdmin.from('profiles').upsert(profileData, { onConflict: 'id' });
      if (profileErr) {
        console.error(`⚠️ Profile Upsert Error (${u.email}):`, profileErr.message);
      } else {
        console.log(`✅ Profile synced for ${u.name} (${u.role})`);
      }

      if (u.store_scope && u.store_scope !== 'All Stores') {
        await supabaseAdmin.from('user_store_assignments').upsert(
          { profile_id: userId, store_code: u.store_scope },
          { onConflict: 'profile_id,store_code' }
        );
      }
    }
  }

  // 3. Seed Products & Inventory
  console.log('\n--- 3. Seeding Products & Inventory ---');
  const products = [
    { sku: 'SKU-0091', barcode: '8901234567890', name: 'Crompton Fan Regulator 5-Speed', category: 'Electricals', cost_price: 320, selling_price: 485, mrp: 550, gst_rate: 18, hsn_code: '84145990', reorder_level: 8, status: 'Active' },
    { sku: 'SKU-0218', barcode: '8901234567891', name: 'Philips LED 9W Warm White (Pack of 6)', category: 'Lighting', cost_price: 480, selling_price: 680, mrp: 750, gst_rate: 12, hsn_code: '85395000', reorder_level: 20, status: 'Active' },
    { sku: 'SKU-0312', barcode: '8901234567892', name: 'Anchor Roma 3-Pin 6A Plug Top', category: 'Electricals', cost_price: 28, selling_price: 45, mrp: 55, gst_rate: 18, hsn_code: '85364900', reorder_level: 50, status: 'Active' },
    { sku: 'SKU-0562', barcode: '8901234567893', name: 'Polycab 1.5 Sq mm FR Wire 90m Coil', category: 'Wiring', cost_price: 1850, selling_price: 2400, mrp: 2650, gst_rate: 18, hsn_code: '85444900', reorder_level: 12, status: 'Active' },
    { sku: 'SKU-0834', barcode: '8901234567894', name: 'Havells Crabtree 6A Switch 1-Way', category: 'Electricals', cost_price: 65, selling_price: 95, mrp: 115, gst_rate: 18, hsn_code: '85365000', reorder_level: 15, status: 'Active' },
  ];

  const { data: insertedProducts, error: prodErr } = await supabaseAdmin.from('products').upsert(products, { onConflict: 'sku' }).select();
  if (prodErr) {
    console.error('⚠️ Products Seed Warning:', prodErr.message);
  } else {
    console.log(`✅ ${insertedProducts?.length || products.length} Products seeded!`);
  }

  console.log('\n====================================================================');
  console.log('🎉 SUPABASE SEEDING COMPLETE!');
  console.log('====================================================================\n');
}

seedSupabase().catch((err) => {
  console.error('Fatal Seeding Exception:', err);
});
