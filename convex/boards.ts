import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { validateBoardTitle, validateBoardDescription } from "./validation";
// Using Clerk via convex/react-clerk; rely on ctx.auth.getUserIdentity()

export const listBoards = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return await ctx.db
        .query("boards")
        .withIndex("by_public", (q) => q.eq("isPublic", true))
        .order("desc")
        .take(20);
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
  returns: v.id("boards"),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = identity?.subject ?? `guest_${Math.random().toString(36).slice(2, 10)}`;
    const isGuest = identity === null;
    const start = Date.now();
    console.log("[createBoard] start", { at: new Date(start).toISOString(), userId });
    try {
      console.log("[createBoard] validating inputs");
      const validatedTitle = validateBoardTitle(args.title);
      const validatedDescription = args.description ? validateBoardDescription(args.description) : undefined;

      console.log("[createBoard] inserting row", {
        ownerUserId: userId,
        title: validatedTitle,
        hasDescription: Boolean(validatedDescription),
      });
      const boardId = await ctx.db.insert("boards", {
        ownerUserId: userId,
        title: validatedTitle,
        description: validatedDescription,
        isPublic: isGuest ? true : false,
        createdBy: userId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      console.log("[createBoard] inserted", { boardId });
      console.log("[createBoard] done", { durationMs: Date.now() - start });
      return boardId;
    } catch (err) {
      console.error("[createBoard] error", err);
      throw err;
    }
  },
});

export const getBoard = query({
  args: { boardId: v.id("boards") },
  handler: async (ctx, args) => {
    console.log("[AUTH] Checking identity for getBoard");
    const identity = await ctx.auth.getUserIdentity();
    console.log("[AUTH] Identity result for getBoard", identity ?? null);

    const board = await ctx.db.get(args.boardId);
    if (!board) {
      throw new Error("Board not found");
    }

    if (!identity) {
      if (board.isPublic) {
        return board;
      }
      console.log("[AUTH] Unauthenticated access denied for private board");
      return {
        status: "unauthenticated",
        board: null,
      };
    }

    if (board.ownerUserId !== identity.subject) {
      if (board.isPublic) {
        return board;
      }
      throw new Error("Access denied");
    }

    return board;
  },
});

// Temporary diagnostic query to inspect auth bridge
export const testAuth = query({
  args: {},
  handler: async (ctx) => {
    console.log("[AUTH] testAuth invoked");
    const identity = await ctx.auth.getUserIdentity();
    console.log("[AUTH] testAuth identity", identity ?? null);
    return identity ?? null;
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
    const userId = identity?.subject;
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const board = await ctx.db.get(args.boardId);
    if (!board) {
      throw new Error("Board not found");
    }

    if (board.ownerUserId !== userId) {
      throw new Error("Access denied");
    }

    // Update last accessed metadata
    await ctx.db.patch(args.boardId, {
      lastAccessedAt: Date.now(),
      lastAccessedBy: userId,
    });
  },
});
