import { createRoot } from "react-dom/client";
import { ClerkProviderWrapper } from "./lib/clerk";
import { ConvexProviderWithClerkWrapper } from "./lib/convex";
import "./index.css";
import App from "./App";

(() => {
  const rootEl = document.getElementById("root");
  if (!rootEl) {
    const msg = "[BOOT] Missing #root element";
    console.error(msg);
    const div = document.createElement("div");
    div.textContent = msg;
    document.body.appendChild(div);
    return;
  }
  // Minimal visible hint to avoid pure white screen if something stalls before React mounts
  rootEl.textContent = "Loading…";
  window.addEventListener("error", (e) => {
    console.error("[BOOT] window error:", e.error || e.message);
    if (rootEl) rootEl.textContent = `Error: ${e.message || "Unknown"}`;
  });
  try {
    console.log("[BOOT] Rendering app");
    createRoot(rootEl).render(
      <ClerkProviderWrapper>
        <ConvexProviderWithClerkWrapper>
          <App />
        </ConvexProviderWithClerkWrapper>
      </ClerkProviderWrapper>,
    );
  } catch (err) {
    console.error("[BOOT] render failed", err);
    rootEl.textContent = `Render failed: ${err instanceof Error ? err.message : String(err)}`;
  }
})();
