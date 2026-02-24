import { useEffect, useRef } from "react";

export function useTabBlink(unreadCount: number) {
  const originalTitle = useRef(document.title);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Store the base title once
    if (!originalTitle.current || originalTitle.current.startsWith("🔔")) {
      originalTitle.current = "The Lemon Co";
    }

    if (unreadCount > 0) {
      let show = true;
      intervalRef.current = setInterval(() => {
        document.title = show
          ? `🔔 (${unreadCount}) New Notifications`
          : originalTitle.current;
        show = !show;
      }, 1500);
    } else {
      document.title = originalTitle.current;
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      document.title = originalTitle.current;
    };
  }, [unreadCount]);
}
