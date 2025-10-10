import { mutation, query, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth } from "./security";
import { validateApiKeyNickname, validateProviderName } from "./validation";

export const addApiKey = mutation({
  args: {
    provider: v.union(v.literal("openai"), v.literal("anthropic"), v.literal("google")),
    nickname: v.string(),
    secret: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);

    // Validate and sanitize inputs
    const validatedNickname = validateApiKeyNickname(args.nickname);
    const validatedProvider = validateProviderName(args.provider);

    // Validate the API key with a test call
    const isValid = await validateApiKey(validatedProvider, args.secret);
    if (!isValid) {
      throw new Error("Invalid API key");
    }

    // Encrypt the key (placeholder - would use actual encryption)
    const encryptedKey = await encryptApiKey(args.secret);
    const last4 = args.secret.slice(-4);

    const keyId = await ctx.db.insert("apiKeys", {
      ownerUserId: userId,
      provider: validatedProvider as "openai" | "anthropic" | "google",
      nickname: validatedNickname,
      last4,
      encryptedKey,
      status: "active",
      createdBy: userId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return keyId;
  },
});

export const listApiKeys = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuth(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const keys = await ctx.db
      .query("apiKeys")
      .withIndex("by_owner", (q) => q.eq("ownerUserId", userId))
      .filter((q) => q.eq(q.field("status"), "active"))
      .collect();

    // Return without encrypted keys
    return keys.map(key => ({
      _id: key._id,
      provider: key.provider,
      nickname: key.nickname,
      last4: key.last4,
      status: key.status,
      _creationTime: key._creationTime,
    }));
  },
});

export const getEncryptedKey = query({
  args: { keyId: v.id("apiKeys") },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const key = await ctx.db.get(args.keyId);
    if (!key || key.ownerUserId !== userId) {
      throw new Error("API key not found or access denied");
    }

    return { encryptedKey: key.encryptedKey };
  },
});

export const revokeApiKey = mutation({
  args: { keyId: v.id("apiKeys") },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const key = await ctx.db.get(args.keyId);
    if (!key || key.ownerUserId !== userId) {
      throw new Error("API key not found or access denied");
    }

    await ctx.db.patch(args.keyId, {
      status: "revoked",
      updatedAt: Date.now(),
    });
  },
});

async function validateApiKey(provider: string, secret: string): Promise<boolean> {
  // Placeholder validation - would make actual API call
  if (provider === "openai") {
    return secret.startsWith("sk-") && secret.length > 20;
  }
  return true;
}

async function encryptApiKey(secret: string): Promise<string> {
  // Placeholder encryption - would use actual AES-GCM
  // Using btoa/atob for base64 encoding in Convex environment
  return btoa(secret);
}

export async function decryptApiKey(encryptedKey: string): Promise<string> {
  // Placeholder decryption - would use actual AES-GCM
  // Using btoa/atob for base64 decoding in Convex environment
  return atob(encryptedKey);
}

export const getApiKey = internalQuery({
  args: { keyId: v.id("apiKeys") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.keyId);
  },
});
