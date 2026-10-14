// Global In-Memory Cache Invalidation Registry
// Used across API routes and serverless functions to bust stale dashboard caches

declare global {
  // eslint-disable-next-line no-var
  var __crm_dashboard_cache: Map<string, { data: any; timestamp: number }> | undefined;
  // eslint-disable-next-line no-var
  var __crm_last_invalidation_ts: number | undefined;
}

if (!global.__crm_dashboard_cache) {
  global.__crm_dashboard_cache = new Map();
}

if (!global.__crm_last_invalidation_ts) {
  global.__crm_last_invalidation_ts = Date.now();
}

export function getDashboardCache(): Map<string, { data: any; timestamp: number }> {
  return global.__crm_dashboard_cache!;
}

export function getLastInvalidationTimestamp(): number {
  return global.__crm_last_invalidation_ts || 0;
}

/**
 * Call this function whenever a lead is created, edited, deleted, merged, or bulk-updated.
 * It immediately purges in-memory cached dashboard stats and bumps the invalidation timestamp.
 */
export function invalidateDashboardCache(): void {
  try {
    global.__crm_last_invalidation_ts = Date.now();
    if (global.__crm_dashboard_cache) {
      global.__crm_dashboard_cache.clear();
    }
  } catch (err) {
    console.error("Cache invalidation error:", err);
  }
}
