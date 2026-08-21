import { createClient } from '@supabase/supabase-js';
import type { Database } from '../../types/database';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || (import.meta.env as any).VITE_SUPABASE_UR || 'https://paefckmkawocjxzuoclq.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBhZWZja21rYXdvY2p4enVvY2xxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ5ODM5MDUsImV4cCI6MjEwMDU1OTkwNX0.9_FCFsaktXqmAyFcQi4jENaxj2TF2xRNREREwUN8Pio';

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient<any>(supabaseUrl, supabaseAnonKey);

