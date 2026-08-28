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
    const { id, name, role, store, status, securityLevel, password, shiftStatus } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'User ID is required' }, { status: 400 });
    }

    // Update public.profiles
    const updateData: any = { updated_at: new Date().toISOString() };
    if (name) updateData.name = name;
    if (role) updateData.role = role;
    if (store) updateData.store_scope = store;
    if (status) updateData.status = status;
    if (securityLevel !== undefined) updateData.security_level = securityLevel;
    if (shiftStatus) updateData.shift_status = shiftStatus;

    const { error: profileErr } = await supabaseAdmin.from('profiles').update(updateData).eq('id', id);
    if (profileErr) {
      console.warn('Supabase public.profiles update warning:', profileErr.message);
    }

    // If password update requested, update auth.users
    if (password && id.length > 20) {
      await supabaseAdmin.auth.admin.updateUserById(id, { password });
    }

    return NextResponse.json({
      success: true,
      message: 'User profile updated in Supabase',
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Server error' }, { status: 500 });
  }
}
