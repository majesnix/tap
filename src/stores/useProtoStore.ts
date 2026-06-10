import { create } from "zustand";
import { toast } from "sonner";
import type { ProtoSchema } from "@/lib/types";

const MAX_OPEN_FILES = 20;
const MAX_RECENT_FILES = 10;

interface OpenFileEntry {
  filePath: string;
  schema: ProtoSchema;
}

interface ProtoStore {
  // Multi-file support (PROT-03/04)
  openFiles: OpenFileEntry[];
  activeIndex: number;

  // Plain stored fields — kept in sync by all mutating actions (NOT getters)
  activeFilePath: string | null;
  schema: ProtoSchema | null;

  // Per-message state
  selectedMessageType: string | null;
  hexPreview: string;
  isEncoding: boolean;
  encodeError: string | null;

  // Recent files (persisted externally via tap.json)
  recentFiles: string[];

  // Signal fields for downstream plans
  latestValues: Record<string, unknown> | null;
  lastSendAt: number | null;
  pendingReplayValues: Record<string, unknown> | null;
  sendRequested: number;
  openFileRequested: number;
  reloadRequested: number;

  // Actions
  addOrActivateFile: (filePath: string, schema: ProtoSchema) => void;
  addFileBackground: (filePath: string, schema: ProtoSchema) => void;
  closeFile: (index: number) => void;
  setActiveIndex: (index: number) => void;
  updateFileSchema: (filePath: string, schema: ProtoSchema) => void;

  setSelectedType: (messageType: string) => void;
  setHexPreview: (hex: string) => void;
  setEncoding: (isEncoding: boolean) => void;
  setEncodeError: (error: string | null) => void;

  setLatestValues: (values: Record<string, unknown> | null) => void;
  setLastSendAt: (ts: number | null) => void;
  setPendingReplayValues: (values: Record<string, unknown> | null) => void;
  requestSend: () => void;
  requestOpenFile: () => void;
  requestReload: () => void;
  addRecentFile: (filePath: string) => void;
  setRecentFiles: (files: string[]) => void;

  reset: () => void;
}

const INITIAL_STATE = {
  openFiles: [] as OpenFileEntry[],
  activeIndex: -1,
  activeFilePath: null as string | null,
  schema: null as ProtoSchema | null,
  selectedMessageType: null as string | null,
  hexPreview: "",
  isEncoding: false,
  encodeError: null as string | null,
  latestValues: null as Record<string, unknown> | null,
  lastSendAt: null as number | null,
  pendingReplayValues: null as Record<string, unknown> | null,
  sendRequested: 0,
  openFileRequested: 0,
  reloadRequested: 0,
  recentFiles: [] as string[],
};

export const useProtoStore = create<ProtoStore>((set) => ({
  ...INITIAL_STATE,

  addOrActivateFile: (filePath, schema) =>
    set((s) => {
      const existingIndex = s.openFiles.findIndex((f) => f.filePath === filePath);

      if (existingIndex !== -1) {
        // Already open
        if (existingIndex === s.activeIndex) {
          // True no-op: same tab already active — do not mutate state
          return s;
        }
        // Switch to the already-open tab
        const entry = s.openFiles[existingIndex];
        return {
          activeIndex: existingIndex,
          activeFilePath: entry.filePath,
          schema: entry.schema,
          selectedMessageType: entry.schema.messages[0]?.full_name ?? null,
          hexPreview: "",
          encodeError: null,
        };
      }

      // T-03-01-03: Cap at MAX_OPEN_FILES to prevent DoS
      if (s.openFiles.length >= MAX_OPEN_FILES) {
        toast.error(`Maximum ${MAX_OPEN_FILES} files open at once`);
        return s;
      }

      const newFiles = [...s.openFiles, { filePath, schema }];
      const newIndex = newFiles.length - 1;
      return {
        openFiles: newFiles,
        activeIndex: newIndex,
        activeFilePath: filePath,
        schema,
        selectedMessageType: schema.messages[0]?.full_name ?? null,
        hexPreview: "",
        encodeError: null,
      };
    }),

  addFileBackground: (filePath, schema) =>
    set((s) => {
      if (s.openFiles.some((f) => f.filePath === filePath)) return s;
      if (s.openFiles.length >= MAX_OPEN_FILES) {
        toast.error(`Maximum ${MAX_OPEN_FILES} files open at once`);
        return s;
      }
      const newFiles = [...s.openFiles, { filePath, schema }];
      if (s.activeIndex === -1) {
        return {
          openFiles: newFiles,
          activeIndex: newFiles.length - 1,
          activeFilePath: filePath,
          schema,
          selectedMessageType: schema.messages[0]?.full_name ?? null,
          hexPreview: "",
          encodeError: null,
        };
      }
      return { openFiles: newFiles };
    }),

  closeFile: (index) =>
    set((s) => {
      const newFiles = s.openFiles.filter((_, i) => i !== index);
      const newIndex =
        newFiles.length === 0
          ? -1
          : Math.min(s.activeIndex, newFiles.length - 1);
      const activeEntry = newIndex >= 0 ? newFiles[newIndex] : null;
      return {
        openFiles: newFiles,
        activeIndex: newIndex,
        activeFilePath: activeEntry?.filePath ?? null,
        schema: activeEntry?.schema ?? null,
        selectedMessageType:
          activeEntry?.schema.messages[0]?.full_name ?? null,
      };
    }),

  setActiveIndex: (index) =>
    set((s) => {
      // BUG-4 fix: no-op when index is unchanged to prevent unnecessary re-renders
      if (s.activeIndex === index) return s;
      const entry = s.openFiles[index];
      return {
        activeIndex: index,
        activeFilePath: entry?.filePath ?? null,
        schema: entry?.schema ?? null,
        // D-06: reset to first message type on tab switch
        selectedMessageType: entry?.schema.messages[0]?.full_name ?? null,
        hexPreview: "",
        encodeError: null,
      };
    }),

  setSelectedType: (messageType) =>
    set({ selectedMessageType: messageType, hexPreview: "", encodeError: null }),

  setHexPreview: (hex) => set({ hexPreview: hex }),

  setEncoding: (isEncoding) => set({ isEncoding }),

  setEncodeError: (error) => set({ encodeError: error }),

  setLatestValues: (values) => set({ latestValues: values }),

  setLastSendAt: (ts) => set({ lastSendAt: ts }),

  setPendingReplayValues: (values) => set({ pendingReplayValues: values }),

  requestSend: () => set((s) => ({ sendRequested: s.sendRequested + 1 })),

  requestOpenFile: () => set((s) => ({ openFileRequested: s.openFileRequested + 1 })),

  requestReload: () => set((s) => ({ reloadRequested: s.reloadRequested + 1 })),

  addRecentFile: (filePath) =>
    set((s) => {
      const filtered = s.recentFiles.filter((f) => f !== filePath);
      return { recentFiles: [filePath, ...filtered].slice(0, MAX_RECENT_FILES) };
    }),

  setRecentFiles: (files) => set({ recentFiles: files }),

  updateFileSchema: (filePath, schema) =>
    set((s) => {
      const idx = s.openFiles.findIndex((f) => f.filePath === filePath);
      if (idx === -1) return s;

      const newFiles = s.openFiles.map((f, i) =>
        i === idx ? { ...f, schema } : f
      );

      const isActive = idx === s.activeIndex;
      if (!isActive) return { openFiles: newFiles };

      const prevType = s.selectedMessageType;
      const stillExists = schema.messages.some((m) => m.full_name === prevType);
      return {
        openFiles: newFiles,
        schema,
        selectedMessageType: stillExists
          ? prevType
          : schema.messages[0]?.full_name ?? null,
      };
    }),

  reset: () => set({ ...INITIAL_STATE }),
}));
