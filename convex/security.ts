import { v } from "convex/values";

/**
 * Helper to read the authenticated user's identity without throwing.
 */
export async function getOptionalAuthIdentity(ctx: any) {
  return await ctx.auth.getUserIdentity();
}

/**
 * Helper to read the authenticated user's id (or null when unauthenticated).
 */
export async function getOptionalAuthUserId(ctx: any) {
  const identity = await getOptionalAuthIdentity(ctx);
  return identity?.subject ?? null;
}

/**
 * Security helper to ensure all server functions require authentication.
 */
export async function requireAuth(ctx: any) {
  const userId = await getOptionalAuthUserId(ctx);
  if (!userId) {
    throw new Error("Authentication required. Please sign in to access this resource.");
  }
  return userId;
}

/**
 * Security helper to validate user ownership of resources.
 */
export async function requireUserOwnership(ctx: any, resourceUserId: string) {
  const userId = await requireAuth(ctx);
  if (userId !== resourceUserId) {
    throw new Error("Access denied. You can only access your own resources.");
  }
  return userId;
}

/**
 * Rate limiting helper (basic implementation)
 * In production, consider using Redis or a dedicated rate limiting service
 */
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

export function checkRateLimit(identifier: string, maxRequests: number = 100, windowMs: number = 60000): boolean {
  const now = Date.now();
  const key = identifier;
  const current = rateLimitMap.get(key);

  if (!current || now > current.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + windowMs });
    return true;
  }

  if (current.count >= maxRequests) {
    return false;
  }

  current.count++;
  return true;
}

/**
 * CORS configuration for HTTP routes
 */
export const corsHeaders = {
  "Access-Control-Allow-Origin": process.env.ALLOWED_ORIGINS || "http://localhost:5173",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

/**
 * Security headers for responses
 */
export const securityHeaders = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "1; mode=block",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
};

/**
 * Content Security Policy
 */
export const cspHeader = {
  "Content-Security-Policy": [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Note: unsafe-eval needed for Vite dev
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self'",
    "connect-src 'self' https://api.openai.com wss:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; "),
};
