import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Notification as DbNotification } from "@/hooks/useNotifications";

function getRoute(n: DbNotification): string {
  if (n.entity_type === "sales_order" && n.entity_id) return `/fulfillment/orders/${n.entity_id}`;
  if (n.entity_type === "assembly_order") return "/production";
  if (n.entity_type === "component" || n.entity_type === "raw_material") return "/inventory";
  return "/dashboard";
}

/**
 * Shows an OS-level notification when the tab is hidden and a new notification arrives.
 * Also listens for SW messages to navigate when a push notification is clicked.
 */
export function useBrowserNotifications() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const seenRef = useRef<Set<string>>(new Set());

  // Listen for SW navigation messages (when user clicks a push)
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const handler = (e: MessageEvent) => {
      if (e.data?.type === "navigate" && typeof e.data.url === "string") {
        navigate(e.data.url);
      }
    };
    navigator.serviceWorker.addEventListener("message", handler);
    return () => navigator.serviceWorker.removeEventListener("message", handler);
  }, [navigate]);

  useEffect(() => {
    if (!user?.id || typeof Notification === "undefined") return;

    const channel = supabase
      .channel(`browser-notifications-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const n = payload.new as DbNotification;
          if (seenRef.current.has(n.id)) return;
          seenRef.current.add(n.id);

          // Only show OS toast if tab is hidden (otherwise the in-app bell handles it)
          if (Notification.permission !== "granted") return;
          if (!document.hidden) return;

          const url = getRoute(n);
          try {
            const notif = new Notification(n.title, {
              body: n.message,
              icon: "https://storage.googleapis.com/gpt-engineer-file-uploads/DzjvbUyZweVjOBNbdc6I0bT492C2/uploads/1770790074350-tlc-logo.png",
              tag: n.id,
            });
            notif.onclick = () => {
              window.focus();
              navigate(url);
              notif.close();
            };
          } catch (e) {
            // Some browsers (mobile) throw if Notification constructor is called directly.
            // The Service Worker push will handle it instead.
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, navigate]);
}
