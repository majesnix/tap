import type { HistoryEntry } from "@/stores/useHistoryStore";
import type { ProtoSchema } from "@/lib/types";

/**
 * Recursively collects all field name keys from a fieldValues record.
 * Excludes the `_selected` discriminator key used by oneof fields.
 * Recurses into plain nested objects and into array elements that are objects.
 * The null guard (`value !== null`) must precede the `typeof value === "object"`
 * check because `typeof null === "object"` in JavaScript.
 */
export function collectFieldNames(obj: Record<string, unknown>): string[] {
  const names: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    if (key === "_selected") continue;
    names.push(key);
    if (value !== null && !Array.isArray(value) && typeof value === "object") {
      names.push(...collectFieldNames(value as Record<string, unknown>));
    } else if (Array.isArray(value)) {
      for (const item of value) {
        if (item !== null && typeof item === "object" && !Array.isArray(item)) {
          names.push(...collectFieldNames(item as Record<string, unknown>));
        }
      }
    }
  }
  return names;
}

/**
 * Recursively collects both field name keys AND primitive values from a fieldValues record.
 * Extends collectFieldNames by also including string/number/boolean values in the search corpus.
 * This enables full-text search — a user can query a known field value (e.g. "ORD-001") in
 * addition to field names.
 *
 * Excludes the `_selected` discriminator key and its value.
 * Recurses into nested objects and array elements that are objects.
 */
export function collectSearchTokens(obj: Record<string, unknown>): string[] {
  const tokens: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    if (key === "_selected") continue;
    tokens.push(key);
    if (value !== null && !Array.isArray(value) && typeof value === "object") {
      tokens.push(...collectSearchTokens(value as Record<string, unknown>));
    } else if (Array.isArray(value)) {
      for (const item of value) {
        if (item !== null && typeof item === "object" && !Array.isArray(item)) {
          tokens.push(...collectSearchTokens(item as Record<string, unknown>));
        } else if (item !== null && typeof item !== "object") {
          tokens.push(String(item));
        }
      }
    } else if (value !== null && typeof value !== "object") {
      tokens.push(String(value));
    }
  }
  return tokens;
}

/**
 * Pure filter function for history entries.
 * Used by MessageHistoryPanel.filteredEntries via useMemo.
 *
 * All filters use case-insensitive substring matching.
 * When multiple filters are active, entries must satisfy ALL (AND logic).
 * The optional `searchQuery` parameter defaults to "" — existing callers
 * passing only 3 arguments are unaffected (HIST-FT-07 backward compat).
 */
export function filterHistoryEntries(
  entries: HistoryEntry[],
  typeFilter: string,
  targetFilter: string,
  searchQuery = ""
): HistoryEntry[] {
  return entries
    .filter(
      (e) =>
        !typeFilter ||
        e.messageTypeName.toLowerCase().includes(typeFilter.toLowerCase())
    )
    .filter(
      (e) =>
        !targetFilter ||
        e.exchange.toLowerCase().includes(targetFilter.toLowerCase()) ||
        e.routingKey.toLowerCase().includes(targetFilter.toLowerCase())
    )
    .filter((e) => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      if (e.messageTypeName.toLowerCase().includes(q)) return true;
      if (e.exchange.toLowerCase().includes(q)) return true;
      if (e.routingKey.toLowerCase().includes(q)) return true;
      const tokens = collectSearchTokens(e.fieldValues);
      return tokens.some((token) => token.toLowerCase().includes(q));
    });
}

/**
 * Pure lookup: finds the openFiles index whose schema contains the given messageTypeName.
 * Returns -1 if not found.
 * Used by handleReplay and handleResend in MessageHistoryPanel.
 */
export function findReplayTabIndex(
  openFiles: Array<{ filePath: string; schema: ProtoSchema }>,
  messageTypeName: string
): number {
  return openFiles.findIndex((f) =>
    f.schema.messages.some((m) => m.full_name === messageTypeName)
  );
}
