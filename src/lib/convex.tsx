import { ConvexProviderWithClerk } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import { useAuth } from "@clerk/clerk-react";

const convexUrl = "https://grateful-minnow-178.convex.cloud";
const convex = new ConvexReactClient(convexUrl);

export function ConvexProviderWithClerkWrapper({ children }: { children: React.ReactNode }) {
  return (
    <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
      {children}
    </ConvexProviderWithClerk>
  );
}