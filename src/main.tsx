import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ClerkProvider } from "@clerk/clerk-react";
import App from "./App";
import "./index.css";
import { ConvexProviderWithClerk, convexClient } from "./lib/convex";
import { clerkPublishableKey, assertClerkPublishableKey } from "./lib/clerk";

assertClerkPublishableKey();

const root = createRoot(document.getElementById("root")!);

root.render(
  <StrictMode>
    <ClerkProvider publishableKey={clerkPublishableKey}>
      <ConvexProviderWithClerk client={convexClient}>
        <App />
      </ConvexProviderWithClerk>
    </ClerkProvider>
  </StrictMode>,
);
