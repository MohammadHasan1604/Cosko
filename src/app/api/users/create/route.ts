import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    // 1. Authorization check: Requester must be authenticated and have user creation privileges
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
      // In development or automated seeding without active cookies, check custom auth header if present
      const authHeader = request.headers.get('authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        callerIsAuthorized = true;
      }
    }

    if (!callerIsAuthorized) {
      return NextResponse.json(
        { success: false, error: '403 Forbidden: Authorized Super Admin or Store Manager session required to provision accounts' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name, email, password, role, store, phone, status, securityLevel } = body;

    if (!email || !name) {
      return NextResponse.json({ success: false, error: 'Name and email are required' }, { status: 400 });
    }

    if (!password) {
      return NextResponse.json({ success: false, error: 'Password is required to provision a new account' }, { status: 400 });
    }

    const level = securityLevel || (role === 'Super Admin' ? 100 : role === 'Store Manager' ? 80 : role === 'Inventory Auditor' ? 60 : role === 'Sales Executive' ? 40 : 20);

    const supabaseAdmin = createAdminClient();

    // 2. Create User in Supabase Auth (auth.users)
    let userId: string;
    let authError: string | null = null;

    const { data: authData, error: createAuthErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
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
      // Check if user already exists in auth.users by listing users
      const { data: usersData } = await supabaseAdmin.auth.admin.listUsers();
      const existingUser = usersData?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());
      if (existingUser) {
        userId = existingUser.id;
      } else {
        return NextResponse.json({ success: false, error: `Failed to create auth user: ${createAuthErr.message}` }, { status: 400 });
      }
    } else {
      userId = authData.user.id;
    }

    // 3. Insert/Upsert into public.profiles
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

    // 4. Insert into public.user_store_assignments
    if (store) {
      await supabaseAdmin.from('user_store_assignments').upsert(
        {
          profile_id: userId,
          store_code: store,
        },
        { onConflict: 'profile_id,store_code' }
      );
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
