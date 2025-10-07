import { query } from "./_generated/server";

// Simple auth query for compatibility
export const loggedInUser = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }
    const user = await ctx.db
      .query("userProfiles")
      .withIndex("by_subject", (q) => q.eq("subject", identity.subject))
      .unique();
    if (!user) {
      return null;
    }
    return user;
  },
});
