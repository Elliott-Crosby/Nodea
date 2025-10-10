import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getOptionalAuthUserId } from "./security";

/**
 * Observability and monitoring system for Nodea MVP 2.1
 * Provides structured logging, request tracking, and anomaly detection
 */

// Request tracking storage (in-memory for now, could be persisted)
const requestMetrics = new Map<string, {
  requestId: string;
  userId: string | null;
  functionName: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  tokenCount?: number;
  cost?: number;
  status: 'pending' | 'completed' | 'failed';
  error?: string;
}>();

// User activity tracking for anomaly detection
const userActivity = new Map<string, {
  userId: string;
  requestCount: number;
  lastRequest: number;
  hourlyRequests: number;
  dailyCost: number;
  exportCount: number;
  lastExport: number;
}>();

/**
 * Generate a unique request ID
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Start tracking a request
 */
export function startRequestTracking(
  functionName: string,
  userId: string | null = null
): string {
  const requestId = generateRequestId();
  
  requestMetrics.set(requestId, {
    requestId,
    userId,
    functionName,
    startTime: Date.now(),
    status: 'pending'
  });

  // Update user activity
  if (userId) {
    const activity = userActivity.get(userId) || {
      userId,
      requestCount: 0,
      lastRequest: 0,
      hourlyRequests: 0,
      dailyCost: 0,
      exportCount: 0,
      lastExport: 0
    };
    
    activity.requestCount++;
    activity.lastRequest = Date.now();
    
    // Reset hourly count if it's been more than an hour
    if (Date.now() - activity.lastRequest > 3600000) {
      activity.hourlyRequests = 0;
    }
    activity.hourlyRequests++;
    
    userActivity.set(userId, activity);
  }

  return requestId;
}

/**
 * Complete request tracking
 */
export function completeRequestTracking(
  requestId: string,
  status: 'completed' | 'failed' = 'completed',
  tokenCount?: number,
  cost?: number,
  error?: string
): void {
  const request = requestMetrics.get(requestId);
  if (!request) return;

  const endTime = Date.now();
  const duration = endTime - request.startTime;

  request.endTime = endTime;
  request.duration = duration;
  request.status = status;
  request.tokenCount = tokenCount;
  request.cost = cost;
  request.error = error;

  // Update user activity with cost
  if (request.userId && cost) {
    const activity = userActivity.get(request.userId);
    if (activity) {
      activity.dailyCost += cost;
      userActivity.set(request.userId, activity);
    }
  }

  // Log structured request data (no sensitive payloads)
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    requestId,
    userId: request.userId ? `user_${request.userId.slice(-8)}` : null, // Truncated for privacy
    functionName: request.functionName,
    duration,
    tokenCount,
    cost,
    status,
    error: error ? error.substring(0, 100) : undefined // Truncated error message
  }));

  // Check for anomalies
  checkAnomalies(request.userId);
}

/**
 * Track export activity
 */
export function trackExport(userId: string): void {
  const activity = userActivity.get(userId) || {
    userId,
    requestCount: 0,
    lastRequest: 0,
    hourlyRequests: 0,
    dailyCost: 0,
    exportCount: 0,
    lastExport: 0
  };
  
  activity.exportCount++;
  activity.lastExport = Date.now();
  
  userActivity.set(userId, activity);
  
  // Check for export anomalies
  checkExportAnomalies(userId);
}

/**
 * Check for anomalies and trigger alerts
 */
function checkAnomalies(userId: string | null): void {
  if (!userId) return;
  
  const activity = userActivity.get(userId);
  if (!activity) return;

  const now = Date.now();
  const oneHour = 3600000;
  const oneDay = 86400000;

  // Check request rate anomalies
  if (activity.hourlyRequests > 100) { // >100 requests/hour
    console.warn(JSON.stringify({
      type: 'anomaly_alert',
      severity: 'high',
      userId: `user_${userId.slice(-8)}`,
      metric: 'request_rate',
      value: activity.hourlyRequests,
      threshold: 100,
      message: 'High request rate detected',
      timestamp: new Date().toISOString()
    }));
  }

  // Check daily cost anomalies
  if (activity.dailyCost > 50) { // >$50/day
    console.warn(JSON.stringify({
      type: 'anomaly_alert',
      severity: 'high',
      userId: `user_${userId.slice(-8)}`,
      metric: 'daily_cost',
      value: activity.dailyCost,
      threshold: 50,
      message: 'High daily cost detected',
      timestamp: new Date().toISOString()
    }));
  }
}

/**
 * Check for export anomalies
 */
function checkExportAnomalies(userId: string): void {
  const activity = userActivity.get(userId);
  if (!activity) return;

  const now = Date.now();
  const oneHour = 3600000;

  // Check export rate anomalies
  if (activity.exportCount > 10) { // >10 exports/hour
    console.warn(JSON.stringify({
      type: 'anomaly_alert',
      severity: 'medium',
      userId: `user_${userId.slice(-8)}`,
      metric: 'export_rate',
      value: activity.exportCount,
      threshold: 10,
      message: 'High export rate detected',
      timestamp: new Date().toISOString()
    }));
  }
}

/**
 * Get request metrics for monitoring
 */
export const getRequestMetrics = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getOptionalAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const limit = args.limit || 100;
    const metrics = Array.from(requestMetrics.values())
      .filter(m => m.userId === userId)
      .sort((a, b) => b.startTime - a.startTime)
      .slice(0, limit);

    return metrics.map(m => ({
      requestId: m.requestId,
      functionName: m.functionName,
      startTime: m.startTime,
      duration: m.duration,
      tokenCount: m.tokenCount,
      cost: m.cost,
      status: m.status,
      error: m.error
    }));
  },
});

/**
 * Get user activity summary
 */
export const getUserActivity = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getOptionalAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const activity = userActivity.get(userId);
    if (!activity) {
      return {
        userId: `user_${userId.slice(-8)}`,
        requestCount: 0,
        hourlyRequests: 0,
        dailyCost: 0,
        exportCount: 0,
        lastRequest: null,
        lastExport: null
      };
    }

    return {
      userId: `user_${userId.slice(-8)}`,
      requestCount: activity.requestCount,
      hourlyRequests: activity.hourlyRequests,
      dailyCost: activity.dailyCost,
      exportCount: activity.exportCount,
      lastRequest: activity.lastRequest,
      lastExport: activity.lastExport
    };
  },
});

/**
 * Get system-wide metrics (admin only)
 */
export const getSystemMetrics = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getOptionalAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // TODO: Add admin check here
    // For now, allow any authenticated user to see system metrics

    const totalRequests = requestMetrics.size;
    const activeUsers = userActivity.size;
    const totalCost = Array.from(userActivity.values())
      .reduce((sum, activity) => sum + activity.dailyCost, 0);

    return {
      totalRequests,
      activeUsers,
      totalCost,
      timestamp: new Date().toISOString()
    };
  },
});

/**
 * Clean up old metrics (run periodically)
 */
export const cleanupOldMetrics = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getOptionalAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // TODO: Add admin check here

    const oneDayAgo = Date.now() - 86400000; // 24 hours
    
    // Clean up old request metrics
    for (const [requestId, request] of requestMetrics.entries()) {
      if (request.startTime < oneDayAgo) {
        requestMetrics.delete(requestId);
      }
    }

    // Clean up old user activity (reset daily counters)
    for (const [userId, activity] of userActivity.entries()) {
      if (Date.now() - activity.lastRequest > 86400000) {
        activity.dailyCost = 0;
        activity.hourlyRequests = 0;
        userActivity.set(userId, activity);
      }
    }

    return {
      cleanedRequests: requestMetrics.size,
      activeUsers: userActivity.size,
      timestamp: new Date().toISOString()
    };
  },
});
