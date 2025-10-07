import { ConvexProviderWithClerk } from "@convex-dev/auth/react";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { useAuth } from "@clerk/clerk-react";

const convexUrl = "https://grateful-minnow-178.convex.cloud";
const convex = new ConvexReactClient(convexUrl);

export function ConvexProviderWithClerkWrapper({ children }: { children: React.ReactNode }) {
  // If Clerk isn't available (e.g., we rendered without a valid key), fall back to plain Convex provider
  const hasClerk = typeof window !== "undefined" && !!(window as any).Clerk; // conservative check
  if (!hasClerk) {
    return <ConvexProvider client={convex}>{children}</ConvexProvider>;
  }
  return <ConvexProviderWithClerk client={convex} useAuth={useAuth}>{children}</ConvexProviderWithClerk>;
}