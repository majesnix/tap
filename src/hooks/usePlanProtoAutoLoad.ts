import { useEffect } from "react";
import { load } from "@tauri-apps/plugin-store";
import { toast } from "sonner";
import { parseProto } from "@/lib/ipc";
import { useProtoStore } from "@/stores/useProtoStore";
import type { PlanStep } from "@/lib/types";

const STORE_PATH = "tap.json";
const INCLUDE_PATH_KEY_PREFIX = "include_paths:";

/**
 * When a plan is selected, auto-load any proto files referenced by its steps
 * that are not already open in the proto store. Uses saved include paths from
 * tap.json (same key as FileSection: "include_paths:{absoluteFilePath}").
 *
 * Falls back to the file's parent directory as include path if none were saved.
 * Shows a warning toast if a file cannot be loaded (moved/deleted/inaccessible).
 */
export function usePlanProtoAutoLoad(steps: PlanStep[]): void {
  const addOrActivateFile = useProtoStore((s) => s.addOrActivateFile);

  useEffect(() => {
    const missingPaths = [
      ...new Set(steps.map((s) => s.proto_path).filter(Boolean)),
    ].filter(
      (path) =>
        !useProtoStore.getState().openFiles.some((f) => f.filePath === path)
    );

    if (missingPaths.length === 0) return;

    void (async () => {
      const store = await load(STORE_PATH);

      for (const filePath of missingPaths) {
        try {
          const savedPaths = await store.get<string[]>(
            `${INCLUDE_PATH_KEY_PREFIX}${filePath}`
          );

          // Derive parent dir cross-platform (mirrors FileSection.tsx WR-04)
          const sep = filePath.includes("\\") ? "\\" : "/";
          const parts = filePath.split(sep);
          parts.pop();
          const parentDir = parts.join(sep) || sep;

          const includePaths = savedPaths ?? [parentDir];
          const schema = await parseProto(filePath, includePaths);
          addOrActivateFile(filePath, schema);
        } catch {
          const fileName = filePath.split(/[\\/]/).pop() ?? filePath;
          toast.warning(`Could not auto-load ${fileName} — open it manually.`);
        }
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [steps.map((s) => s.proto_path).join("|")]);
}
