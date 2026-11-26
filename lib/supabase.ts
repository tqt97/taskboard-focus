import { createClient } from "@supabase/supabase-js";
import { isSupabaseConfigured } from "./supabase-config.ts";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const normalizedUrl = isSupabaseConfigured ? url : null;
const normalizedAnon = isSupabaseConfigured ? anon?.trim() || "" : "";
export const supabase =
  normalizedUrl && normalizedAnon ? createClient(normalizedUrl, normalizedAnon) : null;
