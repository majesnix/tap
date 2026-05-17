import { create } from "zustand";
import type { ProtoSchema } from "@/lib/types";

interface ProtoStore {
  activeFilePath: string | null;
  schema: ProtoSchema | null;
  selectedMessageType: string | null;
  hexPreview: string;
  isEncoding: boolean;
  encodeError: string | null;

  setFile: (filePath: string, schema: ProtoSchema) => void;
  setSelectedType: (messageType: string) => void;
  setHexPreview: (hex: string) => void;
  setEncoding: (isEncoding: boolean) => void;
  setEncodeError: (error: string | null) => void;
  reset: () => void;
}

const INITIAL_STATE = {
  activeFilePath: null,
  schema: null,
  selectedMessageType: null,
  hexPreview: "",
  isEncoding: false,
  encodeError: null,
} as const;

export const useProtoStore = create<ProtoStore>((set) => ({
  ...INITIAL_STATE,

  setFile: (filePath, schema) =>
    set({
      activeFilePath: filePath,
      schema,
      selectedMessageType:
        schema.messages.length > 0 ? schema.messages[0].full_name : null,
      hexPreview: "",
      encodeError: null,
    }),

  setSelectedType: (messageType) =>
    set({ selectedMessageType: messageType, hexPreview: "", encodeError: null }),

  setHexPreview: (hex) => set({ hexPreview: hex }),

  setEncoding: (isEncoding) => set({ isEncoding }),

  setEncodeError: (error) => set({ encodeError: error }),

  reset: () => set({ ...INITIAL_STATE }),
}));
