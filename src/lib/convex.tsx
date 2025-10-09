import { ConvexReactClient, ConvexProvider } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { useAuth } from "@clerk/clerk-react";
import { clerkConfig, hasValidClerkKey } from "./clerk";

const convexUrl = import.meta.env.VITE_CONVEX_URL;
if (!convexUrl) {
  throw new Error("Missing VITE_CONVEX_URL env var. Please set it in your .env.local.");
}
const convex = new ConvexReactClient(convexUrl);

export function ConvexProviderWithClerkWrapper({ children }: { children: React.ReactNode }) {
  if (!hasValidClerkKey(clerkConfig.publishableKey)) {
    return <ConvexProvider client={convex}>{children}</ConvexProvider>;
  }

  return (
    <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
      {children}
    </ConvexProviderWithClerk>
  );
}
