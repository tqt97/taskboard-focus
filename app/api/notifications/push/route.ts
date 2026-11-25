import { createClient } from "@supabase/supabase-js";
import * as webpush from "web-push";
import { NextRequest, NextResponse } from "next/server";
import { isWithinQuietHours } from "@/lib/taskboard/notifications";

export const dynamic = "force-dynamic";

type PushSubscription = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

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
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
  const vapidSubject = process.env.VAPID_SUBJECT;
  if (
    !url ||
    !serviceKey ||
    !ownerId ||
    !vapidPublicKey ||
    !vapidPrivateKey ||
    !vapidSubject
  ) {
    return NextResponse.json(
      { error: "Push reminder chưa được cấu hình đầy đủ." },
      { status: 503 },
    );
  }
  if (!/^(mailto:.+|https:\/\/.+)$/.test(vapidSubject)) {
    return NextResponse.json(
      { error: "VAPID_SUBJECT phải là mailto: hoặc HTTPS URL." },
      { status: 503 },
    );
  }
  try {
    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
  } catch {
    return NextResponse.json({ error: "VAPID keys không hợp lệ." }, { status: 503 });
  }

  const client = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const now = new Date();
  let timeZone = process.env.TASKBOARD_TIMEZONE || "UTC";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(now);
  } catch {
    timeZone = "UTC";
  }
  if (
    isWithinQuietHours(
      now,
      process.env.NOTIFICATION_QUIET_START || "22:00",
      process.env.NOTIFICATION_QUIET_END || "07:00",
      timeZone,
    )
  ) {
    return NextResponse.json({ ok: true, skipped: "quiet_hours", timezone: timeZone });
  }
  const dateParts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const runKey = ["year", "month", "day"]
    .map((part) => dateParts.find((value) => value.type === part)?.value || "")
    .join("-");
  const { data: subscriptions, error: subscriptionsError } = await client
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("owner_id", ownerId);
  if (subscriptionsError) {
    return NextResponse.json({ error: subscriptionsError.message }, { status: 500 });
  }
  if (!subscriptions?.length) {
    return NextResponse.json({
      ok: true,
      skipped: "no_subscriptions",
      run_key: runKey,
    });
  }

  const leadDays = (name: string) => {
    const value = Number(process.env[name]);
    return Number.isInteger(value) && value >= 0 && value <= 30 ? value : 1;
  };
  const milestones = [
    ["Deadline", "deadline", leadDays("NOTIFICATION_LEAD_DAYS_DEADLINE")],
    ["Dev up", "dev_up", leadDays("NOTIFICATION_LEAD_DAYS_DEV_UP")],
    ["Staging up", "staging_up", leadDays("NOTIFICATION_LEAD_DAYS_STAGING_UP")],
    ["Release", "release_at", leadDays("NOTIFICATION_LEAD_DAYS_RELEASE")],
  ] as const;
  const { data: tasks, error: taskError } = await client
    .from("tasks")
    .select("id, code, title, deadline, dev_up, staging_up, release_at")
    .eq("owner_id", ownerId)
    .is("archived_at", null)
    .neq("status", "done");
  if (taskError)
    return NextResponse.json({ error: taskError.message }, { status: 500 });
  const candidates = (tasks || [])
    .flatMap((task) =>
      milestones.flatMap(([label, field, days]) => {
        const value = task[field];
        if (!value) return [];
        const dueAt = new Date(value).getTime();
        return dueAt > now.getTime() && dueAt <= now.getTime() + days * 86400000
          ? [{ code: task.code || task.id, title: task.title, label, dueAt }]
          : [];
      }),
    )
    .sort((a, b) => a.dueAt - b.dueAt);
  if (!candidates.length) {
    return NextResponse.json({
      ok: true,
      skipped: "no_upcoming_milestones",
      run_key: runKey,
    });
  }

  const { data: existing, error: existingError } = await client
    .from("notification_runs")
    .select("status, attempts, lease_until, next_attempt_at")
    .eq("owner_id", ownerId)
    .eq("run_key", runKey)
    .eq("channel", "webpush")
    .maybeSingle();
  if (existingError)
    return NextResponse.json({ error: existingError.message }, { status: 500 });
  if (existing?.status === "sent") {
    return NextResponse.json({
      ok: true,
      skipped: "already_processed",
      run_key: runKey,
    });
  }
  if (
    existing?.status === "pending" &&
    existing.lease_until &&
    new Date(existing.lease_until).getTime() > now.getTime()
  ) {
    return NextResponse.json({ ok: true, skipped: "in_progress", run_key: runKey });
  }
  if (
    existing?.next_attempt_at &&
    new Date(existing.next_attempt_at).getTime() > now.getTime()
  ) {
    return NextResponse.json({ ok: true, skipped: "retry_backoff", run_key: runKey });
  }
  const attempts = Number(existing?.attempts || 0) + 1;
  const leaseUntil = new Date(now.getTime() + 5 * 60 * 1000).toISOString();
  if (!existing) {
    const { error } = await client.from("notification_runs").insert({
      owner_id: ownerId,
      run_key: runKey,
      channel: "webpush",
      status: "pending",
      attempts,
      lease_until: leaseUntil,
    });
    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({
          ok: true,
          skipped: "already_claimed",
          run_key: runKey,
        });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  } else {
    let claim = client
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
      .eq("channel", "webpush")
      .eq("status", existing.status);
    claim =
      existing.status === "pending"
        ? claim.lte("lease_until", now.toISOString())
        : claim.lte("next_attempt_at", now.toISOString());
    const { data: claimed, error } = await claim.select("run_key").maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!claimed) {
      return NextResponse.json({
        ok: true,
        skipped: "already_claimed",
        run_key: runKey,
      });
    }
  }

  const payload = JSON.stringify({
    title: `${candidates.length} mốc task sắp đến`,
    body: candidates
      .slice(0, 4)
      .map((item) => `${item.label} · ${item.code}: ${item.title}`)
      .join("\n"),
    url: "/today",
    tag: `taskboard-${runKey}`,
  });
  let failures = 0;
  for (const raw of subscriptions as PushSubscription[]) {
    try {
      await webpush.sendNotification(
        { endpoint: raw.endpoint, keys: { p256dh: raw.p256dh, auth: raw.auth } },
        payload,
        { TTL: 3600 },
      );
    } catch (error) {
      const statusCode =
        typeof error === "object" && error && "statusCode" in error
          ? Number(error.statusCode)
          : 0;
      if (statusCode === 404 || statusCode === 410) {
        await client
          .from("push_subscriptions")
          .delete()
          .eq("owner_id", ownerId)
          .eq("endpoint", raw.endpoint);
      } else {
        failures += 1;
      }
    }
  }
  if (failures) {
    const delayMinutes = Math.min(60, 2 ** Math.min(attempts - 1, 5));
    const retryAt = new Date(now.getTime() + delayMinutes * 60000).toISOString();
    await client
      .from("notification_runs")
      .update({
        status: "failed",
        lease_until: null,
        next_attempt_at: retryAt,
        last_error: `${failures} push delivery failed`.slice(0, 500),
      })
      .eq("owner_id", ownerId)
      .eq("run_key", runKey)
      .eq("channel", "webpush");
    return NextResponse.json({ ok: false, retry_at: retryAt }, { status: 502 });
  }
  await client
    .from("notification_runs")
    .update({ status: "sent", sent_at: now.toISOString(), lease_until: null })
    .eq("owner_id", ownerId)
    .eq("run_key", runKey)
    .eq("channel", "webpush");
  return NextResponse.json({ ok: true, delivery: "webpush", count: candidates.length });
}
