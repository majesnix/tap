import "@testing-library/jest-dom";

// jsdom does not implement ResizeObserver — polyfill it for components using
// @radix-ui/react-scroll-area (FormPanel, etc.)
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

window.ResizeObserver = ResizeObserverStub;

// Radix UI components (Tooltip, ScrollArea, Select, Radio) defer state updates
// via Floating UI microtasks and ResizeObserver callbacks that fire after the
// synchronous render() call returns. Under React 19 these land outside any
// act() boundary and produce noisy "not wrapped in act(...)" warnings, even
// when the test code is correct and the component behaves identically.
//
// Suppress only this specific known-noise warning. Other console.error output
// (real bugs, prop-type errors, etc.) still surfaces normally.
const originalConsoleError = console.error;
console.error = (...args: unknown[]) => {
  const first = args[0];
  if (typeof first === "string" && first.includes("not wrapped in act(")) {
    return;
  }
  originalConsoleError(...(args as Parameters<typeof console.error>));
};
