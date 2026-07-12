export interface ApiLogEntry {
  id: string;
  timestamp: string; // ISO string for easy JSON serialization
  method: string;
  route: string;
  status: number;
  message: string;
  stack?: string;
  context?: string; // extra info (query params, userId, etc.)
}

const MAX_ENTRIES = 200;

const globalForLogger = globalThis as unknown as {
  apiLogs: ApiLogEntry[] | undefined;
};

if (!globalForLogger.apiLogs) {
  globalForLogger.apiLogs = [];
}

export function logApiError(
  method: string,
  route: string,
  error: unknown,
  context?: Record<string, unknown>,
): void {
  const entry: ApiLogEntry = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    method,
    route,
    status: 500,
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    context: context ? JSON.stringify(context) : undefined,
  };

  globalForLogger.apiLogs!.unshift(entry);

  if (globalForLogger.apiLogs!.length > MAX_ENTRIES) {
    globalForLogger.apiLogs!.splice(MAX_ENTRIES);
  }

  // Also log to server console for deployment logs
  console.error(`[API ERROR] ${method} ${route}:`, entry.message, context ?? "");
}

export function getApiLogs(): ApiLogEntry[] {
  return globalForLogger.apiLogs ?? [];
}

export function clearApiLogs(): void {
  globalForLogger.apiLogs = [];
}
