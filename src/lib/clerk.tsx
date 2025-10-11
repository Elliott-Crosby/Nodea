export const PRODUCTION_CLERK_PUBLISHABLE_KEY = "pk_live_Y2xlcmsubm9kZWEuYWkk";

const envPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined;

export const clerkPublishableKey =
  typeof envPublishableKey === "string" && envPublishableKey.length > 0
    ? envPublishableKey
    : PRODUCTION_CLERK_PUBLISHABLE_KEY;

export const clerkConfig = {
  publishableKey: clerkPublishableKey,
};

export function hasValidClerkKey(key: string | undefined = clerkPublishableKey) {
  return typeof key === "string" && key.startsWith("pk_") && key !== "pk_live_your_key_here";
}
