import { useState, useEffect, useCallback } from "react";
import { load } from "@tauri-apps/plugin-store";
import { toast } from "sonner";
import { reloadProto } from "@/lib/ipc";
import { useProtoStore } from "@/stores/useProtoStore";

const STORE_PATH = "tap.json";
const INCLUDE_PATH_KEY_PREFIX = "include_paths:";

// FileRow (for the row meta) and IncludePathManager (inside its popover) each
// call useIncludePaths() for the same filePath — two independent useState
// instances. Without this, setPaths() in one only updates its own caller and
// the other goes stale until it happens to re-run its load effect. This
// registry lets every mounted instance for a given filePath re-render with
// the same value the moment any of them persists a change.
const subscribers = new Map<string, Set<(paths: string[]) => void>>();

function notifySubscribers(filePath: string, paths: string[]): void {
  subscribers.get(filePath)?.forEach((fn) => fn(paths));
}

function lastSegment(path: string): string {
  const sep = path.includes("\\") ? "\\" : "/";
  return path.split(sep).pop() ?? path;
}

/** Last path segment of a file path, e.g. "/a/b/order.proto" -> "order.proto". */
export function fileName(path: string): string {
  return lastSegment(path);
}

/** Last path segment of a directory path, e.g. "/a/b/examples" -> "examples". */
export function dirName(path: string): string {
  return lastSegment(path);
}

/** The containing directory of a file path, e.g. "/a/b/order.proto" -> "/a/b". */
export function parentDirOf(filePath: string): string {
  const sep = filePath.includes("\\") ? "\\" : "/";
  const parts = filePath.split(sep);
  parts.pop();
  return parts.join(sep) || sep;
}

/**
 * The include paths saved for `filePath` (key "include_paths:{filePath}" in
 * tap.json), or the file's parent directory when nothing has been saved yet.
 */
export async function loadIncludePathsOrDefault(filePath: string): Promise<string[]> {
  const store = await load(STORE_PATH);
  const saved = await store.get<string[]>(`${INCLUDE_PATH_KEY_PREFIX}${filePath}`);
  return saved ?? [parentDirOf(filePath)];
}

/**
 * Single source of truth for one file's include paths (D-08/D-09 persistence).
 * `setPaths` persists the new list to tap.json and reloads every currently
 * open file — its own schema with the new paths, every other open file with
 * its own saved (or default) paths — so a change here stays consistent with
 * the rest of the workbench.
 */
export function useIncludePaths(filePath: string): {
  paths: string[];
  loaded: boolean;
  setPaths: (paths: string[]) => Promise<void>;
} {
  const [paths, setPathsState] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);

  const openFiles = useProtoStore((s) => s.openFiles);
  const updateFileSchema = useProtoStore((s) => s.updateFileSchema);

  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    loadIncludePathsOrDefault(filePath)
      .then((loadedPaths) => {
        if (!cancelled) setPathsState(loadedPaths);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [filePath]);

  // Keep every mounted instance for this filePath (row meta + popover manager)
  // in sync when any of them calls setPaths.
  useEffect(() => {
    const set = subscribers.get(filePath) ?? new Set<(paths: string[]) => void>();
    subscribers.set(filePath, set);
    set.add(setPathsState);
    return () => {
      set.delete(setPathsState);
      if (set.size === 0) subscribers.delete(filePath);
    };
  }, [filePath]);

  const setPaths = useCallback(
    async (newPaths: string[]) => {
      setPathsState(newPaths);
      notifySubscribers(filePath, newPaths);
      try {
        const store = await load(STORE_PATH);
        await store.set(`${INCLUDE_PATH_KEY_PREFIX}${filePath}`, newPaths);
        await store.save();

        const allFilePaths = openFiles.map((f) => f.filePath);
        const allIncludePaths = await Promise.all(
          openFiles.map((f) =>
            f.filePath === filePath
              ? Promise.resolve(newPaths)
              : loadIncludePathsOrDefault(f.filePath)
          )
        );

        const schemas = await reloadProto(allFilePaths, allIncludePaths);
        schemas.forEach((schema, i) => {
          const file = openFiles[i];
          if (file) updateFileSchema(file.filePath, schema);
        });
        toast.success("Proto schema reloaded");
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        toast.error(`Reload failed: ${message}`);
      }
    },
    [filePath, openFiles, updateFileSchema]
  );

  return { paths, loaded, setPaths };
}
