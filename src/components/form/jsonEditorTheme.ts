import { EditorView } from "@codemirror/view";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags } from "@lezer/highlight";

// Structural — CSS custom properties, not CodeMirror's own light/dark tokens, so the
// same extensions render correctly whichever theme (.dark or default) is active.
const baseTheme = EditorView.theme({
  "&": {
    backgroundColor: "var(--card)",
    color: "var(--foreground)",
    fontSize: "12.5px",
    lineHeight: "20px",
  },
  ".cm-content": {
    caretColor: "var(--foreground)",
  },
  ".cm-gutters": {
    width: "44px",
    backgroundColor: "var(--background)",
    color: "var(--ghost)",
    fontSize: "12.5px",
    border: "none",
  },
  ".cm-lineNumbers .cm-gutterElement": {
    textAlign: "right",
  },
  ".cm-activeLine, .cm-activeLineGutter": {
    backgroundColor: "transparent",
  },
});

// JSON token colors: keys, strings, numbers/bool/null.
const jsonHighlightStyle = HighlightStyle.define([
  { tag: tags.propertyName, color: "var(--muted-foreground)" },
  { tag: tags.string, color: "var(--violet-bright)" },
  { tag: tags.number, color: "var(--foreground)" },
  { tag: tags.bool, color: "var(--foreground)" },
  { tag: tags.null, color: "var(--foreground)" },
]);

/**
 * Design-system CodeMirror theme + JSON highlight style, shared by JsonEditor and reused
 * by other CodeMirror surfaces (e.g. the blocks editor). `dark` only feeds CodeMirror's own
 * `dark` flag (used for its built-in a11y/contrast heuristics) — the actual colors all come
 * from CSS custom properties, so the extensions don't need to be rebuilt on theme change.
 */
export function jsonEditorTheme(dark: boolean) {
  return [EditorView.theme({}, { dark }), baseTheme, syntaxHighlighting(jsonHighlightStyle)];
}
