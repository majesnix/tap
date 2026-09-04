import { useMemo } from "react";
import { toast } from "sonner";
import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { publishMessage } from "@/lib/ipc";
import { useHistoryStore, type HistoryEntry } from "@/stores/useHistoryStore";
import { useResponseStore } from "@/stores/useResponseStore";
import { useProtoStore } from "@/stores/useProtoStore";
import { useConnectionStore } from "@/stores/useConnectionStore";
import { findReplayTabIndex } from "@/components/history/historyHelpers";
import { describeTarget, type ActivityGroup, type ReceivedItem, type SentItem } from "./activityModel";
import type { PublishOutcome } from "@/lib/types";

export interface ActivityActions {
  /** Pre-fill the form from a past send. No publish. */
  replay: (entry: HistoryEntry) => void;
  /** Pre-fill the form and republish the stored bytes verbatim. */
  resend: (entry: HistoryEntry) => Promise<void>;
  exportVisible: (groups: ActivityGroup[]) => Promise<void>;
  clearAll: () => Promise<void>;
}

/**
 * Loads the form with a past send's values. Returns false when the entry cannot
 * be replayed (the file is closed, or the type is gone from its schema); the
 * caller has already been told why via a toast.
 */
function loadIntoForm(entry: HistoryEntry, verb: "Replay" | "Resend"): boolean {
  const { openFiles, activeIndex, setActiveIndex, setSelectedType, setPendingReplayValues } =
    useProtoStore.getState();
  const tabIndex = findReplayTabIndex(openFiles, entry.messageTypeName);
  if (tabIndex === -1) {
    toast.error(
      verb === "Replay"
        ? "Replay failed: .proto file not open. Open the file first."
        : "Message type not found in active schema"
    );
    return false;
  }
  // BUG-4 fix: only switch tabs if needed.
  if (tabIndex !== activeIndex) {
    setActiveIndex(tabIndex);
  }
  const targetSchema = openFiles[tabIndex]?.schema;
  if (!targetSchema?.message_map[entry.messageTypeName]) {
    toast.error(`${verb} failed: message type not found in schema.`);
    return false;
  }
  setSelectedType(entry.messageTypeName);
  setPendingReplayValues(entry.fieldValues);
  return true;
}

function receivedRows(groups: ActivityGroup[]): ReceivedItem[] {
  return groups.flatMap((g) => [
    ...(g.item.kind === "received" ? [g.item] : []),
    ...(g.reply ? [g.reply] : []),
  ]);
}

function sentRows(groups: ActivityGroup[]): SentItem[] {
  return groups.flatMap((g) => (g.item.kind === "sent" ? [g.item] : []));
}

export function useActivityActions(): ActivityActions {
  return useMemo<ActivityActions>(
    () => ({
      replay: (entry) => {
        loadIntoForm(entry, "Replay");
      },

      resend: async (entry) => {
        const { activeProfileName } = useConnectionStore.getState();
        if (!activeProfileName) {
          toast.error("Resend failed: No active connection profile.");
          return;
        }

        // Step 1: pre-populate the form so the user sees what was sent.
        if (!loadIntoForm(entry, "Resend")) return;

        // A truncated payload would send a corrupt message; refuse rather than guess.
        if (entry.payloadTruncated) {
          toast.error(
            "Resend unavailable: this payload was too large and only its start was kept."
          );
          return;
        }

        // Step 2: send the stored payload bytes (no re-encoding).
        // WR-02: publish and history write are separate so an appendEntry failure
        // never shows a misleading "Resend failed" for a message that went out.
        // The original correlation id and reply-to ride along so the resend groups
        // with its reply in the Activity panel exactly as the first send did.
        let result: PublishOutcome;
        try {
          result = await publishMessage(
            activeProfileName,
            entry.exchange,
            entry.routingKey,
            entry.payloadBase64,
            {
              correlationId: entry.correlationId ?? undefined,
              replyTo: entry.replyTo ?? undefined,
            }
          );
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          toast.error(`Resend failed: ${message}`, { duration: 5000 });
          return;
        }

        toast(`Message resent to ${describeTarget(entry.exchange, entry.routingKey)}`, {
          duration: 3000,
        });

        try {
          await useHistoryStore.getState().appendEntry({
            id: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            messageTypeName: entry.messageTypeName,
            exchange: entry.exchange,
            routingKey: entry.routingKey,
            status: "sent",
            outcome: result.status,
            correlationId: entry.correlationId ?? undefined,
            replyTo: entry.replyTo ?? undefined,
            fieldValues: entry.fieldValues,
            payloadBase64: entry.payloadBase64,
            payloadTruncated: entry.payloadTruncated,
          });
        } catch (err: unknown) {
          // Non-fatal: the message was sent; only the history record failed.
          console.error("[history] appendEntry after resend failed:", err);
        }
      },

      exportVisible: async (groups) => {
        const received = receivedRows(groups);
        const sent = sentRows(groups);

        // D-07: default filename with ISO timestamp, colons replaced for filesystem compat
        const stamp = new Date().toISOString().replace(/:/g, "-").slice(0, 16);
        const filePath = await save({
          defaultPath: `activity-export-${stamp}.json`,
          filters: [{ name: "JSON", extensions: ["json"] }],
        });
        if (!filePath) return; // D-08: user cancelled — silent, no toast

        const payload = {
          exportedAt: new Date().toISOString(),
          messageCount: received.length,
          // D-10: curated subset — omit id and hexString
          messages: received.map(({ message }) => ({
            routingKey: message.routingKey,
            exchange: message.exchange,
            contentType: message.contentType,
            // D-11: epoch seconds → ISO string; null if not set by the publisher
            timestamp: message.timestamp !== null ? new Date(message.timestamp * 1000).toISOString() : null,
            decodedAs: message.decodedAs,
            decoded: message.decoded,
            error: message.error,
          })),
          // status is what was recorded at send time ("sent" | "failed"); the
          // publisher-confirm result stays in its own field.
          sent: sent.map(({ entry }) => ({
            id: entry.id,
            timestamp: entry.timestamp,
            messageTypeName: entry.messageTypeName,
            exchange: entry.exchange,
            routingKey: entry.routingKey,
            status: entry.status,
            outcome: entry.outcome ?? null,
            fieldValues: entry.fieldValues,
          })),
        };

        try {
          await writeTextFile(filePath, JSON.stringify(payload, null, 2));
          toast.success(`Exported ${sent.length} sent and ${received.length} received`);
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          toast.error(`Export failed: ${message}`);
        }
      },

      clearAll: async () => {
        useResponseStore.getState().clearMessages();
        await useHistoryStore.getState().clearHistory();
      },
    }),
    []
  );
}
