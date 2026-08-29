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

    const { id } = await request.json();
    if (!id) {
      return NextResponse.json({ success: false, error: 'User ID is required' }, { status: 400 });
    }

    const supabaseAdmin = createAdminClient();

    // Delete from public.profiles
    await supabaseAdmin.from('profiles').delete().eq('id', id);
    // Delete from public.user_store_assignments
    await supabaseAdmin.from('user_store_assignments').delete().eq('profile_id', id);

    // Delete from auth.users if valid UUID
    if (id.length > 20) {
      await supabaseAdmin.auth.admin.deleteUser(id);
    }

    return NextResponse.json({ success: true, message: 'User account removed from Supabase' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Server error' }, { status: 500 });
  }
}
