import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth } from "./security";

export const exportMarkdown = query({
  args: { boardId: v.id("boards") },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
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

    // Get all nodes and edges
    const nodes = await ctx.db
      .query("nodes")
      .withIndex("by_board", (q) => q.eq("boardId", args.boardId))
      .collect();

    const edges = await ctx.db
      .query("edges")
      .withIndex("by_board", (q) => q.eq("boardId", args.boardId))
      .collect();

    // Find root nodes (no incoming lineage edges)
    const nodeIds = new Set(nodes.map(n => n._id));
    const hasIncomingLineage = new Set();
    
    edges.forEach(edge => {
      if (edge.kind === "lineage") {
        hasIncomingLineage.add(edge.dstNodeId);
      }
    });

    const rootNodes = nodes.filter(node => !hasIncomingLineage.has(node._id));

    // Generate markdown outline using BFS
    let markdown = `# ${board.title}\n\n`;
    if (board.description) {
      markdown += `${board.description}\n\n`;
    }

    const visited = new Set<string>();
    const citations: string[] = [];

    for (const root of rootNodes) {
      markdown += generateNodeMarkdown(root, nodes, edges, visited, citations, 1);
    }

    // Add citations
    if (citations.length > 0) {
      markdown += "\n## Citations\n\n";
      citations.forEach((citation, index) => {
        markdown += `[${index + 1}]: ${citation}\n`;
      });
    }

    return markdown;
  },
});

export const exportJson = query({
  args: { boardId: v.id("boards") },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
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

    // Get all nodes and edges
    const nodes = await ctx.db
      .query("nodes")
      .withIndex("by_board", (q) => q.eq("boardId", args.boardId))
      .collect();

    const edges = await ctx.db
      .query("edges")
      .withIndex("by_board", (q) => q.eq("boardId", args.boardId))
      .collect();

    return JSON.stringify({
      board: {
        id: board._id,
        title: board.title,
        description: board.description,
        createdAt: board._creationTime,
        updatedAt: board.updatedAt,
      },
      nodes: nodes.map(node => ({
        id: node._id,
        type: node.type,
        title: node.title,
        content: node.content,
        position: node.position,
        size: node.size,
        collapsed: node.collapsed,
        meta: node.meta,
        createdAt: node._creationTime,
        updatedAt: node.updatedAt,
      })),
      edges: edges.map(edge => ({
        id: edge._id,
        source: edge.srcNodeId,
        target: edge.dstNodeId,
        kind: edge.kind,
        label: edge.label,
        createdAt: edge._creationTime,
      })),
    }, null, 2);
  },
});

function generateNodeMarkdown(
  node: any,
  allNodes: any[],
  allEdges: any[],
  visited: Set<string>,
  citations: string[],
  depth: number
): string {
  if (visited.has(node._id)) return "";
  visited.add(node._id);

  const heading = "#".repeat(Math.min(depth, 6));
  let markdown = `${heading} ${node.title}\n\n`;
  
  if (node.content) {
    markdown += `${node.content}\n\n`;
  }

  // Add citations from node meta
  if (node.meta?.sources) {
    node.meta.sources.forEach((source: any) => {
      const citationIndex = citations.length + 1;
      citations.push(`${source.title} - ${source.url}`);
      markdown += `[${citationIndex}] `;
    });
    markdown += "\n\n";
  }

  // Find children (outgoing lineage edges)
  const childEdges = allEdges.filter(edge => 
    edge.srcNodeId === node._id && edge.kind === "lineage"
  );

  for (const edge of childEdges) {
    const childNode = allNodes.find(n => n._id === edge.dstNodeId);
    if (childNode) {
      markdown += generateNodeMarkdown(childNode, allNodes, allEdges, visited, citations, depth + 1);
    }
  }

  return markdown;
}

export const clearBoard = mutation({
  args: { boardId: v.id("boards") },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    try {
      // Delete all nodes for this board
      const nodes = await ctx.db
        .query("nodes")
        .withIndex("by_board", (q) => q.eq("boardId", args.boardId))
        .collect();
      
      // Security: No logging of sensitive data
      for (const node of nodes) {
        await ctx.db.delete(node._id);
      }

      // Delete all edges for this board
      const edges = await ctx.db
        .query("edges")
        .withIndex("by_board", (q) => q.eq("boardId", args.boardId))
        .collect();
      
      // Security: No logging of sensitive data
      for (const edge of edges) {
        await ctx.db.delete(edge._id);
      }

      // Delete all tags for this board
      const tags = await ctx.db
        .query("tags")
        .withIndex("by_board", (q) => q.eq("boardId", args.boardId))
        .collect();
      
      // Security: No logging of sensitive data
      for (const tag of tags) {
        await ctx.db.delete(tag._id);
      }

      // Delete all node tags - get all node tags and filter by board
      const allNodeTags = await ctx.db.query("nodeTags").collect();
      const boardNodeTags = allNodeTags.filter(nt => 
        nodes.some(node => node._id === nt.nodeId)
      );
      
      // Security: No logging of sensitive data
      for (const nodeTag of boardNodeTags) {
        await ctx.db.delete(nodeTag._id);
      }

      // Board cleared successfully
      return { success: true, deleted: { nodes: nodes.length, edges: edges.length, tags: tags.length, nodeTags: boardNodeTags.length } };
    } catch (error) {
      // Security: Log error without sensitive data
      console.error("Error clearing board");
      throw new Error(`Failed to clear board: ${error instanceof Error ? error.message : String(error)}`);
    }
  },
});
