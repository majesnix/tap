import { useState, useEffect } from "react";

/**
 * Debounces a value by the given delay (default 200ms).
 * The returned value only updates after the delay has elapsed without
 * the input value changing.
 */
export function useDebounce<T>(value: T, delay = 200): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
