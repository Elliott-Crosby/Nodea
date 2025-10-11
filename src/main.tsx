import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { ClerkProvider } from "@clerk/clerk-react";
import App from "./App";
import "./index.css";
import { ConvexProviderWithClerkWrapper } from "./lib/convex";
import { clerkPublishableKey, hasValidClerkKey } from "./lib/clerk";

const rootEl = document.getElementById("root");

if (!rootEl) {
  const msg = "[BOOT] Missing #root element";
  console.error(msg);
  const fallback = document.createElement("div");
  fallback.textContent = msg;
  document.body.appendChild(fallback);
  throw new Error(msg);
}

function MissingClerkConfig() {
  useEffect(() => {
    console.error(
      "[Clerk] Publishable key missing or invalid. Set VITE_CLERK_PUBLISHABLE_KEY in your environment.",
    );
  }, []);
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-2xl font-semibold text-indigo-600">Clerk configuration required</h1>
      <p className="max-w-md text-gray-600">
        Provide a valid <code>VITE_CLERK_PUBLISHABLE_KEY</code> before running the application.
      </p>
    </div>
  );
}

const root = createRoot(rootEl);

window.addEventListener("error", (e) => {
  console.error("[BOOT] window error:", e.error || e.message);
});

if (!hasValidClerkKey()) {
  root.render(
    <StrictMode>
      <MissingClerkConfig />
    </StrictMode>,
  );
} else {
  root.render(
    <StrictMode>
      <ClerkProvider publishableKey={clerkPublishableKey}>
        <ConvexProviderWithClerkWrapper>
          <App />
        </ConvexProviderWithClerkWrapper>
      </ClerkProvider>
    </StrictMode>,
  );
}
