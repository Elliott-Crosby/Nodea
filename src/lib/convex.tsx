import { useCallback, useMemo } from "react";
import { ConvexReactClient, ConvexProviderWithAuth } from "convex/react";
import type { ReactNode } from "react";
import { useAuth } from "@clerk/clerk-react";
import { clerkConfig, hasValidClerkKey } from "./clerk";

const convexUrl = import.meta.env.VITE_CONVEX_URL;
if (!convexUrl) {
  throw new Error("Missing VITE_CONVEX_URL env var. Please set it in your .env.local.");
}
if (typeof window !== "undefined") {
  console.info(`[Convex] Using base URL: ${convexUrl}`);
}
const convex = new ConvexReactClient(convexUrl);

function useAnonymousAuth() {
  const fetchAccessToken = useCallback(async () => null, []);
  return useMemo(
    () => ({
      isLoading: false,
      isAuthenticated: false,
      fetchAccessToken,
    }),
    [fetchAccessToken],
  );
}

function useClerkConvexAuthBridge() {
  const { isLoaded, isSignedIn, getToken } = useAuth();

  const fetchAccessToken = useCallback(
    async ({ forceRefreshToken }: { forceRefreshToken?: boolean } = {}) => {
      const skipCache = forceRefreshToken ?? false;

      try {
        const token = await getToken({
          template: "convex",
          skipCache,
        });
        if (token) {
          return token;
        }
      } catch (err) {
        console.warn("[Convex auth] Clerk template 'convex' unavailable, falling back", err);
      }

      try {
        return await getToken({
          skipCache,
        });
      } catch (fallbackErr) {
        console.error("[Convex auth] Failed to fetch Clerk token", fallbackErr);
        return null;
      }
    },
    [getToken],
  );

  return useMemo(
    () => ({
      isLoading: !isLoaded,
      isAuthenticated: isSignedIn ?? false,
      fetchAccessToken,
    }),
    [fetchAccessToken, isLoaded, isSignedIn],
  );
}

export function ConvexProviderWithClerkWrapper({ children }: { children: ReactNode }) {
  const clerkEnabled = hasValidClerkKey(clerkConfig.publishableKey);

  if (!clerkEnabled) {
    return (
      <ConvexProviderWithAuth client={convex} useAuth={useAnonymousAuth}>
        {children}
      </ConvexProviderWithAuth>
    );
  }

  return (
    <ConvexProviderWithAuth client={convex} useAuth={useClerkConvexAuthBridge}>
      {children}
    </ConvexProviderWithAuth>
  );
}
