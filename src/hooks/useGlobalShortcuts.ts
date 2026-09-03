import { useHotkeys } from "react-hotkeys-hook";
import { useProtoStore } from "@/stores/useProtoStore";

/**
 * Open-file / reload-schema shortcuts, extracted out of ComposeView (formerly
 * AppLayout) so the binding lives in one place.
 *
 * Call this from exactly one mounted component — currently `ComposeView`,
 * matching the pre-refactor scope (Plans never had these shortcuts). Do NOT
 * also call it from `App`: `useHotkeys` binds a document-level listener per
 * call site, so two simultaneously-mounted callers double-fire on every
 * keypress — each requestOpenFile()/requestReload() would run twice, and
 * FileSection's request-counter effect (FileSection.tsx) would open the
 * native file dialog twice for a single Cmd+O.
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
