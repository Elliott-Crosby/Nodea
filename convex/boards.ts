import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { validateBoardTitle, validateBoardDescription } from "./validation";

export const listBoards = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    return await ctx.db
      .query("boards")
      .withIndex("by_owner", (q) => q.eq("ownerUserId", identity.subject))
      .order("desc")
      .collect();
  },
});

export const createBoard = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Validate and sanitize inputs
    const validatedTitle = validateBoardTitle(args.title);
    const validatedDescription = args.description ? validateBoardDescription(args.description) : undefined;

    const boardId = await ctx.db.insert("boards", {
      ownerUserId: identity.subject,
      title: validatedTitle,
      description: validatedDescription,
      isPublic: false,
      createdBy: identity.subject,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return boardId;
  },
});

export const getBoard = query({
  args: { boardId: v.id("boards") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const board = await ctx.db.get(args.boardId);
    if (!board) {
      throw new Error("Board not found");
    }

    if (board.ownerUserId !== identity.subject) {
      throw new Error("Access denied");
    }

    return board;
  },
});

export const updateBoardMeta = mutation({
  args: {
    boardId: v.id("boards"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    isPublic: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const board = await ctx.db.get(args.boardId);
    if (!board) {
      throw new Error("Board not found");
    }

    if (board.ownerUserId !== identity.subject) {
      throw new Error("Access denied");
    }

    // Validate inputs
    const updates: any = { updatedAt: Date.now() };
    if (args.title !== undefined) updates.title = validateBoardTitle(args.title);
    if (args.description !== undefined) updates.description = validateBoardDescription(args.description);
    if (args.isPublic !== undefined) updates.isPublic = args.isPublic;

    await ctx.db.patch(args.boardId, updates);
  },
});

export const clearBoard = mutation({
  args: { boardId: v.id("boards") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const board = await ctx.db.get(args.boardId);
    if (!board) {
      throw new Error("Board not found");
    }

    if (board.ownerUserId !== identity.subject) {
      throw new Error("Access denied");
    }

    try {
      // Delete all nodes for this board
      const nodes = await ctx.db
        .query("nodes")
        .withIndex("by_board", (q) => q.eq("boardId", args.boardId))
        .collect();
      
      for (const node of nodes) {
        await ctx.db.delete(node._id);
      }

      // Delete all edges for this board
      const edges = await ctx.db
        .query("edges")
        .withIndex("by_board", (q) => q.eq("boardId", args.boardId))
        .collect();
      
      for (const edge of edges) {
        await ctx.db.delete(edge._id);
      }

      // Delete all tags for this board
      const tags = await ctx.db
        .query("tags")
        .withIndex("by_board", (q) => q.eq("boardId", args.boardId))
        .collect();
      
      for (const tag of tags) {
        await ctx.db.delete(tag._id);
      }

      // Delete all node tags - get all node tags and filter by board
      const allNodeTags = await ctx.db.query("nodeTags").collect();
      const boardNodeTags = allNodeTags.filter(nt => 
        nodes.some(node => node._id === nt.nodeId)
      );
      
      for (const nodeTag of boardNodeTags) {
        await ctx.db.delete(nodeTag._id);
      }

      return { success: true, deleted: { nodes: nodes.length, edges: edges.length, tags: tags.length, nodeTags: boardNodeTags.length } };
    } catch (error) {
      console.error("Error clearing board");
      throw new Error(`Failed to clear board: ${error instanceof Error ? error.message : String(error)}`);
    }
  },
});

export const deleteBoard = mutation({
  args: { boardId: v.id("boards") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const board = await ctx.db.get(args.boardId);
    if (!board) {
      throw new Error("Board not found");
    }

    if (board.ownerUserId !== identity.subject) {
      throw new Error("Access denied");
    }

    // Delete all nodes, edges, tags, etc. for this board
    const nodes = await ctx.db
      .query("nodes")
      .withIndex("by_board", (q) => q.eq("boardId", args.boardId))
      .collect();
    
    for (const node of nodes) {
      await ctx.db.delete(node._id);
    }

    const edges = await ctx.db
      .query("edges")
      .withIndex("by_board", (q) => q.eq("boardId", args.boardId))
      .collect();
    
    for (const edge of edges) {
      await ctx.db.delete(edge._id);
    }

    // Delete all tags for this board
    const tags = await ctx.db
      .query("tags")
      .withIndex("by_board", (q) => q.eq("boardId", args.boardId))
      .collect();
    
    for (const tag of tags) {
      await ctx.db.delete(tag._id);
    }

    // Delete all node tags for this board
    for (const node of nodes) {
      const nodeTags = await ctx.db
        .query("nodeTags")
        .withIndex("by_node", (q) => q.eq("nodeId", node._id))
        .collect();
      
      for (const nodeTag of nodeTags) {
        await ctx.db.delete(nodeTag._id);
      }
    }

    await ctx.db.delete(args.boardId);
  },
});

export const updateAccessMetadata = mutation({
  args: { boardId: v.id("boards") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const board = await ctx.db.get(args.boardId);
    if (!board) {
      throw new Error("Board not found");
    }

    if (board.ownerUserId !== identity.subject) {
      throw new Error("Access denied");
    }

    // Update last accessed metadata
    await ctx.db.patch(args.boardId, {
      lastAccessedAt: Date.now(),
      lastAccessedBy: identity.subject,
    });
  },
});