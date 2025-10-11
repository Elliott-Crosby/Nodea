import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ClerkProvider, useAuth } from "@clerk/clerk-react";
import App from "./App";
import "./index.css";
import { ConvexProviderWithClerk, convexClient } from "./lib/convex";
import { clerkPublishableKey } from "./lib/clerk";

// Root element creation using standard Vite entry convention.
const root = createRoot(document.getElementById("root")!);

// Diagnostic logging so we can verify environment bindings at runtime.
console.log("Nodea booting...");
console.log(
  "ENV VITE_CLERK_PUBLISHABLE_KEY exists:",
  !!import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);
console.log("ENV VITE_CONVEX_URL:", import.meta.env.VITE_CONVEX_URL);

// Guard against missing Clerk configuration to avoid blank screens.
if (!clerkPublishableKey) {
  root.render(
    <StrictMode>
      <div style={{ padding: 20, fontFamily: "system-ui" }}>
        <h1>Configuration Error</h1>
        <p>The Clerk publishable key is missing or invalid.</p>
        <p>Please set VITE_CLERK_PUBLISHABLE_KEY in your environment and redeploy.</p>
      </div>
    </StrictMode>,
  );
} else {
  // Production providers: Clerk with custom domain + Convex integration.
  root.render(
    <StrictMode>
      <ClerkProvider publishableKey={clerkPublishableKey} frontendApi="clerk.nodea.ai">
        <ConvexProviderWithClerk client={convexClient} useAuth={useAuth}>
          <App />
        </ConvexProviderWithClerk>
      </ClerkProvider>
    </StrictMode>,
  );
}
