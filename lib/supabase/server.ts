/**
 * Server-side Supabase client.
 *
 * Uses the service role key to bypass Row-Level Security (RLS), giving
 * API routes full read/write access to all tables. Falls back to the
 * public anon key when the service role key is not available (local dev).
 * @module
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Create a Supabase client with service-role privileges.
 * Session persistence is disabled since this runs in stateless API routes.
 */
export function getServiceClient() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });
}
