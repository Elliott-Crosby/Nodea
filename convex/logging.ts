
/**
 * Structured logging utilities for Nodea MVP 2.1
 * Ensures no sensitive data is logged while providing useful observability
 */

export interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  requestId?: string;
  userId?: string;
  functionName?: string;
  message: string;
  duration?: number;
  tokenCount?: number;
  cost?: number;
  status?: string;
  error?: string;
  metadata?: Record<string, any>;
}

/**
 * Create a structured log entry
 */
export function createLogEntry(
  level: LogEntry['level'],
  message: string,
  metadata: Partial<LogEntry> = {}
): LogEntry {
  return {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...metadata
  };
}

/**
 * Log structured entry to console (no sensitive data)
 */
export function logStructured(entry: LogEntry): void {
  // Sanitize the entry to ensure no sensitive data
  const sanitizedEntry = sanitizeLogEntry(entry);
  
  // Log as JSON for easy parsing
  console.log(JSON.stringify(sanitizedEntry));
}

/**
 * Sanitize log entry to remove sensitive data
 */
function sanitizeLogEntry(entry: LogEntry): LogEntry {
  const sanitized = { ...entry };
  
  // Truncate user ID for privacy
  if (sanitized.userId) {
    sanitized.userId = `user_${sanitized.userId.slice(-8)}`;
  }
  
  // Truncate error messages
  if (sanitized.error) {
    sanitized.error = sanitized.error.substring(0, 200);
  }
  
  // Remove any potentially sensitive metadata
  if (sanitized.metadata) {
    sanitized.metadata = sanitizeMetadata(sanitized.metadata);
  }
  
  return sanitized;
}

/**
 * Sanitize metadata to remove sensitive fields
 */
function sanitizeMetadata(metadata: Record<string, any>): Record<string, any> {
  const sensitiveFields = [
    'password', 'token', 'key', 'secret', 'auth', 'credential',
    'email', 'phone', 'ssn', 'personal', 'private'
  ];
  
  const sanitized: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(metadata)) {
    const keyLower = key.toLowerCase();
    
    // Skip sensitive fields
    if (sensitiveFields.some(field => keyLower.includes(field))) {
      continue;
    }
    
    // Sanitize values
    if (typeof value === 'string') {
      sanitized[key] = value.substring(0, 100); // Truncate long strings
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = '[object]'; // Replace objects with placeholder
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
}

/**
 * Log info message
 */
export function logInfo(
  message: string,
  metadata: Partial<LogEntry> = {}
): void {
  const entry = createLogEntry('info', message, metadata);
  logStructured(entry);
}

/**
 * Log warning message
 */
export function logWarning(
  message: string,
  metadata: Partial<LogEntry> = {}
): void {
  const entry = createLogEntry('warn', message, metadata);
  logStructured(entry);
}

/**
 * Log error message
 */
export function logError(
  message: string,
  error?: Error | string,
  metadata: Partial<LogEntry> = {}
): void {
  const entry = createLogEntry('error', message, {
    ...metadata,
    error: error instanceof Error ? error.message : error
  });
  logStructured(entry);
}

/**
 * Log debug message
 */
export function logDebug(
  message: string,
  metadata: Partial<LogEntry> = {}
): void {
  const entry = createLogEntry('debug', message, metadata);
  logStructured(entry);
}

/**
 * Log function entry
 */
export function logFunctionEntry(
  functionName: string,
  requestId: string,
  userId?: string
): void {
  logInfo(`Function entry: ${functionName}`, {
    functionName,
    requestId,
    userId
  });
}

/**
 * Log function exit
 */
export function logFunctionExit(
  functionName: string,
  requestId: string,
  duration: number,
  status: 'success' | 'error' = 'success',
  userId?: string,
  tokenCount?: number,
  cost?: number,
  error?: string
): void {
  const level = status === 'error' ? 'error' : 'info';
  const message = `Function exit: ${functionName} (${status})`;
  
  logStructured(createLogEntry(level, message, {
    functionName,
    requestId,
    userId,
    duration,
    tokenCount,
    cost,
    status,
    error
  }));
}

/**
 * Log API call
 */
export function logApiCall(
  apiName: string,
  requestId: string,
  duration: number,
  status: 'success' | 'error',
  userId?: string,
  tokenCount?: number,
  cost?: number,
  error?: string
): void {
  const level = status === 'error' ? 'error' : 'info';
  const message = `API call: ${apiName} (${status})`;
  
  logStructured(createLogEntry(level, message, {
    functionName: apiName,
    requestId,
    userId,
    duration,
    tokenCount,
    cost,
    status,
    error
  }));
}

/**
 * Log user action
 */
export function logUserAction(
  action: string,
  requestId: string,
  userId?: string,
  metadata: Record<string, any> = {}
): void {
  logInfo(`User action: ${action}`, {
    functionName: action,
    requestId,
    userId,
    metadata: sanitizeMetadata(metadata)
  });
}

/**
 * Log security event
 */
export function logSecurityEvent(
  event: string,
  requestId: string,
  userId?: string,
  severity: 'low' | 'medium' | 'high' = 'medium',
  metadata: Record<string, any> = {}
): void {
  const level = severity === 'high' ? 'error' : 'warn';
  const message = `Security event: ${event}`;
  
  logStructured(createLogEntry(level, message, {
    functionName: 'security',
    requestId,
    userId,
    metadata: {
      ...sanitizeMetadata(metadata),
      severity
    }
  }));
}

/**
 * Log performance metric
 */
export function logPerformanceMetric(
  metric: string,
  value: number,
  unit: string,
  requestId: string,
  userId?: string,
  metadata: Record<string, any> = {}
): void {
  logInfo(`Performance metric: ${metric}`, {
    functionName: 'performance',
    requestId,
    userId,
    metadata: {
      ...sanitizeMetadata(metadata),
      metric,
      value,
      unit
    }
  });
}
