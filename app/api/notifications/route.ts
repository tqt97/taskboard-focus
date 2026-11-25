import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isWithinQuietHours } from "@/lib/taskboard/notifications";

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
  const quietStart = process.env.NOTIFICATION_QUIET_START || "22:00";
  const quietEnd = process.env.NOTIFICATION_QUIET_END || "07:00";
  const timeZone = process.env.TASKBOARD_TIMEZONE || "UTC";
  if (isWithinQuietHours(now, quietStart, quietEnd, timeZone)) {
    return NextResponse.json({
      ok: true,
      skipped: "quiet_hours",
      quiet_start: quietStart,
      quiet_end: quietEnd,
      timezone: timeZone,
      run_key: runKey,
    });
  }
  const horizon = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
  const { data: existingRun, error: existingRunError } = await client
    .from("notification_runs")
    .select("status, attempts, lease_until, next_attempt_at")
    .eq("owner_id", ownerId)
    .eq("run_key", runKey)
    .eq("channel", "chatwork")
    .maybeSingle();
  if (existingRunError)
    return NextResponse.json({ error: existingRunError.message }, { status: 500 });
  if (existingRun?.status === "sent") {
    return NextResponse.json({
      ok: true,
      skipped: "already_processed",
      run_key: runKey,
    });
  }
  if (
    existingRun?.status === "pending" &&
    existingRun.lease_until &&
    new Date(existingRun.lease_until).getTime() > now.getTime()
  ) {
    return NextResponse.json({
      ok: true,
      skipped: "in_progress",
      retry_at: existingRun.lease_until,
      run_key: runKey,
    });
  }
  if (
    existingRun?.next_attempt_at &&
    new Date(existingRun.next_attempt_at).getTime() > now.getTime()
  ) {
    return NextResponse.json({
      ok: true,
      skipped: "retry_backoff",
      retry_at: existingRun.next_attempt_at,
      run_key: runKey,
    });
  }
  const attempts = Number(existingRun?.attempts || 0) + 1;
  const leaseUntil = new Date(now.getTime() + 5 * 60 * 1000).toISOString();
  if (!existingRun) {
    const { error: insertError } = await client.from("notification_runs").insert({
      owner_id: ownerId,
      run_key: runKey,
      channel: "chatwork",
      status: "pending",
      attempts,
      lease_until: leaseUntil,
      next_attempt_at: null,
      last_error: null,
    });
    if (insertError) {
      if (insertError.code === "23505") {
        return NextResponse.json({
          ok: true,
          skipped: "in_progress",
          retry_at: leaseUntil,
          run_key: runKey,
        });
      }
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }
  } else {
    const { error: claimError } = await client
      .from("notification_runs")
      .update({
        status: "pending",
        attempts,
        lease_until: leaseUntil,
        next_attempt_at: null,
        last_error: null,
      })
      .eq("owner_id", ownerId)
      .eq("run_key", runKey)
      .eq("channel", "chatwork");
    if (claimError)
      return NextResponse.json({ error: claimError.message }, { status: 500 });
  }
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
      .update({
        status: "sent",
        sent_at: now.toISOString(),
        lease_until: null,
        next_attempt_at: null,
      })
      .eq("owner_id", ownerId)
      .eq("run_key", runKey)
      .eq("channel", "chatwork");
  };
  const markFailed = async (message: string) => {
    const delayMinutes = Math.min(60, 2 ** Math.min(attempts - 1, 5));
    const nextAttemptAt = new Date(now.getTime() + delayMinutes * 60000).toISOString();
    await client
      .from("notification_runs")
      .update({
        status: "failed",
        lease_until: null,
        last_error: message.slice(0, 500),
        next_attempt_at: nextAttemptAt,
      })
      .eq("owner_id", ownerId)
      .eq("run_key", runKey)
      .eq("channel", "chatwork");
    return nextAttemptAt;
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
    const retryAt = await markFailed("Chatwork credentials chưa cấu hình.");
    return NextResponse.json({
      ok: true,
      delivery: "pending",
      reason: "Chatwork credentials chưa cấu hình.",
      retry_at: retryAt,
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
    const retryAt = await markFailed(
      `Chatwork từ chối request (HTTP ${response.status}).`,
    );
    return NextResponse.json(
      {
        error: `Chatwork từ chối request (HTTP ${response.status}).`,
        retry_at: retryAt,
      },
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
