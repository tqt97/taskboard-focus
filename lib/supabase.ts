import { createClient } from "@supabase/supabase-js";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const isHttpUrl = (value: string | undefined) => {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
};

const normalizedUrl = isHttpUrl(url) ? url : null;
const normalizedAnon = anon?.trim() || "";
export const supabase =
  normalizedUrl && normalizedAnon ? createClient(normalizedUrl, normalizedAnon) : null;
