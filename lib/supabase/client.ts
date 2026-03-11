/**
 * Browser-side Supabase client.
 *
 * Uses the public anon key so it can be safely included in client bundles.
 * For server-side operations that need elevated privileges, use
 * {@link getServiceClient} from `lib/supabase/server.ts` instead.
 * @module
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!;

/** Singleton browser Supabase client (anon key, RLS-restricted). */
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
