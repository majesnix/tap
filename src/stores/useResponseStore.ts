import { create } from "zustand";
import type { ConsumeResult } from "@/lib/types";

export interface ResponseResult {
  decoded: Record<string, unknown> | null;
  hexString: string;
  error: string | null;
}

interface ResponseStore {
  queueList: string[];
  isLiveMode: boolean;
  selectedQueue: string;
  isLoading: boolean;
  lastResult: (ResponseResult & { empty: boolean }) | null;
  lastReadAt: number | null;
  queueDepth: number | null;

  setQueueList: (queues: string[], isLive: boolean) => void;
  setSelectedQueue: (queue: string) => void;
  setIsLoading: (loading: boolean) => void;
  setLastResult: (result: (ResponseResult & { empty: boolean }) | null) => void;
  setLastReadAt: (ts: number | null) => void;
  setQueueDepth: (depth: number | null) => void;
  reset: () => void;
}

const INITIAL_STATE = {
  queueList: [] as string[],
  isLiveMode: false,
  selectedQueue: "",
  isLoading: false,
  lastResult: null as (ResponseResult & { empty: boolean }) | null,
  lastReadAt: null as number | null,
  queueDepth: null as number | null,
} as const;

export const useResponseStore = create<ResponseStore>((set) => ({
  ...INITIAL_STATE,
  setQueueList: (queueList, isLiveMode) => set({ queueList, isLiveMode }),
  setSelectedQueue: (selectedQueue) => set({ selectedQueue }),
  setIsLoading: (isLoading) => set({ isLoading }),
  setLastResult: (lastResult) => set({ lastResult }),
  setLastReadAt: (lastReadAt) => set({ lastReadAt }),
  setQueueDepth: (queueDepth) => set({ queueDepth }),
  reset: () => set({ ...INITIAL_STATE }),
}));

// Re-export ConsumeResult for consumers that need the IPC type
export type { ConsumeResult };
