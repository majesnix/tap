import { create } from "zustand";
import { toast } from "sonner";

export interface AmqpHeader {
  key: string;
  value: string;
}

export interface AmqpProperties {
  contentType: string | null;
  deliveryMode: 1 | 2; // 1 = non-persistent, 2 = persistent (D-04 guarantees default)
  ttl: number | null; // milliseconds; sent to Rust as u32
  correlationId: string | null;
  replyTo: string | null;
  headers: AmqpHeader[];
}

interface AmqpStore {
  properties: AmqpProperties;
  setProperties: (partial: Partial<Omit<AmqpProperties, "headers">>) => void;
  setHeaders: (headers: AmqpHeader[]) => void; // Used by Apply Properties to commit full header array
  addHeader: (header: AmqpHeader) => void;
  removeHeader: (index: number) => void;
  reset: () => void;
}

export const INITIAL_PROPERTIES: AmqpProperties = {
  contentType: "application/octet-stream", // D-04 default
  deliveryMode: 2, // D-04 default: persistent
  ttl: null,
  correlationId: null,
  replyTo: null,
  headers: [],
};

/** Maximum number of custom AMQP headers (T-03-02-02 cap). */
export const MAX_HEADERS = 20;

export const useAmqpStore = create<AmqpStore>((set) => ({
  properties: { ...INITIAL_PROPERTIES, headers: [] },

  setProperties: (partial) =>
    set((s) => ({ properties: { ...s.properties, ...partial } })),

  setHeaders: (headers) =>
    set((s) => ({ properties: { ...s.properties, headers } })),

  addHeader: (header) =>
    set((s) => {
      // T-03-02-01: Validate header key is non-empty (trim whitespace)
      if (!header.key.trim()) {
        return s; // no-op
      }
      // T-03-02-02: Cap headers at MAX_HEADERS entries
      if (s.properties.headers.length >= MAX_HEADERS) {
        toast.error("Maximum 20 custom headers reached");
        return s; // no-op
      }
      return {
        properties: {
          ...s.properties,
          headers: [...s.properties.headers, header],
        },
      };
    }),

  removeHeader: (index) =>
    set((s) => ({
      properties: {
        ...s.properties,
        headers: s.properties.headers.filter((_, i) => i !== index),
      },
    })),

  reset: () => set({ properties: { ...INITIAL_PROPERTIES, headers: [] } }),
}));
