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
  const quietStart = process.env.NOTIFICATION_QUIET_START || "22:00";
  const quietEnd = process.env.NOTIFICATION_QUIET_END || "07:00";
  let timeZone = process.env.TASKBOARD_TIMEZONE || "UTC";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(now);
  } catch {
    timeZone = "UTC";
  }
  const localDateParts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const runKey = ["year", "month", "day"]
    .map((key) => localDateParts.find((part) => part.type === key)?.value || "")
    .join("-");
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
  const leadDays = (name: string, fallback: number) => {
    const value = Number(process.env[name]);
    return Number.isInteger(value) && value >= 0 && value <= 30 ? value : fallback;
  };
  const milestoneFields = [
    {
      label: "Deadline",
      field: "deadline",
      days: leadDays("NOTIFICATION_LEAD_DAYS_DEADLINE", 1),
    },
    {
      label: "Dev up",
      field: "dev_up",
      days: leadDays("NOTIFICATION_LEAD_DAYS_DEV_UP", 1),
    },
    {
      label: "Staging up",
      field: "staging_up",
      days: leadDays("NOTIFICATION_LEAD_DAYS_STAGING_UP", 1),
    },
    {
      label: "Release",
      field: "release_at",
      days: leadDays("NOTIFICATION_LEAD_DAYS_RELEASE", 1),
    },
  ] as const;
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
    let claimQuery = client
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
      .eq("channel", "chatwork")
      .eq("status", existingRun.status);
    if (existingRun.status === "pending") {
      claimQuery = claimQuery.lte("lease_until", now.toISOString());
    } else {
      claimQuery = claimQuery.lte("next_attempt_at", now.toISOString());
    }
    const { data: claimed, error: claimError } = await claimQuery
      .select("run_key")
      .maybeSingle();
    if (claimError)
      return NextResponse.json({ error: claimError.message }, { status: 500 });
    if (!claimed) {
      return NextResponse.json({
        ok: true,
        skipped: "already_claimed",
        run_key: runKey,
      });
    }
  }
  const { data, error } = await client
    .from("tasks")
    .select("id, owner_id, code, title, deadline, dev_up, staging_up, release_at")
    .eq("owner_id", ownerId)
    .is("archived_at", null)
    .neq("status", "done");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const notifications = (data || [])
    .flatMap((task) =>
      milestoneFields.flatMap(({ label, field, days }) => {
        const value = task[field];
        if (!value) return [];
        const dueAt = new Date(value).getTime();
        const nowAt = now.getTime();
        return dueAt > nowAt && dueAt <= nowAt + days * 86400000
          ? [{ id: task.id, code: task.code, title: task.title, label, dueAt }]
          : [];
      }),
    )
    .sort((a, b) => a.dueAt - b.dueAt);
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
    return NextResponse.json({
      ok: true,
      skipped: "no_upcoming_milestones",
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
    "[Taskboard Focus] Các mốc sắp tới",
    ...notifications.map(
      (item) =>
        `- ${item.label} · ${item.code || item.id}: ${item.title} · ${new Intl.DateTimeFormat("vi-VN", { timeZone, dateStyle: "medium", timeStyle: "short" }).format(new Date(item.dueAt))}`,
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
