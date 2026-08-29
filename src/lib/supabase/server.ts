import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xsujcrphkmtprvgncsdw.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhzdWpjcnBoa210cHJ2Z25jc2R3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc5MzIzMTIsImV4cCI6MjEwMzUwODMxMn0.H7lW8Bhs3gN6vHPNTs_RbEZ2vmMoD0QJSuFvJs7aPcs';

export const createServerClient = () => {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false,
    },
  });
};
