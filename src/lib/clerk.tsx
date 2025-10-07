import { ClerkProvider } from "@clerk/clerk-react";

// Clerk configuration
export const clerkConfig = {
  publishableKey: import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
};

// Clerk provider wrapper
export function ClerkProviderWrapper({ children }: { children: React.ReactNode }) {
  const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined;

  const isUsableKey = typeof publishableKey === "string" && publishableKey.startsWith("pk_") && publishableKey !== "pk_live_your_key_here";

  if (!isUsableKey) {
    // Render children without Clerk when key is missing/placeholder to avoid app crash
    return <>{children}</>;
  }

  return <ClerkProvider publishableKey={publishableKey}>{children}</ClerkProvider>;
}