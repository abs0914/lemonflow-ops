import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  getVapidPublicKey,
  isInIframe,
  isPreviewHost,
  pushSupported,
  registerPushServiceWorker,
  urlBase64ToUint8Array,
} from "@/lib/push";

export type PushStatus = "unsupported" | "blocked" | "preview" | "denied" | "default" | "granted-unsubscribed" | "subscribed";

export function usePushSubscription() {
  const [status, setStatus] = useState<PushStatus>("default");
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!pushSupported()) return setStatus("unsupported");
    if (isPreviewHost() || isInIframe()) return setStatus("preview");
    if (Notification.permission === "denied") return setStatus("denied");

    const reg = await navigator.serviceWorker.getRegistration("/");
    if (!reg) return setStatus(Notification.permission === "granted" ? "granted-unsubscribed" : "default");
    const sub = await reg.pushManager.getSubscription();
    if (sub) return setStatus("subscribed");
    setStatus(Notification.permission === "granted" ? "granted-unsubscribed" : "default");
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const subscribe = useCallback(async () => {
    if (!pushSupported()) throw new Error("Push not supported in this browser");
    if (isPreviewHost() || isInIframe()) {
      throw new Error("Push notifications only work on the published app, not the editor preview.");
    }
    setLoading(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        await refresh();
        throw new Error("Permission denied");
      }

      let reg = await navigator.serviceWorker.getRegistration("/");
      if (!reg) reg = (await registerPushServiceWorker()) ?? undefined;
      if (!reg) throw new Error("Could not register service worker");
      await navigator.serviceWorker.ready;

      const publicKey = await getVapidPublicKey();

      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        });
      }

      const json: any = sub.toJSON();
      const { error } = await supabase.functions.invoke("register-push-subscription", {
        body: {
          endpoint: sub.endpoint,
          p256dh: json.keys?.p256dh,
          auth: json.keys?.auth,
          user_agent: navigator.userAgent,
        },
      });
      if (error) throw error;
      await refresh();
    } finally {
      setLoading(false);
    }
  }, [refresh]);

  const unsubscribe = useCallback(async () => {
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        const endpoint = sub.endpoint;
        await sub.unsubscribe();
        await supabase.functions.invoke("register-push-subscription", {
          body: { action: "unsubscribe", endpoint },
        });
      }
      await refresh();
    } finally {
      setLoading(false);
    }
  }, [refresh]);

  return { status, loading, subscribe, unsubscribe, refresh };
}
