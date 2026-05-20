import { useCallback, useRef, useEffect, useState } from "react";
import { useProtoStore } from "@/stores/useProtoStore";
import { encodeMessage } from "@/lib/ipc";
import { useDebounce } from "@/hooks/useDebounce";
import { ProtoFormRenderer, buildDefaultValues } from "./ProtoFormRenderer";
import { JsonEditor } from "./JsonEditor";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Braces, Library } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "next-themes";
import { useBlockStore } from "@/stores/useBlockStore";

/**
 * Converts a byte array to a formatted hex string.
 * Example: [0x0a, 0x05] → "0a 05"
 */
function bytesToHex(bytes: number[]): string {
  return bytes.map((b) => b.toString(16).padStart(2, "0")).join(" ");
}

interface FormPanelProps {
  isBlockLibraryOpen?: boolean;
  onToggleBlockLibrary?: () => void;
}

export function FormPanel({ isBlockLibraryOpen = false, onToggleBlockLibrary }: FormPanelProps = {}) {
  const {
    schema,
    selectedMessageType,
    setHexPreview,
    setEncoding,
    setEncodeError,
    pendingReplayValues,
    setPendingReplayValues,
  } = useProtoStore();

  const { resolvedTheme } = useTheme();

  // latestValues is now in Zustand store (D-07 / advisor Option A)
  const latestValues = useProtoStore((s) => s.latestValues);
  const debouncedValues = useDebounce(latestValues, 200);

  // resetRef is passed to ProtoFormRenderer so FormPanel can trigger form.reset() for replay (HIST-02)
  const resetRef = useRef<((values: Record<string, unknown>) => void) | null>(
    null
  );

  const applyBlockRef = useRef<((blockValues: Record<string, unknown>) => string[]) | null>(
    null
  );
  const [isDraggingOver, setIsDraggingOver] = useState<boolean>(false);

  // JSON Override Toggle state (D-01: local useState, not Zustand)
  const [isJsonMode, setIsJsonMode] = useState(false);
  const [entrySnapshot, setEntrySnapshot] = useState<Record<string, unknown> | null>(null);
  const [jsonDraft, setJsonDraft] = useState<string>("");
  const [parseError, setParseError] = useState<string | null>(null);

  // Mirror current form values into store for PublishBar / other consumers (D-07)
  const handleValuesChange = useCallback((values: unknown) => {
    useProtoStore
      .getState()
      .setLatestValues(values as Record<string, unknown>);
  }, []);

  useEffect(() => {
    if (!debouncedValues || !selectedMessageType) return;
    void (async () => {
      try {
        setEncoding(true);
        setEncodeError(null);
        const bytes = await encodeMessage(selectedMessageType, debouncedValues);
        setHexPreview(bytesToHex(bytes));
      } catch (err) {
        const msg = typeof err === "string" ? err : "Encoding failed";
        setEncodeError(msg);
        setHexPreview("");
      } finally {
        setEncoding(false);
      }
    })();
  }, [debouncedValues, selectedMessageType, setHexPreview, setEncoding, setEncodeError]);

  // WR-01: reset JSON mode state when the active message type changes
  useEffect(() => {
    setIsJsonMode(false);
    setJsonDraft("");
    setEntrySnapshot(null);
    setParseError(null);
  }, [selectedMessageType]);

  // Consume pendingReplayValues: when set by HIST-02, call form.reset() and clear the signal
  // WR-02: also handle replay arriving while in JSON mode — exit JSON mode first so renderer
  // remounts, then the effect re-fires on the next render with resetRef.current available
  useEffect(() => {
    if (!pendingReplayValues) return;
    if (isJsonMode) {
      setIsJsonMode(false);
      return;
    }
    if (resetRef.current) {
      resetRef.current(pendingReplayValues);
      setPendingReplayValues(null);
    }
  }, [pendingReplayValues, isJsonMode, setPendingReplayValues]);

  if (!schema || !selectedMessageType) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
        Open a .proto file to get started
      </div>
    );
  }

  const message = schema.message_map[selectedMessageType];
  if (!message) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
        Message type not found in schema
      </div>
    );
  }

  function handleToggle() {
    if (!isJsonMode) {
      // FORM → JSON: capture entry snapshot (D-06), pre-fill editor (D-03, D-09)
      // Fall back to buildDefaultValues when latestValues is null/empty (D-09)
      const snapshot =
        latestValues && Object.keys(latestValues).length > 0
          ? latestValues
          : buildDefaultValues(message);
      setEntrySnapshot(snapshot);
      setJsonDraft(JSON.stringify(snapshot, null, 2));
      setIsJsonMode(true);
      return;
    }

    // JSON → FORM: parse the current draft
    let parsedValues: Record<string, unknown>;
    try {
      const raw: unknown = JSON.parse(jsonDraft);
      // CR-01: guard against valid but non-object JSON (null, arrays, primitives)
      if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
        setParseError("JSON must be an object, not a primitive or array");
        return;
      }
      parsedValues = raw as Record<string, unknown>;
    } catch (e) {
      // Invalid JSON (D-05): show banner, stay in JSON mode — NEVER switch modes here
      setParseError(e instanceof Error ? e.message : "Invalid JSON");
      return;
    }

    setParseError(null);

    // Unknown field detection — top-level only (D-07/D-08)
    const knownFieldNames = new Set(message.fields.map((f) => f.name));
    const unknownKeys = Object.keys(parsedValues).filter(
      (k) => !knownFieldNames.has(k)
    );
    if (unknownKeys.length > 0) {
      const label = unknownKeys.length === 1 ? "field" : "fields";
      toast.warning(
        `${unknownKeys.length} unknown ${label} ignored: ${unknownKeys.join(", ")}`
      );
    }

    const cleanedValues = Object.fromEntries(
      Object.entries(parsedValues).filter(([k]) => knownFieldNames.has(k))
    );

    // Merge over defaults — prevents undefined fields after partial JSON edits (RESEARCH Pitfall 2)
    const mergedValues = { ...buildDefaultValues(message), ...cleanedValues };

    // CRITICAL: Use pendingReplayValues signal — NEVER call resetRef.current() directly here.
    // resetRef.current is null until ProtoFormRenderer remounts (RESEARCH Pitfall 1).
    // The existing useEffect (lines 62-67) handles timing correctly after remount.
    setPendingReplayValues(mergedValues);
    setIsJsonMode(false);
  }

  function handleFixJson() {
    setParseError(null);
    // Stay in JSON mode — user fixes the editor
  }

  function handleDiscard() {
    if (entrySnapshot !== null) {
      // Restore snapshot captured at JSON mode entry (D-06)
      // CRITICAL: use entrySnapshot from local state — do NOT re-read latestValues from Zustand
      setPendingReplayValues(entrySnapshot);
    }
    setParseError(null);
    setIsJsonMode(false);
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDraggingOver(true);
  }

  function handleDragLeave(e: React.DragEvent<HTMLDivElement>) {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDraggingOver(false);
    }
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDraggingOver(false);

    const blockId = e.dataTransfer.getData('blockId');
    if (!blockId || !applyBlockRef.current) return;

    const block = useBlockStore.getState().blocks.find(b => b.id === blockId);
    if (!block) return;

    let blockValues: Record<string, unknown>;
    try {
      blockValues = JSON.parse(block.content) as Record<string, unknown>;
    } catch {
      return;
    }

    const skipped = applyBlockRef.current(blockValues);
    if (skipped.length > 0) {
      const n = skipped.length;
      const label = n === 1 ? 'field' : 'fields';
      toast.warning(`${n} ${label} from block not in form: ${skipped.join(', ')}`);
    }
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="px-4 py-3 border-b border-border shrink-0 flex items-start justify-between">
        <div>
          <h2 className="text-sm font-semibold">{message.name}</h2>
          <p className="text-xs text-muted-foreground">{message.full_name}</p>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Block library"
            title="Block library"
            aria-pressed={isBlockLibraryOpen}
            className={isBlockLibraryOpen ? "bg-muted text-foreground" : ""}
            onClick={onToggleBlockLibrary}
          >
            <Library size={16} />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={isJsonMode ? "Return to form" : "Edit as JSON"}
            aria-pressed={isJsonMode}
            title={isJsonMode ? "Return to form" : "Edit as JSON"}
            className={isJsonMode ? "bg-muted text-foreground" : ""}
            onClick={handleToggle}
          >
            <Braces />
          </Button>
        </div>
      </div>
      {isJsonMode ? (
        // JSON mode: plain flex div — do NOT nest CodeMirror inside ScrollArea (RESEARCH Pitfall 4)
        <div className="flex-1 flex flex-col min-h-0">
          <JsonEditor
            value={jsonDraft}
            onChange={setJsonDraft}
            resolvedTheme={resolvedTheme}
            parseError={parseError}
            onFixJson={handleFixJson}
            onDiscard={handleDiscard}
          />
        </div>
      ) : (
        <ScrollArea
          className={`flex-1 min-h-0${isDraggingOver ? ' ring-2 ring-primary/50' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <ProtoFormRenderer
            message={message}
            onValuesChange={handleValuesChange}
            resetRef={resetRef}
            applyBlockRef={applyBlockRef}
          />
        </ScrollArea>
      )}
    </div>
  );
}
