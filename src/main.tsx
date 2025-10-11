import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ClerkProvider, useAuth } from "@clerk/clerk-react";
import App from "./App";
import "./index.css";
import { ConvexProviderWithClerk, convexClient } from "./lib/convex";
import { clerkPublishableKey } from "./lib/clerk";

const root = createRoot(document.getElementById("root")!);

if (!clerkPublishableKey) {
  console.error(
    "VITE_CLERK_PUBLISHABLE_KEY is not configured. Please set it in your environment.",
  );
  root.render(
    <StrictMode>
      <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-800">
        <div className="max-w-md text-center space-y-4 px-6">
          <h1 className="text-2xl font-semibold">Configuration Error</h1>
          <p>
            The Clerk publishable key is missing. Set{" "}
            <code>VITE_CLERK_PUBLISHABLE_KEY</code> in your environment and redeploy.
          </p>
        </div>
      </div>
    </StrictMode>,
  );
} else {
  root.render(
    <StrictMode>
      <ClerkProvider publishableKey={clerkPublishableKey}>
        <ConvexProviderWithClerk client={convexClient} useAuth={useAuth}>
          <App />
        </ConvexProviderWithClerk>
      </ClerkProvider>
    </StrictMode>,
  );
}
