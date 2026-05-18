import type { HistoryEntry } from "@/stores/useHistoryStore";
import type { ProtoSchema } from "@/lib/types";

/**
 * Pure filter function for history entries.
 * Used by MessageHistoryPanel.filteredEntries via useMemo.
 *
 * Both filters use case-insensitive substring matching.
 * When both filters are active, entries must satisfy BOTH (AND logic).
 */
export function filterHistoryEntries(
  entries: HistoryEntry[],
  typeFilter: string,
  targetFilter: string
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
    );
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
