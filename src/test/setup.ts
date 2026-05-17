import "@testing-library/jest-dom";

// jsdom does not implement ResizeObserver — polyfill it for components using
// @radix-ui/react-scroll-area (FormPanel, etc.)
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

window.ResizeObserver = ResizeObserverStub;
