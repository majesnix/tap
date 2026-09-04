import { describe, it, expect } from "vitest";
import { hexRows, inlineHex } from "@/lib/hexDump";

describe("hexRows", () => {
  it("splits spaced hex into 8-byte rows with offset and ascii", () => {
    const rows = hexRows("48 65 6c 6c 6f 00 ff 21 41");
    expect(rows).toEqual([
      { offset: "0000", bytes: "48 65 6c 6c 6f 00 ff 21", ascii: "Hello··!" },
      { offset: "0008", bytes: "41", ascii: "A" },
    ]);
  });
  it("accepts unspaced hex and returns no rows for an empty string", () => {
    expect(hexRows("0a05")[0].bytes).toBe("0a 05");
    expect(hexRows("")).toEqual([]);
  });
});

describe("inlineHex", () => {
  it("returns the first bytes and an ellipsis when longer", () => {
    expect(inlineHex("0a 05 0c", 2)).toBe("0a 05 …");
    expect(inlineHex("0a 05", 2)).toBe("0a 05");
  });
});
