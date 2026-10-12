// Global client-side cache for leads across pages
// Keeps loaded leads instantly available in memory so navigating between
// /admin/leads -> /admin/leads/[id] -> Back to Leads is instantaneous (0ms delay)

interface LeadsCacheEntry {
  leads: any[];
  nextUniqueId?: string;
  timestamp: number;
}

const memoryCache = new Map<string, LeadsCacheEntry>();
const CACHE_TTL = 3 * 60 * 1000; // 3 minutes fresh cache

export function getCachedLeads(roleOrKey: string): { leads: any[]; nextUniqueId?: string } | null {
  const entry = memoryCache.get(roleOrKey);
  if (!entry) return null;
  // If entry exists within TTL, return it
  if (Date.now() - entry.timestamp < CACHE_TTL) {
    return { leads: entry.leads, nextUniqueId: entry.nextUniqueId };
  }
  return null;
}

export function setCachedLeads(roleOrKey: string, leads: any[], nextUniqueId?: string) {
  memoryCache.set(roleOrKey, {
    leads,
    nextUniqueId,
    timestamp: Date.now(),
  });
}

export function invalidateLeadsCache(roleOrKey?: string) {
  if (roleOrKey) {
    memoryCache.delete(roleOrKey);
  } else {
    memoryCache.clear();
  }
}

// Single-lead in-memory cache for ultra-fast instant preview
const singleLeadCache = new Map<string, { lead: any; timestamp: number }>();

export function getCachedLeadDetail(leadId: string): any | null {
  const entry = singleLeadCache.get(leadId);
  if (!entry) return null;
  if (Date.now() - entry.timestamp < CACHE_TTL) {
    return entry.lead;
  }
  return null;
}

export function setCachedLeadDetail(leadId: string, lead: any) {
  singleLeadCache.set(leadId, {
    lead,
    timestamp: Date.now(),
  });
}
