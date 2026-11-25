export type PushRunState = {
  status: string;
  lease_until?: string | null;
  next_attempt_at?: string | null;
};

export type PushSubscriptionRecord = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

export function validatePushConfig(config: {
  supabaseUrl?: string;
  serviceKey?: string;
  ownerId?: string;
  publicKey?: string;
  privateKey?: string;
  subject?: string;
}) {
  if (
    !config.supabaseUrl ||
    !config.serviceKey ||
    !config.ownerId ||
    !config.publicKey ||
    !config.privateKey ||
    !config.subject
  )
    return "missing" as const;
  if (!/^(mailto:.+|https:\/\/.+)$/.test(config.subject))
    return "invalid_subject" as const;
  return null;
}

export function getPushRunSkipReason(
  run: PushRunState | null | undefined,
  nowMs: number,
) {
  if (!run) return null;
  if (run.status === "sent") return "already_processed" as const;
  if (
    run.status === "pending" &&
    run.lease_until &&
    new Date(run.lease_until).getTime() > nowMs
  )
    return "in_progress" as const;
  if (run.next_attempt_at && new Date(run.next_attempt_at).getTime() > nowMs)
    return "retry_backoff" as const;
  return null;
}

export async function deliverPushNotifications(
  subscriptions: PushSubscriptionRecord[],
  payload: string,
  send: (subscription: PushSubscriptionRecord, payload: string) => Promise<void>,
  removeExpired: (endpoint: string) => Promise<void>,
) {
  let failures = 0;
  let expired = 0;
  for (const subscription of subscriptions) {
    try {
      await send(subscription, payload);
    } catch (error) {
      const statusCode =
        typeof error === "object" && error && "statusCode" in error
          ? Number(error.statusCode)
          : 0;
      if (statusCode === 404 || statusCode === 410) {
        expired += 1;
        await removeExpired(subscription.endpoint);
      } else {
        failures += 1;
      }
    }
  }
  return { failures, expired };
}
