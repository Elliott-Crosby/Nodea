import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const getUserProfile = query({
  args: { userId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const targetUserId = args.userId || identity?.subject;
    
    if (!targetUserId) {
      return null;
    }

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", targetUserId))
      .first();

    return profile;
  },
});

export const createUserProfile = mutation({
  args: {
    firstName: v.string(),
    lastName: v.string(),
    displayName: v.optional(v.string()),
    bio: v.optional(v.string()),
    marketingOptIn: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Check if profile already exists
    const existingProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .first();

    if (existingProfile) {
      throw new Error("User profile already exists");
    }

    const now = Date.now();
    const profileId = await ctx.db.insert("userProfiles", {
      userId: identity.subject,
      firstName: args.firstName,
      lastName: args.lastName,
      displayName: args.displayName || `${args.firstName} ${args.lastName}`,
      bio: args.bio,
      preferences: {
        marketingOptIn: args.marketingOptIn || false,
        notifications: true,
        theme: "light",
      },
      createdBy: identity.subject,
      createdAt: now,
      updatedAt: now,
    });

    return profileId;
  },
});

export const updateUserProfile = mutation({
  args: {
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    displayName: v.optional(v.string()),
    bio: v.optional(v.string()),
    avatar: v.optional(v.string()),
    preferences: v.optional(v.object({
      theme: v.optional(v.string()),
      notifications: v.optional(v.boolean()),
      marketingOptIn: v.optional(v.boolean()),
    })),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .first();

    if (!profile) {
      throw new Error("User profile not found");
    }

    const updates: any = {
      updatedAt: Date.now(),
    };

    if (args.firstName !== undefined) updates.firstName = args.firstName;
    if (args.lastName !== undefined) updates.lastName = args.lastName;
    if (args.displayName !== undefined) updates.displayName = args.displayName;
    if (args.bio !== undefined) updates.bio = args.bio;
    if (args.avatar !== undefined) updates.avatar = args.avatar;
    if (args.preferences !== undefined) {
      updates.preferences = {
        ...profile.preferences,
        ...args.preferences,
      };
    }

    await ctx.db.patch(profile._id, updates);
    return profile._id;
  },
});

export const getCurrentUserProfile = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .first();

    return profile;
  },
});
