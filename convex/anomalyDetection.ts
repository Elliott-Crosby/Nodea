import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getOptionalAuthUserId } from "./security";
import { logSecurityEvent, logWarning } from "./logging";

/**
 * Anomaly detection system for Nodea MVP 2.1
 * Monitors for suspicious patterns and triggers alerts
 */

// Anomaly detection thresholds
const THRESHOLDS = {
  REQUESTS_PER_MINUTE: 20,      // >20 requests per minute per user
  REQUESTS_PER_HOUR: 100,       // >100 requests per hour per user
  EXPORTS_PER_HOUR: 10,         // >10 exports per hour per user
  COST_PER_DAY: 50,             // >$50 per day per user
  FAILED_AUTH_ATTEMPTS: 5,      // >5 failed auth attempts per hour
  CONCURRENT_SESSIONS: 3,       // >3 concurrent sessions per user
};

// Anomaly tracking storage (in-memory for now)
const anomalyMetrics = new Map<string, {
  userId: string;
  requestCount: number;
  lastRequest: number;
  hourlyRequests: number;
  dailyCost: number;
  exportCount: number;
  failedAuthAttempts: number;
  lastFailedAuth: number;
  concurrentSessions: number;
  lastActivity: number;
}>();

/**
 * Track user activity for anomaly detection
 */
export function trackUserActivity(
  userId: string,
  activityType: 'request' | 'export' | 'auth_failure' | 'session_start' | 'session_end',
  cost?: number
): void {
  const now = Date.now();
  const activity = anomalyMetrics.get(userId) || {
    userId,
    requestCount: 0,
    lastRequest: 0,
    hourlyRequests: 0,
    dailyCost: 0,
    exportCount: 0,
    failedAuthAttempts: 0,
    lastFailedAuth: 0,
    concurrentSessions: 0,
    lastActivity: now
  };

  // Reset hourly counters if it's been more than an hour
  if (now - activity.lastRequest > 3600000) {
    activity.hourlyRequests = 0;
  }

  // Reset daily cost if it's been more than a day
  if (now - activity.lastActivity > 86400000) {
    activity.dailyCost = 0;
  }

  // Update activity based on type
  switch (activityType) {
    case 'request':
      activity.requestCount++;
      activity.lastRequest = now;
      activity.hourlyRequests++;
      if (cost) {
        activity.dailyCost += cost;
      }
      break;
    case 'export':
      activity.exportCount++;
      break;
    case 'auth_failure':
      activity.failedAuthAttempts++;
      activity.lastFailedAuth = now;
      break;
    case 'session_start':
      activity.concurrentSessions++;
      break;
    case 'session_end':
      activity.concurrentSessions = Math.max(0, activity.concurrentSessions - 1);
      break;
  }

  activity.lastActivity = now;
  anomalyMetrics.set(userId, activity);

  // Check for anomalies
  checkAnomalies(userId, activity);
}

/**
 * Check for anomalies and trigger alerts
 */
function checkAnomalies(userId: string, activity: any): void {
  const now = Date.now();
  const oneMinute = 60000;
  const oneHour = 3600000;

  // Check request rate anomalies
  if (activity.hourlyRequests > THRESHOLDS.REQUESTS_PER_HOUR) {
    logSecurityEvent(
      'high_request_rate',
      `req_${Date.now()}`,
      userId,
      'high',
      {
        requestsPerHour: activity.hourlyRequests,
        threshold: THRESHOLDS.REQUESTS_PER_HOUR
      }
    );
  }

  // Check export rate anomalies
  if (activity.exportCount > THRESHOLDS.EXPORTS_PER_HOUR) {
    logSecurityEvent(
      'high_export_rate',
      `req_${Date.now()}`,
      userId,
      'medium',
      {
        exportsPerHour: activity.exportCount,
        threshold: THRESHOLDS.EXPORTS_PER_HOUR
      }
    );
  }

  // Check cost anomalies
  if (activity.dailyCost > THRESHOLDS.COST_PER_DAY) {
    logSecurityEvent(
      'high_daily_cost',
      `req_${Date.now()}`,
      userId,
      'high',
      {
        dailyCost: activity.dailyCost,
        threshold: THRESHOLDS.COST_PER_DAY
      }
    );
  }

  // Check failed authentication attempts
  if (activity.failedAuthAttempts > THRESHOLDS.FAILED_AUTH_ATTEMPTS) {
    logSecurityEvent(
      'multiple_auth_failures',
      `req_${Date.now()}`,
      userId,
      'high',
      {
        failedAttempts: activity.failedAuthAttempts,
        threshold: THRESHOLDS.FAILED_AUTH_ATTEMPTS
      }
    );
  }

  // Check concurrent sessions
  if (activity.concurrentSessions > THRESHOLDS.CONCURRENT_SESSIONS) {
    logSecurityEvent(
      'multiple_concurrent_sessions',
      `req_${Date.now()}`,
      userId,
      'medium',
      {
        concurrentSessions: activity.concurrentSessions,
        threshold: THRESHOLDS.CONCURRENT_SESSIONS
      }
    );
  }
}

/**
 * Get anomaly metrics for a user
 */
export const getUserAnomalyMetrics = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getOptionalAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const activity = anomalyMetrics.get(userId);
    if (!activity) {
      return {
        userId: `user_${userId.slice(-8)}`,
        requestCount: 0,
        hourlyRequests: 0,
        dailyCost: 0,
        exportCount: 0,
        failedAuthAttempts: 0,
        concurrentSessions: 0,
        lastActivity: null
      };
    }

    return {
      userId: `user_${userId.slice(-8)}`,
      requestCount: activity.requestCount,
      hourlyRequests: activity.hourlyRequests,
      dailyCost: activity.dailyCost,
      exportCount: activity.exportCount,
      failedAuthAttempts: activity.failedAuthAttempts,
      concurrentSessions: activity.concurrentSessions,
      lastActivity: activity.lastActivity
    };
  },
});

/**
 * Get system-wide anomaly metrics (admin only)
 */
export const getSystemAnomalyMetrics = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getOptionalAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // TODO: Add admin check here
    // For now, allow any authenticated user to see system metrics

    const totalUsers = anomalyMetrics.size;
    const totalRequests = Array.from(anomalyMetrics.values())
      .reduce((sum, activity) => sum + activity.requestCount, 0);
    const totalCost = Array.from(anomalyMetrics.values())
      .reduce((sum, activity) => sum + activity.dailyCost, 0);
    const totalExports = Array.from(anomalyMetrics.values())
      .reduce((sum, activity) => sum + activity.exportCount, 0);

    // Find users with high activity
    const highActivityUsers = Array.from(anomalyMetrics.values())
      .filter(activity => 
        activity.hourlyRequests > THRESHOLDS.REQUESTS_PER_HOUR ||
        activity.dailyCost > THRESHOLDS.COST_PER_DAY ||
        activity.exportCount > THRESHOLDS.EXPORTS_PER_HOUR
      )
      .map(activity => ({
        userId: `user_${activity.userId.slice(-8)}`,
        hourlyRequests: activity.hourlyRequests,
        dailyCost: activity.dailyCost,
        exportCount: activity.exportCount
      }));

    return {
      totalUsers,
      totalRequests,
      totalCost,
      totalExports,
      highActivityUsers,
      thresholds: THRESHOLDS,
      timestamp: new Date().toISOString()
    };
  },
});

/**
 * Reset anomaly metrics for a user (admin only)
 */
export const resetUserAnomalyMetrics = mutation({
  args: { targetUserId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userId = await getOptionalAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // TODO: Add admin check here
    // For now, allow users to reset their own metrics
    const targetUserId = args.targetUserId || userId;

    if (targetUserId !== userId) {
      throw new Error("Access denied. You can only reset your own metrics.");
    }

    anomalyMetrics.delete(targetUserId);

    logSecurityEvent(
      'anomaly_metrics_reset',
      `req_${Date.now()}`,
      userId,
      'low',
      { targetUserId: `user_${targetUserId.slice(-8)}` }
    );

    return { success: true };
  },
});

/**
 * Update anomaly detection thresholds (admin only)
 */
export const updateAnomalyThresholds = mutation({
  args: {
    requestsPerHour: v.optional(v.number()),
    exportsPerHour: v.optional(v.number()),
    costPerDay: v.optional(v.number()),
    failedAuthAttempts: v.optional(v.number()),
    concurrentSessions: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getOptionalAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // TODO: Add admin check here
    // For now, allow any authenticated user to update thresholds

    if (args.requestsPerHour !== undefined) {
      THRESHOLDS.REQUESTS_PER_HOUR = args.requestsPerHour;
    }
    if (args.exportsPerHour !== undefined) {
      THRESHOLDS.EXPORTS_PER_HOUR = args.exportsPerHour;
    }
    if (args.costPerDay !== undefined) {
      THRESHOLDS.COST_PER_DAY = args.costPerDay;
    }
    if (args.failedAuthAttempts !== undefined) {
      THRESHOLDS.FAILED_AUTH_ATTEMPTS = args.failedAuthAttempts;
    }
    if (args.concurrentSessions !== undefined) {
      THRESHOLDS.CONCURRENT_SESSIONS = args.concurrentSessions;
    }

    logSecurityEvent(
      'anomaly_thresholds_updated',
      `req_${Date.now()}`,
      userId,
      'low',
      { newThresholds: THRESHOLDS }
    );

    return { success: true, thresholds: THRESHOLDS };
  },
});

/**
 * Clean up old anomaly metrics
 */
export const cleanupAnomalyMetrics = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getOptionalAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // TODO: Add admin check here

    const oneDayAgo = Date.now() - 86400000; // 24 hours
    let cleanedCount = 0;

    for (const [userId, activity] of anomalyMetrics.entries()) {
      if (activity.lastActivity < oneDayAgo) {
        anomalyMetrics.delete(userId);
        cleanedCount++;
      }
    }

    return {
      cleanedCount,
      remainingUsers: anomalyMetrics.size,
      timestamp: new Date().toISOString()
    };
  },
});
