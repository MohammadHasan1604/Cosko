/**
 * COSKO — Browser-side Supabase Client
 * Uses @supabase/ssr for proper cookie-based session management in Next.js
 */

import { createBrowserClient } from '@supabase/ssr';

let browserClient: ReturnType<typeof createBrowserClient> | null = null;

export function createSupabaseBrowserClient() {
  if (browserClient) return browserClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      'Missing Supabase environment variables. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your .env file.'
    );
  }

  browserClient = createBrowserClient(url, anonKey);
  return browserClient;
}

/**
 * Convenience singleton for browser-side usage.
 * Safe to import in 'use client' components.
 */
export const supabaseBrowser = (() => {
  // Only create in browser environment
  if (typeof window !== 'undefined') {
    return createSupabaseBrowserClient();
  }
  // Return a proxy that creates on first access during SSR hydration
  return null as unknown as ReturnType<typeof createBrowserClient>;
})();
