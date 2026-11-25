import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json(
      { error: "CRON_SECRET chưa được cấu hình." },
      { status: 503 },
    );
  }
  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const ownerId = process.env.TASKBOARD_OWNER_ID;
  if (!url || !serviceKey || !ownerId) {
    return NextResponse.json(
      { error: "Scheduled notifications chưa được cấu hình service role." },
      { status: 503 },
    );
  }
  const client = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const now = new Date();
  const runKey = now.toISOString().slice(0, 13);
  const horizon = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
  const { error: runError } = await client.from("notification_runs").insert({
    owner_id: ownerId,
    run_key: runKey,
    channel: "chatwork",
  });
  if (runError?.code === "23505") {
    return NextResponse.json({
      ok: true,
      skipped: "already_processed",
      run_key: runKey,
    });
  }
  if (runError) return NextResponse.json({ error: runError.message }, { status: 500 });
  const { data, error } = await client
    .from("tasks")
    .select("id, owner_id, code, title, deadline, priority")
    .eq("owner_id", ownerId)
    .is("archived_at", null)
    .neq("status", "done")
    .not("deadline", "is", null)
    .lte("deadline", horizon)
    .order("deadline");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const notifications = data || [];
  const markSent = async () => {
    await client
      .from("notification_runs")
      .update({ sent_at: now.toISOString() })
      .eq("owner_id", ownerId)
      .eq("run_key", runKey)
      .eq("channel", "chatwork");
  };
  if (!notifications.length) {
    await markSent();
    return NextResponse.json({
      ok: true,
      generated_at: now.toISOString(),
      notifications: [],
    });
  }
  const token = process.env.CHATWORK_API_TOKEN?.trim();
  const roomId = process.env.CHATWORK_ROOM_ID?.trim();
  if (!token || !roomId) {
    return NextResponse.json({
      ok: true,
      delivery: "pending",
      reason: "Chatwork credentials chưa cấu hình.",
      generated_at: now.toISOString(),
      notifications,
    });
  }
  const body = [
    "[Taskboard Focus] Mốc cần chú ý trong 24 giờ tới",
    ...notifications.map(
      (item) => `- ${item.code || item.id}: ${item.title} · ${item.deadline}`,
    ),
  ].join("\n");
  const response = await fetch(`https://api.chatwork.com/v2/rooms/${roomId}/messages`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
      "x-chatworktoken": token,
    },
    body: new URLSearchParams({ body, self_unread: "1" }),
    cache: "no-store",
  });
  if (!response.ok) {
    return NextResponse.json(
      { error: `Chatwork từ chối request (HTTP ${response.status}).` },
      { status: 502 },
    );
  }
  await markSent();
  return NextResponse.json({
    ok: true,
    delivery: "chatwork",
    generated_at: now.toISOString(),
    count: notifications.length,
  });
}
