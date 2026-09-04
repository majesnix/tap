import { describe, expect, test } from "vitest";
import {
  base64ToBytes,
  bytesToBase64,
  base64ToHex,
  base64ByteLength,
  hexToBytes,
  truncatePayloadForHistory,
  MAX_HISTORY_PAYLOAD_BYTES,
} from "@/lib/bytes";

describe("bytes", () => {
  test("round-trips bytes through base64", () => {
    const bytes = new Uint8Array([0x0a, 0x05, 0x68, 0xff, 0x00]);
    const b64 = bytesToBase64(bytes);
    expect(b64).toBe("CgVo/wA=");
    expect(Array.from(base64ToBytes(b64))).toEqual([0x0a, 0x05, 0x68, 0xff, 0x00]);
  });

  test("renders base64 as the spaced lowercase hex the app uses everywhere", () => {
    expect(base64ToHex("CgVo/wA=")).toBe("0a 05 68 ff 00");
    expect(base64ToHex("")).toBe("");
  });

  test("turns spaced or unspaced hex back into bytes", () => {
    expect(Array.from(hexToBytes("0a 05 68 ff 00"))).toEqual([0x0a, 0x05, 0x68, 0xff, 0x00]);
    expect(Array.from(hexToBytes("0a0568ff00"))).toEqual([0x0a, 0x05, 0x68, 0xff, 0x00]);
    expect(Array.from(hexToBytes(""))).toEqual([]);
  });

  test("hexToBytes is the inverse of base64ToHex", () => {
    expect(bytesToBase64(hexToBytes(base64ToHex("CgVo/wA=")))).toBe("CgVo/wA=");
  });

  test("reports the decoded length without decoding", () => {
    expect(base64ByteLength("CgVo/wA=")).toBe(5);
    expect(base64ByteLength("CgU=")).toBe(2);
    expect(base64ByteLength("")).toBe(0);
  });

  test("keeps small payloads intact and truncates oversized ones for history", () => {
    const small = truncatePayloadForHistory("CgU=");
    expect(small).toEqual({ payloadBase64: "CgU=", payloadTruncated: false });

    const big = bytesToBase64(new Uint8Array(MAX_HISTORY_PAYLOAD_BYTES + 10).fill(0x41));
    const stored = truncatePayloadForHistory(big);
    expect(stored.payloadTruncated).toBe(true);
    expect(base64ByteLength(stored.payloadBase64)).toBe(MAX_HISTORY_PAYLOAD_BYTES);
  });
});
