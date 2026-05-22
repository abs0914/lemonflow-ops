## Goal

Upgrade the existing in-app notification bell so users also get:
1. **OS-level toast notifications** while the tab is open (Web Notifications API).
2. **Push notifications when the app/tab is closed** (PWA + Service Worker + Web Push API).

The existing `notifications` table, `NotificationBell`, `useNotifications`, and `useTabBlink` stay as-is — this builds on top of them.

---

## Important caveats (please read)

- **PWA in Lovable preview**: Service workers do not work reliably inside the Lovable editor iframe. Push notifications will only work in the **published app** (`lemonflow-ops.lovable.app` or `lemonco.pvosyncpos.com`), not in the in-editor preview. The SW will be guarded so it never registers inside the preview iframe.
- **iOS limitation**: Web Push on iOS only works if the user first *installs* the PWA to their Home Screen (iOS 16.4+). Android/desktop Chrome/Edge/Firefox work without installing.
- **User must grant permission**. We'll add a one-time prompt + a toggle in My Account.
- **Closed-app delivery requires a backend push trigger**. We already insert rows into `notifications` from DB triggers / edge functions — we'll hook into that to also fan out a web-push to each subscribed device.

---

## Plan

### 1. Foreground (tab open) — Web Notifications API
- New hook `useBrowserNotifications` that:
  - Requests permission on first user gesture (button in `NotificationBell` header + auto-prompt on login if `default`).
  - Subscribes to the same Supabase realtime channel `useNotifications` already uses.
  - On each new INSERT, fires `new Notification(title, { body, icon: tlcLogo, tag: id })` **only if** `document.hidden` or the bell popover is closed (avoid double-notifying).
  - Clicking the OS notification focuses the tab and navigates via the same `getNotificationRoute` logic.

### 2. Background (tab/app closed) — PWA + Push API

**Frontend**
- Add `vite-plugin-pwa` with:
  - `devOptions.enabled = false`
  - `registerType: "autoUpdate"`
  - `navigateFallbackDenylist: [/^\/~oauth/, /^\/api/]`
  - `NetworkFirst` for HTML navigations
- Add `public/manifest.json` (name, icons from existing `tlc-logo.png`, `display: standalone`, theme color matching design tokens).
- Guard registration so it **skips iframes and `*.lovableproject.com` hosts** (per Lovable PWA guidance).
- Custom service worker (`public/sw-push.ts` merged via Workbox `injectManifest`) that handles:
  - `push` event → `self.registration.showNotification(title, { body, icon, badge, data: { url } })`
  - `notificationclick` event → focus existing client or open `data.url`

**Subscription flow**
- New page section in **My Account** → "Push notifications" toggle.
- On enable: call `pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: VAPID_PUBLIC_KEY })` and POST the subscription to a new edge function `register-push-subscription`.
- Store in new table `push_subscriptions(user_id, endpoint, p256dh, auth, user_agent)`.

**Backend (Lovable Cloud / Supabase)**
- New table `push_subscriptions` with RLS (user can read/delete own; service role inserts/sends).
- New secrets: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (mailto). I'll generate the keypair and ask you to store them.
- The `VAPID_PUBLIC_KEY` is also exposed to the frontend (it's safe to publish) — kept in a small public config edge function or as a Supabase setting.
- New edge function `send-push` that takes `{ user_id, title, body, url }`, looks up subscriptions, and sends via `web-push` (Deno port). Stale 404/410 subscriptions are auto-deleted.
- **Trigger fan-out**: extend the existing `notify_*` Postgres helpers (e.g. `notify_store_users`) so that after inserting into `notifications` they also `pg_net.http_post` to `send-push` for each recipient. This means *every* existing notification automatically becomes a push, with zero changes to current notification call sites.

### 3. UX polish
- In `NotificationBell` header, add a small bell-with-slash icon if permission is `denied` or `default` with a "Enable browser notifications" affordance.
- Show "Push enabled on this device" status in My Account.
- "Send test notification" button in My Account for debugging.

---

## Files (technical detail)

**New**
- `src/hooks/useBrowserNotifications.ts`
- `src/hooks/usePushSubscription.ts`
- `src/lib/push.ts` (urlBase64ToUint8Array helper, VAPID public key constant fetched from edge fn)
- `public/manifest.json`, `public/icons/*` (reuse `tlc-logo.png` resized)
- `src/sw-push.ts` (Workbox injectManifest entry)
- `supabase/functions/register-push-subscription/index.ts`
- `supabase/functions/send-push/index.ts`
- `supabase/functions/push-config/index.ts` (returns VAPID public key)
- Migration: `push_subscriptions` table + RLS + amend `notify_store_users`, `notify_user`, etc. to call `send-push`.

**Edited**
- `vite.config.ts` — add VitePWA plugin
- `index.html` — manifest link, theme-color meta, apple-touch-icon
- `src/main.tsx` — guarded SW registration
- `src/components/NotificationBell.tsx` — permission affordance + foreground OS-toast trigger
- `src/pages/MyAccount.tsx` — Push notifications toggle + test button

**Untouched**: existing `notifications` table, `useNotifications`, `useTabBlink`, all callers that insert notifications.

---

## What I need from you before building

1. **Confirm you want PWA enabled.** This means a service worker will ship to production. (Preview/editor will be guarded out.)
2. **VAPID keys**: I'll generate them locally and ask you to paste the public + private key into Lovable Cloud secrets (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`) plus a `VAPID_SUBJECT` like `mailto:ops@thelemonco.ph`.
3. **Notification icon**: OK to reuse `tlc-logo.png` for badge + icon, or do you want a dedicated monochrome badge?
4. **Scope of push**: send a push for **every** in-app notification, or only specific high-priority types (e.g. new orders, payment approvals, low stock)? Default = every notification.
