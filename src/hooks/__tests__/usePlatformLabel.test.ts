import { renderHook } from "@testing-library/react";

const ORIGINAL_UA = navigator.userAgent;

afterEach(() => {
  Object.defineProperty(navigator, "userAgent", {
    value: ORIGINAL_UA,
    configurable: true,
  });
  // Force module re-evaluation so the top-level `isMac` is recalculated
  vi.resetModules();
});

function setUserAgent(ua: string) {
  Object.defineProperty(navigator, "userAgent", {
    value: ua,
    configurable: true,
  });
}

test("returns Mac labels when userAgent contains MacIntel", async () => {
  setUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)");
  const { usePlatformLabel } = await import("../usePlatformLabel");
  const { result } = renderHook(() => usePlatformLabel());

  expect(result.current.isMac).toBe(true);
  expect(result.current.mod).toBe("Cmd");
  expect(result.current.modSymbol).toBe("⌘");
});

test("returns non-Mac labels when userAgent is Windows", async () => {
  setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64)");
  const { usePlatformLabel } = await import("../usePlatformLabel");
  const { result } = renderHook(() => usePlatformLabel());

  expect(result.current.isMac).toBe(false);
  expect(result.current.mod).toBe("Ctrl");
  expect(result.current.modSymbol).toBe("Ctrl");
});

test("returns non-Mac labels when userAgent is Linux", async () => {
  setUserAgent("Mozilla/5.0 (X11; Linux x86_64)");
  const { usePlatformLabel } = await import("../usePlatformLabel");
  const { result } = renderHook(() => usePlatformLabel());

  expect(result.current.isMac).toBe(false);
  expect(result.current.mod).toBe("Ctrl");
  expect(result.current.modSymbol).toBe("Ctrl");
});
