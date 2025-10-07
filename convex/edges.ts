import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { requireAuth } from "./security";

export const createEdge = mutation({
  args: {
    boardId: v.id("boards"),
    srcNodeId: v.id("nodes"),
    dstNodeId: v.id("nodes"),
    kind: v.union(v.literal("lineage"), v.literal("reference")),
    label: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = identity?.subject;
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Check board access
    const board = await ctx.db.get(args.boardId);
    if (!board || board.ownerUserId !== userId) {
      throw new Error("Board not found or access denied");
    }

    // Verify nodes exist and belong to the board
    const srcNode = await ctx.db.get(args.srcNodeId);
    const dstNode = await ctx.db.get(args.dstNodeId);

    if (!srcNode || !dstNode || srcNode.boardId !== args.boardId || dstNode.boardId !== args.boardId) {
      throw new Error("Invalid nodes");
    }

    const edgeId = await ctx.db.insert("edges", {
      boardId: args.boardId,
      srcNodeId: args.srcNodeId,
      dstNodeId: args.dstNodeId,
      kind: args.kind,
      label: args.label,
      createdBy: userId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return edgeId;
  },
});

export const deleteEdge = mutation({
  args: { edgeId: v.id("edges") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = identity?.subject;
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const edge = await ctx.db.get(args.edgeId);
    if (!edge) {
      throw new Error("Edge not found");
    }

    // Check board access
    const board = await ctx.db.get(edge.boardId);
    if (!board || board.ownerUserId !== userId) {
      throw new Error("Access denied");
    }

    await ctx.db.delete(args.edgeId);
  },
});

export const listEdgesByBoard = query({
  args: { boardId: v.id("boards") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = identity?.subject;
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Check board access
    const board = await ctx.db.get(args.boardId);
    if (!board) {
      throw new Error("Board not found");
    }

    if (board.ownerUserId !== userId && !board.isPublic) {
      throw new Error("Access denied");
    }

    return await ctx.db
      .query("edges")
      .withIndex("by_board", (q) => q.eq("boardId", args.boardId))
      .collect();
  },
});
