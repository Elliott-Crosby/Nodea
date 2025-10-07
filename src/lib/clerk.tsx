import { ClerkProvider } from "@clerk/clerk-react";

// Clerk configuration
export const clerkConfig = {
  publishableKey: import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
};

// Clerk provider wrapper
export function ClerkProviderWrapper({ children }: { children: React.ReactNode }) {
  const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || "pk_live_your_key_here";
  
  return (
    <ClerkProvider publishableKey={publishableKey}>
      {children}
    </ClerkProvider>
  );
}