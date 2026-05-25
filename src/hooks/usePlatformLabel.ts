const isMac = /Macintosh|MacIntel|MacPPC|Mac68K/.test(navigator.userAgent);

export function usePlatformLabel() {
  return {
    isMac,
    mod: isMac ? "Cmd" : "Ctrl",
    modSymbol: isMac ? "⌘" : "Ctrl",
  } as const;
}
