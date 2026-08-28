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
    const { id } = await request.json();
    if (!id) {
      return NextResponse.json({ success: false, error: 'User ID is required' }, { status: 400 });
    }

    // Delete from public.profiles
    await supabaseAdmin.from('profiles').delete().eq('id', id);
    // Delete from public.user_store_assignments
    await supabaseAdmin.from('user_store_assignments').delete().eq('user_id', id);

    // Delete from auth.users if UUID
    if (id.length > 20) {
      await supabaseAdmin.auth.admin.deleteUser(id);
    }

    return NextResponse.json({ success: true, message: 'User account removed from Supabase' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Server error' }, { status: 500 });
  }
}
