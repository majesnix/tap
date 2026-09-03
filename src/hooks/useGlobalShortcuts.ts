import { useHotkeys } from "react-hotkeys-hook";
import { useProtoStore } from "@/stores/useProtoStore";

/**
 * Open-file / reload-schema shortcuts, extracted out of ComposeView (formerly
 * AppLayout) so the binding lives in one place.
 *
 * Call this once per *view* — `ComposeView` and `PlanView` each call it — so
 * mod+o/mod+r work everywhere. This is safe because `App` mounts exactly one
 * of the two views at a time (never both), so exactly one instance of this
 * hook is ever mounted. Do NOT also call it from `App` itself, and do NOT
 * call it from both views' shared ancestor: `useHotkeys` binds a
 * document-level listener per call site, so two *simultaneously*-mounted
 * callers double-fire on every keypress — each requestOpenFile()/
 * requestReload() would run twice, and FileSection's request-counter effect
 * (FileSection.tsx) would open the native file dialog twice for a single
 * Cmd+O.
 */
export function useGlobalShortcuts(): void {
  const requestOpenFile = useProtoStore((s) => s.requestOpenFile);
  const requestReload = useProtoStore((s) => s.requestReload);

  useHotkeys(
    "mod+o",
    (e) => {
      e.preventDefault();
      requestOpenFile();
    },
    { enableOnFormTags: true }
  );
  useHotkeys(
    "mod+r",
    (e) => {
      e.preventDefault();
      requestReload();
    },
    { enableOnFormTags: true }
  );
}
