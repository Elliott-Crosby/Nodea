export const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined;

export function assertClerkPublishableKey(): asserts clerkPublishableKey is string {
  if (typeof clerkPublishableKey !== "string" || clerkPublishableKey.length === 0) {
    throw new Error(
      "VITE_CLERK_PUBLISHABLE_KEY is not defined. Set it in your environment before starting the app.",
    );
  }
}
