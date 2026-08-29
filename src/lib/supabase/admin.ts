/**
 * COSKO — Privileged Server-Side Admin Supabase Client
 * Uses SUPABASE_SERVICE_ROLE_KEY to bypass Row Level Security.
 * STRICTLY SERVER-ONLY. Never import or expose to browser/client components.
 */

import { createClient } from '@supabase/supabase-js';

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (typeof window !== 'undefined') {
    throw new Error('CRITICAL SECURITY ERROR: Admin client cannot be instantiated in the browser context.');
  }

  if (!url || !serviceRoleKey) {
    throw new Error(
      'Missing Supabase admin credentials. Ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are defined in environment.'
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
