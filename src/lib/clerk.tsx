import { ClerkProvider, ClerkLoaded } from "@clerk/clerk-react";

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
    if (typeof window !== "undefined") {
      console.error(
        "[Clerk] Missing publishable key. Set VITE_CLERK_PUBLISHABLE_KEY to enable authentication.",
      );
    }
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 className="text-2xl font-semibold text-indigo-600">Clerk configuration required</h1>
        <p className="max-w-md text-gray-600">
          The environment variable <code>VITE_CLERK_PUBLISHABLE_KEY</code> is not configured. Add it
          to your deployment settings so authentication can load correctly.
        </p>
      </div>
    );
  }

  return (
    <ClerkProvider publishableKey={rawPublishableKey!}>
      <ClerkLoaded>{children}</ClerkLoaded>
    </ClerkProvider>
  );
}
