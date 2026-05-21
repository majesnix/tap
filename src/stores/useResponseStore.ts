import { create } from "zustand";
import type { DrainResult, FeedMessage, SubscribeStatus } from "@/lib/types";

const FEED_MAX_SIZE = 500; // FIFO cap (D-17)

interface ResponseStore {
  queueList: string[];
  isLiveMode: boolean;
  selectedQueue: string;
  isLoading: boolean;
  messages: FeedMessage[];              // D-16: replaces lastResult
  selectedDecodeTypes: string[];        // D-20: candidate message types for decode
  lastReadAt: number | null;            // retained — triggers queue depth refresh (CONS-04)
  queueDepth: number | null;            // retained
  subscribeStatus: SubscribeStatus;     // D-10: Phase 14 — live subscribe state
  subscribeError: string | null;        // D-10: error message when status is "Error", null otherwise

  setQueueList: (queues: string[], isLive: boolean) => void;
  setSelectedQueue: (queue: string) => void;
  setIsLoading: (loading: boolean) => void;
  appendMessages: (incoming: DrainResult[]) => void;  // maps DrainResult→FeedMessage + FIFO cap
  clearMessages: () => void;
  setSelectedDecodeTypes: (types: string[]) => void;
  setLastReadAt: (ts: number | null) => void;
  setQueueDepth: (depth: number | null) => void;
  setSubscribeStatus: (status: SubscribeStatus, error?: string) => void;
  reset: () => void;
}

const INITIAL_STATE: Pick<
  ResponseStore,
  | "queueList"
  | "isLiveMode"
  | "selectedQueue"
  | "isLoading"
  | "messages"
  | "selectedDecodeTypes"
  | "lastReadAt"
  | "queueDepth"
  | "subscribeStatus"
  | "subscribeError"
> = {
  queueList: [],
  isLiveMode: false,
  selectedQueue: "",
  isLoading: false,
  messages: [],
  selectedDecodeTypes: [],
  lastReadAt: null,
  queueDepth: null,
  subscribeStatus: "Idle" as SubscribeStatus,
  subscribeError: null,
};

export const useResponseStore = create<ResponseStore>((set) => ({
  ...INITIAL_STATE,
  setQueueList: (queueList, isLiveMode) => set({ queueList, isLiveMode }),
  setSelectedQueue: (selectedQueue) => set({ selectedQueue }),
  setIsLoading: (isLoading) => set({ isLoading }),
  appendMessages: (incoming) =>
    set((state) => {
      // Map DrainResult → FeedMessage: add stable id + decodedAs (D-16, D-17, D-21)
      const newMessages: FeedMessage[] = incoming.map((result) => ({
        id: crypto.randomUUID(),                    // stable key for Accordion (Pitfall 2)
        routingKey: result.routingKey,
        exchange: result.exchange,
        contentType: result.contentType,
        timestamp: result.timestamp,
        decoded: result.decoded,
        hexString: result.hexString,
        error: result.error,
        decodedAs: result.decodedAs ?? null,        // D-21
      }));
      // Prepend new messages (newest first), then enforce FIFO cap
      const combined = [...newMessages, ...state.messages];
      return { messages: combined.slice(0, FEED_MAX_SIZE) };
    }),
  clearMessages: () => set({ messages: [] }),
  setSelectedDecodeTypes: (selectedDecodeTypes) => set({ selectedDecodeTypes }),
  setLastReadAt: (lastReadAt) => set({ lastReadAt }),
  setQueueDepth: (queueDepth) => set({ queueDepth }),
  setSubscribeStatus: (status, error) =>
    set({ subscribeStatus: status, subscribeError: error ?? null }),
  reset: () => set({ ...INITIAL_STATE }),
}));
