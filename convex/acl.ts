import { getOptionalAuthUserId } from "./security";
import { Doc, Id } from "./_generated/dataModel";

/**
 * Access Control List (ACL) utilities for least-privilege security
 */

export type AccessLevel = "none" | "read" | "write" | "admin";
export type ResourceType = "board" | "node" | "edge" | "apiKey" | "shareToken";

/**
 * Check if user has access to a resource
 */
export async function checkAccess(
  ctx: any,
  resourceType: ResourceType,
  resourceId: Id<any>,
  requiredLevel: AccessLevel = "read"
): Promise<boolean> {
  const userId = await getOptionalAuthUserId(ctx);
  if (!userId) {
    return false;
  }

  switch (resourceType) {
    case "board":
      return await checkBoardAccess(ctx, resourceId as Id<"boards">, userId, requiredLevel);
    case "node":
      return await checkNodeAccess(ctx, resourceId as Id<"nodes">, userId, requiredLevel);
    case "edge":
      return await checkEdgeAccess(ctx, resourceId as Id<"edges">, userId, requiredLevel);
    case "apiKey":
      return await checkApiKeyAccess(ctx, resourceId as Id<"apiKeys">, userId, requiredLevel);
    case "shareToken":
      return await checkShareTokenAccess(ctx, resourceId as Id<"sharingTokens">, userId, requiredLevel);
    default:
      return false;
  }
}

/**
 * Check board access with least-privilege
 */
async function checkBoardAccess(
  ctx: any,
  boardId: Id<"boards">,
  userId: Id<"users">,
  requiredLevel: AccessLevel
): Promise<boolean> {
  const board = await ctx.db.get(boardId);
  if (!board) {
    return false;
  }

  // Owner has all access
  if (board.ownerUserId === userId) {
    return true;
  }

  // Public boards have read access only
  if (board.isPublic && requiredLevel === "read") {
    return true;
  }

  // Check for shared access
  const shareToken = await ctx.db
    .query("sharingTokens")
    .withIndex("by_board", (q: any) => q.eq("boardId", boardId))
    .filter((q: any) => q.gte(q.field("expiresAt"), Date.now()))
    .first();

  if (shareToken) {
    switch (shareToken.access) {
      case "view":
        return requiredLevel === "read";
      case "comment":
        return requiredLevel === "read" || requiredLevel === "write";
      default:
        return false;
    }
  }

  return false;
}

/**
 * Check node access (inherits from board)
 */
async function checkNodeAccess(
  ctx: any,
  nodeId: Id<"nodes">,
  userId: Id<"users">,
  requiredLevel: AccessLevel
): Promise<boolean> {
  const node = await ctx.db.get(nodeId);
  if (!node) {
    return false;
  }

  // Check access through the board
  return await checkBoardAccess(ctx, node.boardId, userId, requiredLevel);
}

/**
 * Check edge access (inherits from board)
 */
async function checkEdgeAccess(
  ctx: any,
  edgeId: Id<"edges">,
  userId: Id<"users">,
  requiredLevel: AccessLevel
): Promise<boolean> {
  const edge = await ctx.db.get(edgeId);
  if (!edge) {
    return false;
  }

  // Check access through the board
  return await checkBoardAccess(ctx, edge.boardId, userId, requiredLevel);
}

/**
 * Check API key access (owner only)
 */
async function checkApiKeyAccess(
  ctx: any,
  apiKeyId: Id<"apiKeys">,
  userId: Id<"users">,
  requiredLevel: AccessLevel
): Promise<boolean> {
  const apiKey = await ctx.db.get(apiKeyId);
  if (!apiKey) {
    return false;
  }

  // Only owner can access their API keys
  return apiKey.ownerUserId === userId;
}

/**
 * Check share token access
 */
async function checkShareTokenAccess(
  ctx: any,
  shareTokenId: Id<"sharingTokens">,
  userId: Id<"users">,
  requiredLevel: AccessLevel
): Promise<boolean> {
  const shareToken = await ctx.db.get(shareTokenId);
  if (!shareToken) {
    return false;
  }

  // Check if user owns the board that the token shares
  return await checkBoardAccess(ctx, shareToken.boardId, userId, "admin");
}

/**
 * Require access to a resource (throws if denied)
 */
export async function requireAccess(
  ctx: any,
  resourceType: ResourceType,
  resourceId: Id<any>,
  requiredLevel: AccessLevel = "read"
): Promise<void> {
  const hasAccess = await checkAccess(ctx, resourceType, resourceId, requiredLevel);
  if (!hasAccess) {
    throw new Error(`Access denied to ${resourceType} ${resourceId}`);
  }
}

/**
 * Get user's access level to a resource
 */
export async function getUserAccessLevel(
  ctx: any,
  resourceType: ResourceType,
  resourceId: Id<any>
): Promise<AccessLevel> {
  const userId = await getOptionalAuthUserId(ctx);
  if (!userId) {
    return "none";
  }

  // Check from highest to lowest privilege
  if (await checkAccess(ctx, resourceType, resourceId, "admin")) {
    return "admin";
  }
  if (await checkAccess(ctx, resourceType, resourceId, "write")) {
    return "write";
  }
  if (await checkAccess(ctx, resourceType, resourceId, "read")) {
    return "read";
  }
  return "none";
}

/**
 * Filter resources based on user access
 */
export async function filterByAccess<T extends { _id: Id<any> }>(
  ctx: any,
  resources: T[],
  resourceType: ResourceType,
  requiredLevel: AccessLevel = "read"
): Promise<T[]> {
  const userId = await getOptionalAuthUserId(ctx);
  if (!userId) {
    return [];
  }

  const accessibleResources: T[] = [];
  
  for (const resource of resources) {
    if (await checkAccess(ctx, resourceType, resource._id, requiredLevel)) {
      accessibleResources.push(resource);
    }
  }

  return accessibleResources;
}

/**
 * Check if user can perform action on resource
 */
export async function canPerformAction(
  ctx: any,
  action: string,
  resourceType: ResourceType,
  resourceId: Id<any>
): Promise<boolean> {
  const userId = await getOptionalAuthUserId(ctx);
  if (!userId) {
    return false;
  }

  // Define action requirements
  const actionRequirements: Record<string, AccessLevel> = {
    "read": "read",
    "view": "read",
    "create": "write",
    "update": "write",
    "edit": "write",
    "delete": "admin",
    "share": "admin",
    "manage": "admin",
  };

  const requiredLevel = actionRequirements[action] || "write";
  return await checkAccess(ctx, resourceType, resourceId, requiredLevel);
}

/**
 * Audit log for access attempts
 */
export async function logAccessAttempt(
  ctx: any,
  userId: Id<"users"> | null,
  resourceType: ResourceType,
  resourceId: Id<any>,
  action: string,
  success: boolean,
  details?: string
): Promise<void> {
  try {
    await ctx.db.insert("auditLog", {
      userId: userId || undefined,
      action,
      resourceType,
      resourceId: resourceId.toString(),
      success,
      details,
      createdAt: Date.now(),
    });
  } catch (error) {
    // Don't fail the main operation if audit logging fails
    console.error("Failed to log access attempt:", error);
  }
}
