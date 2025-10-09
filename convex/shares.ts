import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth } from "./security";
import { Id } from "./_generated/dataModel";

// Share token storage
const shareTokens = new Map<string, {
  boardId: Id<"boards">;
  userId: Id<"users">;
  expiresAt: number;
  createdAt: number;
  accessCount: number;
  maxAccesses?: number;
}>();

/**
 * Generate a secure, unguessable share token
 */
function generateShareToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Create a secure share link for a board
 */
export const createShareLink = mutation({
  args: {
    boardId: v.id("boards"),
    expiresInHours: v.optional(v.number()), // Default 24 hours
    maxAccesses: v.optional(v.number()), // Optional access limit
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    
    // Verify user owns the board
    const board = await ctx.db.get(args.boardId);
    if (!board || board.ownerUserId !== userId) {
      throw new Error("Access denied. You can only share your own boards.");
    }
    
    const expiresInHours = args.expiresInHours || 24;
    const expiresAt = Date.now() + (expiresInHours * 60 * 60 * 1000);
    
    const token = generateShareToken();
    
    shareTokens.set(token, {
      boardId: args.boardId,
      userId,
      expiresAt,
      createdAt: Date.now(),
      accessCount: 0,
      maxAccesses: args.maxAccesses,
    });
    
    return {
      token,
      expiresAt,
      shareUrl: `${process.env.CONVEX_SITE_URL}/share/${token}`,
    };
  },
});

/**
 * Validate and get board data from a share token
 */
export const getSharedBoard = query({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args) => {
    const shareData = shareTokens.get(args.token);
    
    if (!shareData) {
      throw new Error("Invalid or expired share token.");
    }
    
    // Check if token has expired
    if (Date.now() > shareData.expiresAt) {
      shareTokens.delete(args.token);
      throw new Error("Share token has expired.");
    }
    
    // Check access limit
    if (shareData.maxAccesses && shareData.accessCount >= shareData.maxAccesses) {
      throw new Error("Share token has reached its access limit.");
    }
    
    // Increment access count
    shareData.accessCount++;
    
    // Get board data
    const board = await ctx.db.get(shareData.boardId);
    if (!board) {
      throw new Error("Board not found.");
    }
    
    // Get nodes for the board
    const nodes = await ctx.db
      .query("nodes")
      .filter((q) => q.eq(q.field("boardId"), shareData.boardId))
      .collect();
    
    // Get edges for the board
    const edges = await ctx.db
      .query("edges")
      .filter((q) => q.eq(q.field("boardId"), shareData.boardId))
      .collect();
    
    return {
      board: {
        _id: board._id,
        title: board.title,
        description: board.description,
        _creationTime: board._creationTime,
      },
      nodes,
      edges,
      shareInfo: {
        expiresAt: shareData.expiresAt,
        accessCount: shareData.accessCount,
        maxAccesses: shareData.maxAccesses,
      },
    };
  },
});

/**
 * Revoke a share token
 */
export const revokeShareLink = mutation({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    
    const shareData = shareTokens.get(args.token);
    if (!shareData) {
      throw new Error("Share token not found.");
    }
    
    // Verify user owns the board
    if (shareData.userId !== userId) {
      throw new Error("Access denied. You can only revoke your own share links.");
    }
    
    shareTokens.delete(args.token);
    
    return { success: true };
  },
});

/**
 * List active share links for a user's boards
 */
export const listShareLinks = query({
  args: {
    boardId: v.optional(v.id("boards")),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    
    const links: Array<{
      token: string;
      boardId: Id<"boards">;
      boardTitle: string;
      expiresAt: number;
      accessCount: number;
      maxAccesses?: number;
      shareUrl: string;
    }> = [];
    
    for (const [token, shareData] of shareTokens.entries()) {
      if (shareData.userId !== userId) continue;
      if (args.boardId && shareData.boardId !== args.boardId) continue;
      if (Date.now() > shareData.expiresAt) continue;
      
      const board = await ctx.db.get(shareData.boardId);
      if (!board) continue;
      
      links.push({
        token,
        boardId: shareData.boardId,
        boardTitle: board.title,
        expiresAt: shareData.expiresAt,
        accessCount: shareData.accessCount,
        maxAccesses: shareData.maxAccesses,
        shareUrl: `${process.env.CONVEX_SITE_URL}/share/${token}`,
      });
    }
    
    return links;
  },
});

/**
 * Clean up expired tokens (call this periodically)
 */
export const cleanupExpiredTokens = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    let cleanedCount = 0;
    
    for (const [token, shareData] of shareTokens.entries()) {
      if (now > shareData.expiresAt) {
        shareTokens.delete(token);
        cleanedCount++;
      }
    }
    
    return { cleanedCount };
  },
});
