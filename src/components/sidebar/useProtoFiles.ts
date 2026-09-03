import { useState, useEffect, useRef, useCallback } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { load } from "@tauri-apps/plugin-store";
import { toast } from "sonner";
import { parseProto, reloadProto, checkPathsExist } from "@/lib/ipc";
import { useProtoStore } from "@/stores/useProtoStore";
import { loadIncludePathsOrDefault, parentDirOf } from "@/components/sidebar/useIncludePaths";
import type { OpenFileEntry } from "@/stores/useProtoStore";

const STORE_PATH = "tap.json";
const INCLUDE_PATH_KEY_PREFIX = "include_paths:";
const RECENT_FILES_KEY = "recent_files";

interface IncludeDialogState {
  open: boolean;
  initialPaths: string[];
  onConfirm: (paths: string[]) => Promise<void>;
  onCancel: () => void;
}

interface UseProtoFilesResult {
  openFiles: OpenFileEntry[];
  activeIndex: number;
  recentFiles: string[];
  closedRecentFiles: string[];
  stalePaths: Set<string>;
  parseError: string | null;
  isReloading: boolean;
  openFile: () => Promise<void>;
  reload: () => Promise<void>;
  openRecent: (path: string) => Promise<void>;
  activate: (index: number) => void;
  close: (index: number) => void;
  includeDialog: IncludeDialogState;
}

/**
 * All FILES-sidebar logic: recent-files persistence, stale-path checks,
 * open -> include-path dialog -> parse, reload and open-recent. Ported from
 * FileSection.tsx so it can be shared by FilesSidebar without any JSX.
 */
export function useProtoFiles(): UseProtoFilesResult {
  const openFiles = useProtoStore((s) => s.openFiles);
  const activeIndex = useProtoStore((s) => s.activeIndex);
  const addOrActivateFile = useProtoStore((s) => s.addOrActivateFile);
  const closeFile = useProtoStore((s) => s.closeFile);
  const setActiveIndex = useProtoStore((s) => s.setActiveIndex);
  const updateFileSchema = useProtoStore((s) => s.updateFileSchema);
  const recentFiles = useProtoStore((s) => s.recentFiles);
  const addRecentFile = useProtoStore((s) => s.addRecentFile);
  const setRecentFiles = useProtoStore((s) => s.setRecentFiles);

  const openFileRequested = useProtoStore((s) => s.openFileRequested);
  const openFileRequestedRef = useRef(openFileRequested);

  const reloadRequested = useProtoStore((s) => s.reloadRequested);
  const reloadRequestedRef = useRef(reloadRequested);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [pendingFilePath, setPendingFilePath] = useState<string | null>(null);
  const [pendingIncludePaths, setPendingIncludePaths] = useState<string[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isReloading, setIsReloading] = useState(false);
  const [stalePaths, setStalePaths] = useState<Set<string>>(new Set());

  // Load recent files from store on mount
  useEffect(() => {
    load(STORE_PATH)
      .then(async (store) => {
        const saved = await store.get<string[]>(RECENT_FILES_KEY);
        if (saved && saved.length > 0) {
          setRecentFiles(saved);
        }
      })
      .catch(() => {});
  }, [setRecentFiles]);

  // Persist recent files whenever they change
  const recentFilesRef = useRef(recentFiles);
  useEffect(() => {
    if (recentFiles === recentFilesRef.current) return;
    recentFilesRef.current = recentFiles;
    load(STORE_PATH)
      .then(async (store) => {
        await store.set(RECENT_FILES_KEY, recentFiles);
        await store.save();
      })
      .catch(() => {});
  }, [recentFiles]);

  // Check stale status of recent files on mount and when recent files change
  useEffect(() => {
    if (recentFiles.length === 0) return;
    checkPathsExist(recentFiles)
      .then((results) => {
        const stale = new Set<string>();
        recentFiles.forEach((f, i) => {
          if (!results[i]) stale.add(f);
        });
        setStalePaths(stale);
      })
      .catch(() => {});
  }, [recentFiles]);

  const reload = useCallback(async () => {
    if (openFiles.length === 0 || activeIndex === -1) return;
    const activeFile = openFiles[activeIndex];
    if (!activeFile) return;

    setIsReloading(true);
    try {
      const allFilePaths = openFiles.map((f) => f.filePath);
      const allIncludePaths = await Promise.all(
        openFiles.map((f) => loadIncludePathsOrDefault(f.filePath))
      );

      // Apply each schema to its own filePath (not all to activeFile).
      const schemas = await reloadProto(allFilePaths, allIncludePaths);
      schemas.forEach((schema, i) => {
        const file = openFiles[i];
        if (file) updateFileSchema(file.filePath, schema);
      });
      toast.success("Proto schema reloaded");
      setParseError(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setParseError(`Reload failed: ${message}`);
    } finally {
      setIsReloading(false);
    }
  }, [openFiles, activeIndex, updateFileSchema]);

  const openFile = useCallback(async () => {
    const selected = await open({
      multiple: false,
      filters: [{ name: "Proto files", extensions: ["proto"] }],
    });

    if (!selected || typeof selected !== "string") return;

    const initialPaths = await loadIncludePathsOrDefault(selected);

    setPendingFilePath(selected);
    setPendingIncludePaths(initialPaths);
    setParseError(null);
    setDialogOpen(true);
  }, []);

  const handleConfirm = useCallback(
    async (paths: string[]) => {
      if (!pendingFilePath) return;

      setDialogOpen(false);

      try {
        const store = await load(STORE_PATH);
        await store.set(`${INCLUDE_PATH_KEY_PREFIX}${pendingFilePath}`, paths);
        await store.save();

        const schema = await parseProto(pendingFilePath, paths);
        addOrActivateFile(pendingFilePath, schema);
        addRecentFile(pendingFilePath);
        setParseError(null);
      } catch (err: unknown) {
        // Surface the raw backend message verbatim. protox reports the exact
        // problem; categorizing here only hid the real cause behind a useless
        // generic string. For import errors we still append a hint.
        const message = err instanceof Error ? err.message : String(err);
        const isImportError = message.includes("import") || message.includes("resolution");
        setParseError(
          isImportError
            ? `${message} — add the containing directory to include paths.`
            : message
        );
      }
    },
    [pendingFilePath, addOrActivateFile, addRecentFile]
  );

  const handleCancel = useCallback(() => {
    setDialogOpen(false);
    setPendingFilePath(null);
  }, []);

  const openRecent = useCallback(
    async (filePath: string) => {
      if (stalePaths.has(filePath)) return;

      const store = await load(STORE_PATH);
      const savedPaths = await store.get<string[]>(`${INCLUDE_PATH_KEY_PREFIX}${filePath}`);

      if (!savedPaths) {
        setPendingFilePath(filePath);
        setPendingIncludePaths([parentDirOf(filePath)]);
        setParseError(null);
        setDialogOpen(true);
        return;
      }

      try {
        const schema = await parseProto(filePath, savedPaths);
        addOrActivateFile(filePath, schema);
        addRecentFile(filePath);
        setParseError(null);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        setParseError(`Failed to open: ${message}`);
      }
    },
    [stalePaths, addOrActivateFile, addRecentFile]
  );

  useEffect(() => {
    if (openFileRequested > 0 && openFileRequested !== openFileRequestedRef.current) {
      openFileRequestedRef.current = openFileRequested;
      void openFile();
    }
  }, [openFileRequested, openFile]);

  useEffect(() => {
    if (reloadRequested > 0 && reloadRequested !== reloadRequestedRef.current) {
      reloadRequestedRef.current = reloadRequested;
      void reload();
    }
  }, [reloadRequested, reload]);

  // Filter recent files to only show ones not currently open
  const closedRecentFiles = recentFiles.filter(
    (rf) => !openFiles.some((of) => of.filePath === rf)
  );

  return {
    openFiles,
    activeIndex,
    recentFiles,
    closedRecentFiles,
    stalePaths,
    parseError,
    isReloading,
    openFile,
    reload,
    openRecent,
    activate: setActiveIndex,
    close: closeFile,
    includeDialog: {
      open: dialogOpen,
      initialPaths: pendingIncludePaths,
      onConfirm: handleConfirm,
      onCancel: handleCancel,
    },
  };
}
