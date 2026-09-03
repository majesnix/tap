import { fetchExchanges, fetchQueues } from "@/lib/ipc";
import type { ExchangeSummary } from "@/lib/types";

/**
 * Cached Management API listings, keyed by profile.
 *
 * Three components used to ask the broker for the same queue list on every profile
 * switch. Entries live for a short TTL, concurrent callers share one in-flight request,
 * failures are never cached (so a broker that just came up is retried), and saving or
 * deleting a profile drops its entries.
 */
export const CATALOG_TTL_MS = 30_000;

interface Entry<T> {
  fetchedAt: number;
  promise: Promise<T>;
}

const queueCache = new Map<string, Entry<string[]>>();
const exchangeCache = new Map<string, Entry<ExchangeSummary[]>>();

interface CatalogOptions {
  /** Bypass the cache and replace the entry. */
  fresh?: boolean;
}

function cached<T>(
  cache: Map<string, Entry<T>>,
  key: string,
  fresh: boolean,
  load: () => Promise<T>
): Promise<T> {
  const now = Date.now();
  const hit = cache.get(key);
  if (!fresh && hit && now - hit.fetchedAt <= CATALOG_TTL_MS) return hit.promise;
  const promise: Promise<T> = load().catch((err: unknown) => {
    // Only evict if this request is still the current entry.
    if (cache.get(key)?.promise === promise) cache.delete(key);
    throw err;
  });
  cache.set(key, { fetchedAt: now, promise });
  return promise;
}

/** Queue names for a profile's vhost. */
export function getQueues(profileName: string, options: CatalogOptions = {}): Promise<string[]> {
  return cached(queueCache, profileName, options.fresh ?? false, () => fetchQueues(profileName));
}

/** User exchanges for a profile's vhost. */
export function getExchanges(
  profileName: string,
  options: CatalogOptions = {}
): Promise<ExchangeSummary[]> {
  return cached(exchangeCache, profileName, options.fresh ?? false, () => fetchExchanges(profileName));
}

/** Drop cached listings for one profile, or for all profiles when no name is given. */
export function invalidateCatalog(profileName?: string): void {
  if (profileName === undefined) {
    queueCache.clear();
    exchangeCache.clear();
    return;
  }
  queueCache.delete(profileName);
  exchangeCache.delete(profileName);
}
