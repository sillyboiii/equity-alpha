"use client";

import { supabase, supabaseConfigured } from "./supabase";

const TABLE = "qntl_sync";

export async function pullKey(userId: string, key: string): Promise<{ value: unknown; updatedAt: string } | null> {
  if (!supabaseConfigured || !supabase) return null;
  const { data, error } = await supabase
    .from(TABLE)
    .select("value, updated_at")
    .eq("user_id", userId)
    .eq("key", key)
    .maybeSingle();
  if (error) return null;
  return data ? { value: data.value, updatedAt: data.updated_at } : null;
}

export async function pushKey(userId: string, key: string, value: unknown): Promise<boolean> {
  if (!supabaseConfigured || !supabase) return false;
  const { error } = await supabase.from(TABLE).upsert(
    { user_id: userId, key, value, updated_at: new Date().toISOString() },
    { onConflict: "user_id,key" },
  );
  return !error;
}
