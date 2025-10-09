import { ClerkProvider } from "@clerk/clerk-react";

const rawPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined;

// Clerk configuration
export const clerkConfig = {
  publishableKey: rawPublishableKey,
};

export function hasValidClerkKey(key: string | undefined = rawPublishableKey) {
  return typeof key === "string" && key.startsWith("pk_") && key !== "pk_live_your_key_here";
}

// Clerk provider wrapper
export function ClerkProviderWrapper({ children }: { children: React.ReactNode }) {
  if (!hasValidClerkKey()) {
    // Render children without Clerk when key is missing/placeholder to avoid app crash
    return <>{children}</>;
  }

  return <ClerkProvider publishableKey={rawPublishableKey!}>{children}</ClerkProvider>;
}
