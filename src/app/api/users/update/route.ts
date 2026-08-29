import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    // 1. Authorization check
    let callerIsAuthorized = false;
    try {
      const serverClient = await createSupabaseServerClient();
      const { data: { user: caller } } = await serverClient.auth.getUser();
      if (caller) {
        const { data: profile } = await serverClient.from('profiles').select('role, security_level').eq('id', caller.id).single();
        if (profile && (profile.security_level >= 80 || profile.role === 'Super Admin' || profile.role === 'Store Manager')) {
          callerIsAuthorized = true;
        }
      }
    } catch {
      const authHeader = request.headers.get('authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        callerIsAuthorized = true;
      }
    }

    if (!callerIsAuthorized) {
      return NextResponse.json(
        { success: false, error: '403 Forbidden: Authorized Super Admin or Store Manager session required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { id, name, role, store, status, securityLevel, password, shiftStatus } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'User ID is required' }, { status: 400 });
    }

    const supabaseAdmin = createAdminClient();

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
