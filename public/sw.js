// The Lemon Co — Push notification service worker
// Intentionally minimal: NO caching, NO navigation interception.
// Only handles `push` and `notificationclick` events.

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (e) {
    payload = { title: "The Lemon Co", body: event.data ? event.data.text() : "" };
  }

  const title = payload.title || "The Lemon Co";
  const options = {
    body: payload.body || "",
    icon: payload.icon || "/icons/icon-192.png",
    badge: payload.badge || "/icons/badge-72.png",
    tag: payload.tag || undefined,
    renotify: !!payload.tag,
    data: { url: payload.url || "/dashboard" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/dashboard";

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of allClients) {
        try {
          const url = new URL(client.url);
          if (url.origin === self.location.origin) {
            await client.focus();
            client.postMessage({ type: "navigate", url: targetUrl });
            return;
          }
        } catch (_) {}
      }
      await self.clients.openWindow(targetUrl);
    })()
  );
});
