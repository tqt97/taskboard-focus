import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type SubscriptionPayload = {
  endpoint?: unknown;
  keys?: { p256dh?: unknown; auth?: unknown };
};

async function getOwnerClient(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const ownerId = process.env.TASKBOARD_OWNER_ID;
  const authorization = request.headers.get("authorization");
  if (!url || !anonKey || !ownerId || !authorization?.startsWith("Bearer ")) {
    return {
      error: NextResponse.json({ error: "Cần đăng nhập owner." }, { status: 401 }),
    };
  }
  const client = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: authorization } },
  });
  const { data, error } = await client.auth.getUser(
    authorization.slice("Bearer ".length).trim(),
  );
  if (error || !data.user) {
    return {
      error: NextResponse.json(
        { error: "Phiên đăng nhập không hợp lệ." },
        { status: 401 },
      ),
    };
  }
  if (data.user.id !== ownerId) {
    return {
      error: NextResponse.json(
        { error: "Chỉ owner được quản lý push subscription." },
        { status: 403 },
      ),
    };
  }
  return { client, ownerId };
}

export async function POST(request: Request) {
  if (Number(request.headers.get("content-length") || 0) > 8192) {
    return NextResponse.json(
      { error: "Subscription vượt quá giới hạn." },
      { status: 413 },
    );
  }
  const auth = await getOwnerClient(request);
  if ("error" in auth) return auth.error;
  let body: SubscriptionPayload;
  try {
    body = (await request.json()) as SubscriptionPayload;
  } catch {
    return NextResponse.json({ error: "Subscription không hợp lệ." }, { status: 400 });
  }
  const endpoint = typeof body.endpoint === "string" ? body.endpoint : "";
  const p256dh = body.keys?.p256dh;
  const authKey = body.keys?.auth;
  try {
    if (new URL(endpoint).protocol !== "https:") throw new Error("invalid protocol");
  } catch {
    return NextResponse.json(
      { error: "Push endpoint phải là HTTPS." },
      { status: 400 },
    );
  }
  if (
    endpoint.length > 2048 ||
    typeof p256dh !== "string" ||
    p256dh.length > 256 ||
    typeof authKey !== "string" ||
    authKey.length > 128
  ) {
    return NextResponse.json({ error: "Push keys không hợp lệ." }, { status: 400 });
  }
  const { error } = await auth.client
    .from("push_subscriptions")
    .upsert(
      { owner_id: auth.ownerId, endpoint, p256dh, auth: authKey },
      { onConflict: "owner_id,endpoint" },
    );
  if (error) {
    return NextResponse.json(
      { error: "Không thể lưu push subscription." },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const auth = await getOwnerClient(request);
  if ("error" in auth) return auth.error;
  let body: { endpoint?: unknown };
  try {
    body = (await request.json()) as { endpoint?: unknown };
  } catch {
    return NextResponse.json({ error: "Endpoint không hợp lệ." }, { status: 400 });
  }
  if (typeof body.endpoint !== "string" || body.endpoint.length > 2048) {
    return NextResponse.json({ error: "Endpoint không hợp lệ." }, { status: 400 });
  }
  const { error } = await auth.client
    .from("push_subscriptions")
    .delete()
    .eq("owner_id", auth.ownerId)
    .eq("endpoint", body.endpoint);
  if (error) {
    return NextResponse.json(
      { error: "Không thể xóa push subscription." },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true });
}
