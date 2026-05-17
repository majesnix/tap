/**
 * Rendered by NestedMessageField when recursion depth reaches 5.
 * Prevents infinite recursion on self-referencing proto types (FORM-08, T-03-01).
 */
export function DepthCapPlaceholder() {
  return (
    <div className="ml-4 border-l border-border pl-3 py-1 text-xs text-muted-foreground italic">
      Nesting limit reached (max depth 5)
    </div>
  );
}
