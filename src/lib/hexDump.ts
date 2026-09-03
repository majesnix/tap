export interface HexRow {
  offset: string;
  bytes: string;
  ascii: string;
}

const PRINTABLE_MIN = 32;
const PRINTABLE_MAX = 126;

function bytesOf(hex: string): string[] {
  return hex.replace(/\s+/g, "").toLowerCase().match(/.{2}/g) ?? [];
}

/** Rows of `bytesPerRow` bytes: 4-digit hex offset, spaced bytes, printable ASCII with "·" for the rest. */
export function hexRows(hex: string, bytesPerRow = 8): HexRow[] {
  const bytes = bytesOf(hex);
  const rows: HexRow[] = [];
  for (let i = 0; i < bytes.length; i += bytesPerRow) {
    const chunk = bytes.slice(i, i + bytesPerRow);
    rows.push({
      offset: i.toString(16).padStart(4, "0"),
      bytes: chunk.join(" "),
      ascii: chunk
        .map((b) => {
          const code = parseInt(b, 16);
          return code >= PRINTABLE_MIN && code <= PRINTABLE_MAX ? String.fromCharCode(code) : "·";
        })
        .join(""),
    });
  }
  return rows;
}

/** The first `maxBytes` bytes as spaced hex, with an ellipsis when the payload is longer. */
export function inlineHex(hex: string, maxBytes = 48): string {
  const bytes = bytesOf(hex);
  const head = bytes.slice(0, maxBytes).join(" ");
  return bytes.length > maxBytes ? `${head} …` : head;
}
