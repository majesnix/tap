/**
 * Binary payload helpers. Bytes cross the IPC boundary and land in history as
 * standard base64: about 1.33x the payload size, versus ~3.5x for a JSON array
 * of numbers, and one string allocation instead of one number per byte.
 */

/** Payloads larger than this are stored truncated in history (resend is refused). */
export const MAX_HISTORY_PAYLOAD_BYTES = 64 * 1024;

const CHUNK = 0x8000;

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

/** Spaced lowercase hex, the representation used throughout the UI. */
export function base64ToHex(base64: string): string {
  return Array.from(base64ToBytes(base64), (b) => b.toString(16).padStart(2, "0")).join(" ");
}

/** Inverse of base64ToHex: spaced or unspaced hex → bytes. */
export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/\s+/g, "");
  const out = new Uint8Array(Math.floor(clean.length / 2));
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return out;
}

/** Decoded length of a base64 string without decoding it. */
export function base64ByteLength(base64: string): number {
  if (base64.length === 0) return 0;
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return (base64.length * 3) / 4 - padding;
}

export interface StoredPayload {
  payloadBase64: string;
  payloadTruncated: boolean;
}

/** Cap what history keeps of a payload so one large send cannot bloat history.json. */
export function truncatePayloadForHistory(base64: string): StoredPayload {
  if (base64ByteLength(base64) <= MAX_HISTORY_PAYLOAD_BYTES) {
    return { payloadBase64: base64, payloadTruncated: false };
  }
  const head = base64ToBytes(base64).subarray(0, MAX_HISTORY_PAYLOAD_BYTES);
  return { payloadBase64: bytesToBase64(head), payloadTruncated: true };
}
