import { query } from "./_generated/server";
import { getOptionalAuthUserId } from "./security";

// Simple auth query for compatibility
export const loggedInUser = query({
  handler: async (ctx) => {
    const userId = await getOptionalAuthUserId(ctx);
    if (!userId) {
      return null;
    }
    const user = await ctx.db.get(userId);
    if (!user) {
      return null;
    }
    return user;
  },
});
