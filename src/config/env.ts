const normalize = (value: string | undefined) => {
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const stripTrailingSlash = (value: string | undefined) => {
  if (!value) return undefined;
  return value.endsWith("/") ? value.replace(/\/+$/, "") : value;
};

const clerkPublishableKey = normalize(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);
const convexUrl = stripTrailingSlash(normalize(import.meta.env.VITE_CONVEX_URL));

export const clientEnv = {
  clerkPublishableKey,
  convexUrl,
  isProduction: import.meta.env.PROD ?? false,
};

export type ClientEnv = typeof clientEnv;
