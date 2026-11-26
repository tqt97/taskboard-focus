const isHttpUrl = (value: string | undefined) => {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
};

export const isSupabaseConfigured = Boolean(
  isHttpUrl(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim(),
);

export async function loadCloudModules() {
  const [auth, repository, client] = await Promise.all([
    import("./auth"),
    import("./repositories/task-repository"),
    import("./supabase"),
  ]);
  return { auth, repository, client };
}
