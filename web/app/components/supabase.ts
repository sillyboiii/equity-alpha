"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabaseConfigured = Boolean(URL && ANON);

export const supabase: SupabaseClient | null = supabaseConfigured
  ? createClient(URL as string, ANON as string, { auth: { persistSession: true } })
  : null;

export function fmtEmail(email: string): string {
  const [name, domain] = email.split("@");
  if (!domain) return email;
  return `${name.slice(0, 2)}•••@${domain}`;
}
