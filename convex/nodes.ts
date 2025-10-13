import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { requireAuth } from "./security";
import { 
  validateNodeContent, 
  validatePosition, 
  validateModelName, 
  validateProviderName,
  validateTemperature,
  validateMaxTokens 
} from "./validation";

export const listNodesByBoard = query({
  args: { boardId: v.id("boards") },
  handler: async (ctx: any, args: { boardId: Id<"boards"> }) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = identity?.subject;
    if (!userId) throw new Error("Not authenticated");

    // Check board access
    const board = await ctx.db.get(args.boardId);
    if (!board) {
      throw new Error("Board not found");
    }

    if (board.ownerUserId !== userId && !board.isPublic) {
      throw new Error("Access denied");
    }

    return await ctx.db
      .query("nodes")
      .withIndex("by_board", (q: any) => q.eq("boardId", args.boardId))
      .collect();
  },
});

export const createNode = mutation({
  args: {
    boardId: v.id("boards"),
    type: v.union(v.literal("prompt"), v.literal("message"), v.literal("response"), v.literal("note"), v.literal("frame")),
    role: v.optional(v.union(v.literal("user"), v.literal("assistant"))),
    title: v.optional(v.string()),
    content: v.string(),
    position: v.object({
      x: v.number(),
      y: v.number(),
    }),
    size: v.optional(v.object({
      width: v.number(),
      height: v.number(),
    })),
    collapsed: v.optional(v.boolean()),
    meta: v.optional(v.object({
      model: v.optional(v.string()),
      provider: v.optional(v.string()),
      tokens: v.optional(v.object({
        input: v.number(),
        output: v.number(),
      })),
      sources: v.optional(v.array(v.object({
        url: v.string(),
        title: v.string(),
        at: v.number(),
      }))),
    })),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Check board access
    const board = await ctx.db.get(args.boardId);
    if (!board || board.ownerUserId !== userId) {
      throw new Error("Board not found or access denied");
    }

    const nodeId = await ctx.db.insert("nodes", {
      boardId: args.boardId,
      type: args.type,
      title: args.title,
      content: args.content,
      position: args.position,
      size: args.size,
      collapsed: args.collapsed ?? false,
      meta: args.meta ?? {},
      createdBy: userId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return nodeId;
  },
});

export const updateNode = mutation({
  args: {
    nodeId: v.id("nodes"),
    title: v.optional(v.string()),
    content: v.optional(v.string()),
    position: v.optional(v.object({
      x: v.number(),
      y: v.number(),
    })),
    size: v.optional(v.object({
      width: v.number(),
      height: v.number(),
    })),
    collapsed: v.optional(v.boolean()),
    meta: v.optional(v.object({
      model: v.optional(v.string()),
      provider: v.optional(v.string()),
      tokens: v.optional(v.object({
        input: v.number(),
        output: v.number(),
      })),
      sources: v.optional(v.array(v.object({
        url: v.string(),
        title: v.string(),
        at: v.number(),
      }))),
    })),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const node = await ctx.db.get(args.nodeId);
    if (!node) {
      throw new Error("Node not found");
    }

    // Check board access
    const board = await ctx.db.get(node.boardId);
    if (!board || board.ownerUserId !== userId) {
      throw new Error("Access denied");
    }

    const updates: any = { updatedAt: Date.now() };
    if (args.title !== undefined) updates.title = args.title;
    if (args.content !== undefined) updates.content = args.content;
    if (args.position !== undefined) updates.position = args.position;
    if (args.size !== undefined) updates.size = args.size;
    if (args.collapsed !== undefined) updates.collapsed = args.collapsed;
    if (args.meta !== undefined) updates.meta = args.meta;

    await ctx.db.patch(args.nodeId, updates);
  },
});

export const generateFromMessage = mutation({
  args: {
    boardId: v.id("boards"),
    messageNodeId: v.id("nodes"),
    provider: v.optional(v.string()),
    model: v.optional(v.string()),
    temperature: v.optional(v.number()),
    maxTokens: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<Id<"nodes">> => {
    const userId = await requireAuth(ctx);

    // Get the message node
    const messageNode = await ctx.db.get(args.messageNodeId);
    if (!messageNode || (messageNode.type !== "message" && messageNode.type !== "prompt")) {
      throw new Error("Message node not found");
    }

    // Validate and sanitize inputs
    const validatedProvider = args.provider ? validateProviderName(args.provider) : "openai";
    const validatedModel = args.model ? validateModelName(args.model) : "gpt-4o";
    const validatedTemperature = validateTemperature(args.temperature);
    const validatedMaxTokens = validateMaxTokens(args.maxTokens);

    // Check board access
    const board = await ctx.db.get(args.boardId);
    if (!board || board.ownerUserId !== userId) {
      throw new Error("Board not found or access denied");
    }

    // Get connected nodes to build context
    const connectedEdges = await ctx.db
      .query("edges")
      .withIndex("by_dst", (q) => q.eq("dstNodeId", args.messageNodeId))
      .collect();

    // Build messages array with context
    const messages: Array<{role: "system" | "user" | "assistant", content: string}> = [];
    
    // Add system message
    messages.push({
      role: "system",
      content: "You are a helpful assistant. Respond to the user's message based on the context provided."
    });

    // Add connected context messages
    for (const edge of connectedEdges) {
      const contextNode = await ctx.db.get(edge.srcNodeId);
      if (contextNode && contextNode.content) {
        messages.push({
          role: "user",
          content: contextNode.content
        });
      }
    }

    // Add the main message (validate content)
    messages.push({
      role: "user",
      content: validateNodeContent(messageNode.content)
    });

    // Create a placeholder response node that will be updated by the action
    const responseNodeId = await ctx.db.insert("nodes", {
      boardId: args.boardId,
      type: "response",
      role: "assistant",
      content: "",
      position: {
        x: messageNode.position.x + 400,
        y: messageNode.position.y,
      },
      collapsed: false,
      meta: {
        model: validatedModel,
        provider: validatedProvider,
      },
      createdBy: userId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Schedule the secure LLM completion action to run after this mutation
    // Cast api to any for local shim to satisfy types
    await ctx.scheduler.runAfter(0, (api as any).llmSecure.completeStream, {
      boardId: args.boardId,
      nodeId: args.messageNodeId,
      responseNodeId: responseNodeId,
      messages,
      provider: validatedProvider,
      model: validatedModel,
      temperature: validatedTemperature,
      maxTokens: validatedMaxTokens,
    });

    // Create an edge from message to response
    await ctx.db.insert("edges", {
      boardId: args.boardId,
      srcNodeId: args.messageNodeId,
      dstNodeId: responseNodeId,
      kind: "lineage",
      createdBy: userId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return responseNodeId;
  },
});

// Temporary migration function - call this once to migrate existing prompt nodes
export const migratePromptToMessage = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuth(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Find all nodes with type "prompt"
    const promptNodes = await ctx.db
      .query("nodes")
      .filter((q) => q.eq(q.field("type"), "prompt"))
      .collect();

    // Security: No logging of sensitive data

    // Update each prompt node to message
    for (const node of promptNodes) {
      await ctx.db.patch(node._id, {
        type: "message",
        updatedAt: Date.now(),
      });
      // Security: No logging of sensitive data
    }

    return { migrated: promptNodes.length };
  },
});

export const updateResponseNode = mutation({
  args: {
    nodeId: v.id("nodes"),
    content: v.string(),
    model: v.string(),
    tokens: v.object({
      input: v.number(),
      output: v.number(),
    }),
  },
  handler: async (ctx, args) => {
    const node = await ctx.db.get(args.nodeId);
    if (!node) {
      throw new Error("Node not found");
    }

    await ctx.db.patch(args.nodeId, {
      content: args.content,
      meta: {
        ...node.meta,
        model: args.model,
        tokens: args.tokens,
      },
      updatedAt: Date.now(),
    });
  },
});

export const updateResponseNodeStream = mutation({
  args: {
    nodeId: v.id("nodes"),
    content: v.string(),
    model: v.string(),
  },
  handler: async (ctx, args) => {
    const node = await ctx.db.get(args.nodeId);
    if (!node) {
      throw new Error("Node not found");
    }

    await ctx.db.patch(args.nodeId, {
      content: args.content,
      meta: {
        ...node.meta,
        model: args.model,
      },
      updatedAt: Date.now(),
    });
  },
});

export const deleteNode = mutation({
  args: { 
    nodeId: v.id("nodes"),
    deleteDescendants: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const node = await ctx.db.get(args.nodeId);
    if (!node) {
      throw new Error("Node not found");
    }

    // Check board access
    const board = await ctx.db.get(node.boardId);
    if (!board || board.ownerUserId !== userId) {
      throw new Error("Access denied");
    }

    if (args.deleteDescendants) {
      // Find and delete all descendant nodes
      const descendants = await findDescendants(ctx, args.nodeId);
      for (const descendant of descendants) {
        await ctx.db.delete(descendant._id);
      }
    }

    // Delete edges connected to this node
    const edges = await ctx.db
      .query("edges")
      .withIndex("by_src", (q) => q.eq("srcNodeId", args.nodeId))
      .collect();
    
    const incomingEdges = await ctx.db
      .query("edges")
      .withIndex("by_dst", (q) => q.eq("dstNodeId", args.nodeId))
      .collect();

    for (const edge of [...edges, ...incomingEdges]) {
      await ctx.db.delete(edge._id);
    }

    await ctx.db.delete(args.nodeId);
  },
});

async function findDescendants(ctx: any, nodeId: string): Promise<any[]> {
  const descendants: any[] = [];
  const queue: string[] = [nodeId];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const currentId = queue.shift();
    if (!currentId || visited.has(currentId)) continue;
    visited.add(currentId);

    const outgoingEdges = await ctx.db
      .query("edges")
      .withIndex("by_src", (q: any) => q.eq("srcNodeId", currentId))
      .collect();

    for (const edge of outgoingEdges) {
      if (edge.kind === "lineage") {
        const childNode = await ctx.db.get(edge.dstNodeId);
        if (childNode) {
          descendants.push(childNode as any);
          queue.push(edge.dstNodeId as any);
        }
      }
    }
  }

  return descendants;
}

export const autoTitleNode = mutation({
  args: {
    nodeId: v.id("nodes"),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const node = await ctx.db.get(args.nodeId);
    if (!node) {
      throw new Error("Node not found");
    }

    // Check board access
    const board = await ctx.db.get(node.boardId);
    if (!board || board.ownerUserId !== userId) {
      throw new Error("Access denied");
    }

    // Generate title from first sentence, max 48 chars
    const content = node.content.trim();
    const firstSentence = content.split(/[.!?]/)[0];
    const title = firstSentence.length > 48 
      ? firstSentence.substring(0, 45) + "..."
      : firstSentence;

    await ctx.db.patch(args.nodeId, {
      title: title || "Untitled",
      updatedAt: Date.now(),
    });

    return title;
  },
});
