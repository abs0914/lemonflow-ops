import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { registerPushServiceWorker, isPreviewHost, isInIframe } from "./lib/push";

// Register push service worker only in production (not in Lovable preview iframe).
if (!isPreviewHost() && !isInIframe()) {
  registerPushServiceWorker().catch((e) => console.warn("SW register failed", e));
} else if ("serviceWorker" in navigator) {
  // Clean up any SW accidentally registered inside the preview/iframe.
  navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister()));
}

createRoot(document.getElementById("root")!).render(<App />);
