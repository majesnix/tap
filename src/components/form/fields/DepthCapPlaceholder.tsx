/**
 * Rendered by NestedMessageField when recursion depth reaches 5.
 * Prevents infinite recursion on self-referencing proto types (FORM-08, T-03-01).
 */
export function DepthCapPlaceholder() {
  return (
    <div className="py-1 text-12 text-ghost italic">
      Nesting limit reached (max depth 5)
    </div>
  );
}
