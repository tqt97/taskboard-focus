self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {}
  const title = payload.title || "Taskboard reminder";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: payload.body || "Có task sắp đến mốc.",
      icon: "/icon.svg",
      badge: "/icon.svg",
      tag: payload.tag || "taskboard-reminder",
      data: { url: payload.url || "/today" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const destination = new URL(event.notification.data?.url || "/today", self.location.origin);
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((client) => new URL(client.url).origin === destination.origin);
      if (existing) {
        existing.navigate(destination.href);
        return existing.focus();
      }
      return self.clients.openWindow(destination.href);
    }),
  );
});
