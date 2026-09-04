import { createContext, useContext } from "react";

/**
 * Nesting depth of the current field, used to alternate input backgrounds
 * (`bg-background` at depth 0, `bg-card` at odd depth, and so on).
 * `NestedMessageField` provides `depth + 1` to its children; everything else
 * reads the ambient default of 0 (top-level fields have no provider above them).
 */
export const FieldDepthContext = createContext<number>(0);

export const useFieldDepth = () => useContext(FieldDepthContext);
