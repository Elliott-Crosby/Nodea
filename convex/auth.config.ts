// Validate environment variable on startup
const clerkIssuerDomain = process.env.CLERK_JWT_ISSUER_DOMAIN;
if (!clerkIssuerDomain) {
  throw new Error("CLERK_JWT_ISSUER_DOMAIN environment variable is missing. Please set it in your Convex Dashboard.");
}

// Log successful config load
console.log(`[AUTH] Loaded Clerk provider with domain: ${clerkIssuerDomain}`);

export default {
  providers: [
    {
      domain: clerkIssuerDomain,
      applicationID: "convex",
    },
  ]
};