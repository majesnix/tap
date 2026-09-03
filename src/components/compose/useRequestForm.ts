import { useCallback, useEffect, useRef, useState } from "react";
import { useDndMonitor, useDroppable } from "@dnd-kit/core";
import { toast } from "sonner";
import { useHotkeys } from "react-hotkeys-hook";
import { useProtoStore } from "@/stores/useProtoStore";
import { useDraftStore } from "@/stores/useDraftStore";
import { useBlockStore } from "@/stores/useBlockStore";
import { encodeMessage } from "@/lib/ipc";
import { base64ToHex } from "@/lib/bytes";
import { generateRandomValues } from "@/lib/randomizer";
import { buildDefaultValues } from "@/components/form/ProtoFormRenderer";
import type { ApplyBlockRef, ApplyPlan, ConflictChoices } from "@/lib/blockApply";
import type { MessageSchema } from "@/lib/types";

/** Pause after the last form change before encoding and saving a draft. */
const FORM_DEBOUNCE_MS = 200;

/** How long a draft restore suppresses draft saves. */
const RESTORE_GRACE_MS = 300;

/** Values tagged with the file and type they were captured for. */
interface TaggedValues {
  filePath: string;
  messageType: string;
  values: Record<string, unknown>;
}

/**
 * Form state for the request card: the encode debounce, JSON mode, drafts, block drops and
 * the clear/randomize actions. Owned by RequestCard, which lays the pieces out around a
 * plain ProtoFormRenderer.
 */
export function useRequestForm(message: MessageSchema | null) {
  // Selectors, not the whole store: latestValues changes on every keystroke and this hook
  // must only re-render for the debounced value below.
  const selectedMessageType = useProtoStore((s) => s.selectedMessageType);
  const activeFilePath = useProtoStore((s) => s.activeFilePath);
  const schema = useProtoStore((s) => s.schema);
  const setHexPreview = useProtoStore((s) => s.setHexPreview);
  const setEncoding = useProtoStore((s) => s.setEncoding);
  const setEncodeError = useProtoStore((s) => s.setEncodeError);
  const pendingReplayValues = useProtoStore((s) => s.pendingReplayValues);
  const setPendingReplayValues = useProtoStore((s) => s.setPendingReplayValues);

  const draftsLoaded = useDraftStore((s) => s.draftsLoaded);
  const saveDraft = useDraftStore((s) => s.saveDraft);
  const getDraft = useDraftStore((s) => s.getDraft);
  const clearDraft = useDraftStore((s) => s.clearDraft);
  // Subscribe to the key itself — getDraft() writes accessedAt and must not run in render.
  const hasDraft = useDraftStore((s) =>
    activeFilePath && selectedMessageType
      ? s.drafts[`${activeFilePath}::${selectedMessageType}`] !== undefined
      : false
  );

  // The debounce lives on a ref: only the settled value becomes state, so a burst of
  // keystrokes causes one re-render instead of one per key. The (file, type) tag keeps a
  // late value from a previous selection out of the new selection's draft.
  const [debouncedTagged, setDebouncedTagged] = useState<TaggedValues | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current !== null) clearTimeout(debounceTimerRef.current);
    };
  }, []);

  const isRestoringRef = useRef(false);
  const restoreTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (restoreTimerRef.current !== null) clearTimeout(restoreTimerRef.current);
    };
  }, []);

  // Populated by ProtoFormRenderer once it mounts.
  const resetRef = useRef<((values: Record<string, unknown>) => void) | null>(null);
  const applyBlockRef = useRef<ApplyBlockRef | null>(null);
  const getDirtyFieldsRef = useRef<(() => Record<string, boolean>) | null>(null);

  const [conflictPlan, setConflictPlan] = useState<ApplyPlan | null>(null);
  // Rows default to skip via `?? "skip"`, so an empty map is the right start.
  const [conflictChoices, setConflictChoices] = useState<ConflictChoices>({});

  const { isOver, setNodeRef } = useDroppable({ id: "form-drop-zone" });

  // Declared before useDndMonitor: the onDragEnd closure captures isJsonMode by reference.
  const [isJsonMode, setIsJsonMode] = useState(false);
  const [entrySnapshot, setEntrySnapshot] = useState<Record<string, unknown> | null>(null);
  const [jsonDraft, setJsonDraft] = useState<string>("");
  const [parseError, setParseError] = useState<string | null>(null);

  useDndMonitor({
    onDragEnd(event) {
      if (event.over?.id !== "form-drop-zone" || isJsonMode) return;

      const blockId = event.active.id as string;
      if (!applyBlockRef.current) return;

      const block = useBlockStore.getState().blocks.find((b) => b.id === blockId);
      if (!block) return;

      let blockValues: Record<string, unknown>;
      try {
        const parsed: unknown = JSON.parse(block.content);
        if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return;
        blockValues = parsed as Record<string, unknown>;
      } catch {
        toast.warning("Block content is not valid JSON — could not apply");
        return;
      }

      const plan = applyBlockRef.current.buildPlan(blockValues);
      if (plan.conflicts.length > 0) {
        setConflictPlan(plan);
        setConflictChoices({});
      } else {
        applyBlockRef.current.commitApply(plan);
      }
      if (plan.unknownKeys.length > 0) {
        const n = plan.unknownKeys.length;
        toast.warning(
          `${n} ${n === 1 ? "field" : "fields"} from block not in form: ${plan.unknownKeys.join(", ")}`
        );
      }
    },
  });

  // Mirror the current values into the store for the send pipeline, and start the debounce.
  const handleValuesChange = useCallback((values: unknown) => {
    const { activeFilePath: fp, selectedMessageType: mt } = useProtoStore.getState();
    useProtoStore.getState().setLatestValues(values as Record<string, unknown>);
    const tagged: TaggedValues = {
      filePath: fp ?? "",
      messageType: mt ?? "",
      values: values as Record<string, unknown>,
    };
    if (debounceTimerRef.current !== null) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null;
      setDebouncedTagged(tagged);
    }, FORM_DEBOUNCE_MS);
  }, []);

  const debouncedValues = debouncedTagged?.values ?? null;

  useEffect(() => {
    if (!debouncedValues || !selectedMessageType) return;
    void (async () => {
      try {
        setEncoding(true);
        setEncodeError(null);
        const encoded = await encodeMessage(selectedMessageType, debouncedValues);
        setHexPreview(base64ToHex(encoded));
      } catch (err) {
        setEncodeError(typeof err === "string" ? err : "Encoding failed");
        setHexPreview("");
      } finally {
        setEncoding(false);
      }
    })();
  }, [debouncedValues, selectedMessageType, setHexPreview, setEncoding, setEncodeError]);

  // Draft auto-save on every settled change, skipped during a restore and whenever the tag
  // belongs to a different file or message type than the one on screen.
  useEffect(() => {
    if (!draftsLoaded || !activeFilePath || !selectedMessageType || !debouncedTagged) return;
    if (isRestoringRef.current) return;
    if (
      debouncedTagged.filePath !== activeFilePath ||
      debouncedTagged.messageType !== selectedMessageType
    )
      return;
    const msg = schema?.message_map[selectedMessageType];
    if (!msg) return;
    if (JSON.stringify(debouncedTagged.values) === JSON.stringify(buildDefaultValues(msg))) return;
    void saveDraft(activeFilePath, selectedMessageType, debouncedTagged.values);
  }, [debouncedTagged, selectedMessageType, activeFilePath, draftsLoaded, schema, saveDraft]);

  const clear = useCallback(() => {
    if (!message) return;
    if (isJsonMode) setIsJsonMode(false);
    setPendingReplayValues(buildDefaultValues(message));
    if (activeFilePath && selectedMessageType) {
      void clearDraft(activeFilePath, selectedMessageType);
    }
  }, [message, isJsonMode, setPendingReplayValues, activeFilePath, selectedMessageType, clearDraft]);

  const randomize = useCallback(() => {
    if (!message || !schema) return;
    if (isJsonMode) setIsJsonMode(false);
    const dirtyFields = getDirtyFieldsRef.current?.() ?? {};
    // Read the values at call time: subscribing would re-render on every keystroke.
    const currentValues: Record<string, unknown> = useProtoStore.getState().latestValues ?? {};
    setPendingReplayValues(
      generateRandomValues(message, schema.message_map, dirtyFields, currentValues)
    );
  }, [message, schema, isJsonMode, setPendingReplayValues]);

  useHotkeys(
    "mod+shift+r",
    (e) => {
      e.preventDefault();
      clear();
    },
    { enableOnFormTags: true, preventDefault: true }
  );

  useHotkeys(
    "mod+enter",
    (e) => {
      if (document.activeElement?.closest(".cm-editor")) return;
      e.preventDefault();
      useProtoStore.getState().requestSend();
    },
    { enableOnFormTags: true, preventDefault: true }
  );

  // Reset JSON mode when the active message type changes, then restore its draft.
  useEffect(() => {
    setIsJsonMode(false);
    setJsonDraft("");
    setEntrySnapshot(null);
    setParseError(null);

    if (!draftsLoaded || !activeFilePath || !selectedMessageType) return;
    const draft = getDraft(activeFilePath, selectedMessageType);
    if (!draft) return;
    isRestoringRef.current = true;
    setPendingReplayValues(draft.values);
    if (restoreTimerRef.current !== null) clearTimeout(restoreTimerRef.current);
    restoreTimerRef.current = setTimeout(() => {
      isRestoringRef.current = false;
      restoreTimerRef.current = null;
    }, RESTORE_GRACE_MS);
  }, [selectedMessageType, activeFilePath, draftsLoaded, getDraft, setPendingReplayValues]);

  // Consume a replay request. A replay arriving in JSON mode leaves JSON mode first, so the
  // renderer remounts and resetRef is populated by the time the effect runs again.
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

  const toggleJson = useCallback(() => {
    if (!message) return;

    if (!isJsonMode) {
      // FORM → JSON: snapshot what we are leaving, fall back to defaults when empty.
      const latestValues = useProtoStore.getState().latestValues;
      const snapshot =
        latestValues && Object.keys(latestValues).length > 0
          ? latestValues
          : buildDefaultValues(message);
      setEntrySnapshot(snapshot);
      setJsonDraft(JSON.stringify(snapshot, null, 2));
      setIsJsonMode(true);
      return;
    }

    // JSON → FORM: parse first; invalid JSON keeps the user in JSON mode.
    let parsedValues: Record<string, unknown>;
    try {
      const raw: unknown = JSON.parse(jsonDraft);
      if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
        setParseError("JSON must be an object, not a primitive or array");
        return;
      }
      parsedValues = raw as Record<string, unknown>;
    } catch (e) {
      setParseError(e instanceof Error ? e.message : "Invalid JSON");
      return;
    }

    setParseError(null);

    const knownFieldNames = new Set(message.fields.map((f) => f.name));
    const unknownKeys = Object.keys(parsedValues).filter((k) => !knownFieldNames.has(k));
    if (unknownKeys.length > 0) {
      toast.warning(
        `${unknownKeys.length} unknown ${unknownKeys.length === 1 ? "field" : "fields"} ignored: ${unknownKeys.join(", ")}`
      );
    }

    const cleaned = Object.fromEntries(
      Object.entries(parsedValues).filter(([k]) => knownFieldNames.has(k))
    );

    // Merge over the defaults so a partial document cannot leave fields undefined, and go
    // through the replay signal — resetRef is null until the renderer remounts.
    setPendingReplayValues({ ...buildDefaultValues(message), ...cleaned });
    setIsJsonMode(false);
  }, [message, isJsonMode, jsonDraft, setPendingReplayValues]);

  const fixJson = useCallback(() => setParseError(null), []);

  const discardJson = useCallback(() => {
    // Restore the snapshot taken on entry — never re-read latestValues here.
    if (entrySnapshot !== null) setPendingReplayValues(entrySnapshot);
    setParseError(null);
    setIsJsonMode(false);
  }, [entrySnapshot, setPendingReplayValues]);

  const applyConflicts = useCallback(() => {
    if (conflictPlan && applyBlockRef.current) {
      applyBlockRef.current.commitApply(conflictPlan, conflictChoices);
    }
    setConflictPlan(null);
  }, [conflictPlan, conflictChoices]);

  const discardConflicts = useCallback(() => setConflictPlan(null), []);

  return {
    isJsonMode,
    jsonDraft,
    setJsonDraft,
    parseError,
    toggleJson,
    fixJson,
    discardJson,
    clear,
    randomize,
    handleValuesChange,
    resetRef,
    getDirtyFieldsRef,
    applyBlockRef,
    conflict: {
      plan: conflictPlan,
      choices: conflictChoices,
      setChoices: setConflictChoices,
      apply: applyConflicts,
      discard: discardConflicts,
    },
    dropZone: { setNodeRef, isOver },
    hasDraft,
  };
}
