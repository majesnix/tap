import type { MessageSchema } from "@/lib/types";

/**
 * Result of matching a block's JSON content against a message schema's field names.
 * `null` means no fit information can be shown (no message selected, invalid/empty
 * content, or nothing in common with the message's fields).
 */
export type BlockFit = { tone: "success" | "warning"; label: string } | null;

const DEFAULT_PREVIEW_MAX_CHARS = 60;

/**
 * Describes how well a block's JSON content fits the currently selected message,
 * by comparing the block's top-level keys against the message's field names.
 */
export function describeBlockFit(content: string, message: MessageSchema | null): BlockFit {
  if (!message) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return null;
  }

  const keys = Object.keys(parsed as Record<string, unknown>);
  if (keys.length === 0) return null;

  const fieldNames = new Set(message.fields.map((field) => field.name));
  const matched = keys.filter((key) => fieldNames.has(key)).length;
  if (matched === 0) return null;

  if (matched === keys.length) {
    return {
      tone: "success",
      label: `fits ${message.name} · ${matched} of ${message.fields.length} fields`,
    };
  }

  return {
    tone: "warning",
    label: `partly fits ${message.name} · ${matched} of ${keys.length} keys`,
  };
}

/**
 * Collapses a JSON string onto a single line (whitespace runs become a single
 * space) and ellipsizes it at `maxChars` for compact display in a block card.
 */
export function previewJson(content: string, maxChars: number = DEFAULT_PREVIEW_MAX_CHARS): string {
  const collapsed = content.replace(/\s+/g, " ").trim();
  if (collapsed.length <= maxChars) return collapsed;
  return `${collapsed.slice(0, maxChars)}…`;
}
