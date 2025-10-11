import { useCallback, useMemo } from "react";
import { ConvexReactClient, ConvexProviderWithAuth } from "convex/react";
import type { ReactNode } from "react";
import { useAuth } from "@clerk/clerk-react";
import { clerkConfig, hasValidClerkKey } from "./clerk";

const PRODUCTION_CONVEX_URL = "https://posh-setter-840.convex.cloud";
const envConvexUrl = import.meta.env.VITE_CONVEX_URL as string | undefined;
const convexUrl = envConvexUrl ?? PRODUCTION_CONVEX_URL;

if (typeof window !== "undefined") {
  console.info(`✅ Connected to Convex Production: ${PRODUCTION_CONVEX_URL}`);
  if (envConvexUrl && envConvexUrl !== PRODUCTION_CONVEX_URL) {
    console.warn(
      `[Convex] Overriding production URL with custom value: ${envConvexUrl}. This is not recommended.`,
    );
  }
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
