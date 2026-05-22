import { supabase } from "@/integrations/supabase/client";

export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function isPreviewHost(): boolean {
  const h = window.location.hostname;
  return h.includes("id-preview--") || h.includes("lovableproject.com");
}

export function isInIframe(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

let cachedPublicKey: string | null = null;
export async function getVapidPublicKey(): Promise<string> {
  if (cachedPublicKey) return cachedPublicKey;
  const { data, error } = await supabase.functions.invoke("push-config");
  if (error) throw error;
  if (!data?.publicKey) throw new Error("VAPID public key not configured");
  cachedPublicKey = data.publicKey as string;
  return cachedPublicKey;
}

export async function registerPushServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!pushSupported()) return null;
  if (isPreviewHost() || isInIframe()) return null;
  try {
    return await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  } catch (e) {
    console.warn("SW registration failed", e);
    return null;
  }
}
