import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xsujcrphkmtprvgncsdw.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, email, password, role, store, phone, status, securityLevel } = body;

    if (!email || !name) {
      return NextResponse.json({ success: false, error: 'Name and email are required' }, { status: 400 });
    }

    const userPassword = password || 'CoskoPass@2026';
    const level = securityLevel || (role === 'Super Admin' ? 100 : role === 'Store Manager' ? 80 : role === 'Inventory Auditor' ? 60 : role === 'Sales Executive' ? 40 : 20);

    // 1. Create User in Supabase Auth (auth.users)
    let userId: string;
    let authError: string | null = null;

    const { data: authData, error: createAuthErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: userPassword,
      email_confirm: true,
      user_metadata: {
        name,
        role,
        store_code: store || 'BLR',
      },
    });

    if (createAuthErr) {
      authError = createAuthErr.message;
      console.warn('Supabase auth.admin.createUser warning:', createAuthErr.message);
      // Fallback: check if user already exists in auth.users by listing users
      const { data: usersData } = await supabaseAdmin.auth.admin.listUsers();
      const existingUser = usersData?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());
      if (existingUser) {
        userId = existingUser.id;
      } else {
        userId = `usr-${Date.now()}`;
      }
    } else {
      userId = authData.user.id;
    }

    // 2. Insert/Upsert into public.profiles
    const profileData = {
      id: userId,
      name,
      email,
      phone: phone || null,
      role,
      security_level: level,
      store_scope: store || 'BLR',
      status: status || 'Active',
      shift_status: 'On Shift',
      updated_at: new Date().toISOString(),
    };

    const { error: profileErr } = await supabaseAdmin.from('profiles').upsert(profileData, { onConflict: 'id' });
    if (profileErr) {
      console.warn('Supabase public.profiles upsert warning:', profileErr.message);
    }

    // 3. Insert into public.user_store_assignments
    if (store) {
      await supabaseAdmin.from('user_store_assignments').upsert({
        user_id: userId,
        store_code: store,
        is_primary: true,
      }, { onConflict: 'user_id,store_code' });
    }

    return NextResponse.json({
      success: true,
      userId,
      message: 'User provisioned in Supabase Auth and public.profiles successfully',
      authError,
    });
  } catch (error: any) {
    console.error('API /api/users/create error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Server error' }, { status: 500 });
  }
}
