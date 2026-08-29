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
console.log('COSKO SUPABASE CLEANUP — CLEAR ALL DATA EXCEPT SUPER ADMIN');
console.log('====================================================================\n');

async function clearSupabase() {
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('❌ ERROR: Live Supabase credentials missing in .env file!');
    process.exit(1);
  }

  const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log(`Connecting to Supabase Project: ${SUPABASE_URL}...`);

  const adminEmail = 'cosko@gmail.com';

  // 1. Delete Non-Super Admin Auth Users
  console.log('\n--- 1. Cleaning Auth Users (Preserving cosko@gmail.com) ---');
  const { data: usersData, error: listErr } = await supabaseAdmin.auth.admin.listUsers();
  if (listErr) {
    console.error('⚠️ Error listing Auth Users:', listErr.message);
  } else if (usersData && usersData.users) {
    for (const u of usersData.users) {
      if (u.email?.toLowerCase() !== adminEmail.toLowerCase()) {
        console.log(`Deleting Auth User: ${u.email} (${u.id})...`);
        const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(u.id);
        if (delErr) {
          console.error(`⚠️ Failed to delete user ${u.email}:`, delErr.message);
        } else {
          console.log(`✅ Deleted user: ${u.email}`);
        }
      } else {
        console.log(`🔒 Preserved Super Admin user: ${u.email}`);
      }
    }
  }

  // 2. Clear Database Tables
  console.log('\n--- 2. Clearing Database Tables ---');
  const tablesToClear = [
    'sales_items',
    'sales',
    'purchase_items',
    'purchases',
    'stock_transfers',
    'inventory_ledger',
    'repairs_enquiries',
    'customers',
    'vendors',
    'expenses',
    'audit_logs',
    'notifications',
    'inventory',
    'store_invoice_sequences',
  ];

  for (const tbl of tablesToClear) {
    const { error: clearErr } = await supabaseAdmin.from(tbl).delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (clearErr) {
      console.warn(`⚠️ Table ${tbl} clear message:`, clearErr.message);
    } else {
      console.log(`✅ Table "${tbl}" cleared successfully!`);
    }
  }

  // Clear profiles except Super Admin
  const { error: profErr } = await supabaseAdmin.from('profiles').delete().neq('email', adminEmail);
  if (profErr) {
    console.warn('⚠️ Profiles clear message:', profErr.message);
  } else {
    console.log('✅ Profiles table cleared (Super Admin preserved)!');
  }

  console.log('\n====================================================================');
  console.log('🎉 SUPABASE CLEANUP COMPLETE — ALL DEMO DATA REMOVED EXCEPT SUPER ADMIN!');
  console.log('====================================================================\n');
}

clearSupabase().catch((err) => {
  console.error('Fatal cleanup error:', err);
  process.exit(1);
});
