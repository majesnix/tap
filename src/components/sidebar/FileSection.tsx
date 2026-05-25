import { useState, useEffect, useRef, useCallback } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { load } from "@tauri-apps/plugin-store";
import { X, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { IncludePathDialog } from "@/components/include-paths/IncludePathDialog";
import { parseProto, reloadProto, checkPathsExist } from "@/lib/ipc";
import { useProtoStore } from "@/stores/useProtoStore";

const STORE_PATH = "tap.json";
const INCLUDE_PATH_KEY_PREFIX = "include_paths:";
const RECENT_FILES_KEY = "recent_files";

/**
 * Sidebar section that handles .proto file selection and include path configuration.
 *
 * Flow:
 * 1. User clicks "Open .proto File"
 * 2. Native file picker opens (filter: .proto)
 * 3. Load previously saved include paths for the selected file from tauri-plugin-store
 * 4. Open IncludePathDialog pre-populated with saved paths (or parent dir on first open)
 * 5. On confirm: save paths to store keyed by absolute file path, call parseProto
 * 6. On cancel: abort — sidebar stays in previous state
 *
 * Persistence (D-08/D-09): key = "include_paths:{absoluteFilePath}", store = "tap.json"
 */
export function FileSection() {
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
    load(STORE_PATH).then(async (store) => {
      const saved = await store.get<string[]>(RECENT_FILES_KEY);
      if (saved && saved.length > 0) {
        setRecentFiles(saved);
      }
    }).catch(() => {});
  }, [setRecentFiles]);

  // Persist recent files whenever they change
  const recentFilesRef = useRef(recentFiles);
  useEffect(() => {
    if (recentFiles === recentFilesRef.current) return;
    recentFilesRef.current = recentFiles;
    load(STORE_PATH).then(async (store) => {
      await store.set(RECENT_FILES_KEY, recentFiles);
      await store.save();
    }).catch(() => {});
  }, [recentFiles]);

  // Check stale status of recent files on mount and when recent files change
  useEffect(() => {
    if (recentFiles.length === 0) return;
    checkPathsExist(recentFiles).then((results) => {
      const stale = new Set<string>();
      recentFiles.forEach((f, i) => {
        if (!results[i]) stale.add(f);
      });
      setStalePaths(stale);
    }).catch(() => {});
  }, [recentFiles]);

  const handleReload = useCallback(async () => {
    if (openFiles.length === 0 || activeIndex === -1) return;
    const activeFile = openFiles[activeIndex];
    if (!activeFile) return;

    setIsReloading(true);
    try {
      const store = await load(STORE_PATH);
      const allFilePaths = openFiles.map((f) => f.filePath);
      const allIncludePaths = await Promise.all(
        openFiles.map(async (f) => {
          const saved = await store.get<string[]>(
            `${INCLUDE_PATH_KEY_PREFIX}${f.filePath}`
          );
          if (saved) return saved;
          const sep = f.filePath.includes("\\") ? "\\" : "/";
          const parts = f.filePath.split(sep);
          parts.pop();
          return [parts.join(sep) || sep];
        })
      );

      const schema = await reloadProto(allFilePaths, allIncludePaths);
      updateFileSchema(activeFile.filePath, schema);
      toast.success("Proto schema reloaded");
      setParseError(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setParseError(`Reload failed: ${message}`);
    } finally {
      setIsReloading(false);
    }
  }, [openFiles, activeIndex, updateFileSchema]);

  useEffect(() => {
    if (openFileRequested > 0 && openFileRequested !== openFileRequestedRef.current) {
      openFileRequestedRef.current = openFileRequested;
      handleOpenFile();
    }
  }, [openFileRequested]);

  useEffect(() => {
    if (reloadRequested > 0 && reloadRequested !== reloadRequestedRef.current) {
      reloadRequestedRef.current = reloadRequested;
      handleReload();
    }
  }, [reloadRequested, handleReload]);

  const handleOpenFile = async () => {
    const selected = await open({
      multiple: false,
      filters: [{ name: "Proto files", extensions: ["proto"] }],
    });

    if (!selected || typeof selected !== "string") return;

    const sep = selected.includes("\\") ? "\\" : "/";
    const pathParts = selected.split(sep);
    pathParts.pop();
    const parentDir = pathParts.join(sep) || sep;

    const store = await load(STORE_PATH);
    const savedPaths = await store.get<string[]>(
      `${INCLUDE_PATH_KEY_PREFIX}${selected}`
    );
    const initialPaths = savedPaths ?? [parentDir];

    setPendingFilePath(selected);
    setPendingIncludePaths(initialPaths);
    setParseError(null);
    setDialogOpen(true);
  };

  const handleConfirm = async (paths: string[]) => {
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
      const message = err instanceof Error ? err.message : String(err);

      if (message.includes("import") || message.includes("resolution")) {
        setParseError(
          `Import resolution failed. Add the containing directory to include paths.`
        );
      } else {
        setParseError(
          "Could not parse .proto file. Check include paths and file syntax."
        );
      }
    }
  };

  const handleCancel = () => {
    setDialogOpen(false);
    setPendingFilePath(null);
  };

  const handleOpenRecentFile = async (filePath: string) => {
    if (stalePaths.has(filePath)) return;

    const store = await load(STORE_PATH);
    const savedPaths = await store.get<string[]>(
      `${INCLUDE_PATH_KEY_PREFIX}${filePath}`
    );

    if (!savedPaths) {
      const sep = filePath.includes("\\") ? "\\" : "/";
      const parts = filePath.split(sep);
      parts.pop();
      const parentDir = parts.join(sep) || sep;
      setPendingFilePath(filePath);
      setPendingIncludePaths([parentDir]);
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
  };

  const extractFileName = (fp: string) => {
    const sep = fp.includes("\\") ? "\\" : "/";
    return fp.split(sep).pop() ?? fp;
  };

  // Filter recent files to only show ones not currently open
  const closedRecentFiles = recentFiles.filter(
    (rf) => !openFiles.some((of) => of.filePath === rf)
  );

  return (
    <>
      <div className="flex flex-col gap-2">
        <div className="flex gap-1">
          <Button onClick={handleOpenFile} variant="outline" className="flex-1">
            Open .proto File
          </Button>
          {openFiles.length > 0 && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleReload}
                    disabled={isReloading || activeIndex === -1}
                    aria-label="Reload proto schema"
                  >
                    <RefreshCw
                      size={16}
                      className={isReloading ? "animate-spin" : ""}
                    />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Reload schema (Cmd+R)</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>

        {openFiles.length === 0 ? (
          <p className="text-xs text-muted-foreground">No file open</p>
        ) : (
          <Tabs
            orientation="vertical"
            value={String(activeIndex)}
            onValueChange={(v) => setActiveIndex(Number(v))}
          >
            <ScrollArea className="max-h-48">
              <TabsList className="flex flex-col h-auto w-full items-stretch gap-0.5 p-1">
                {openFiles.map((file, index) => {
                  const fileName = extractFileName(file.filePath);
                  return (
                    <div key={file.filePath} className="flex items-center gap-0.5">
                      <TabsTrigger
                        value={String(index)}
                        className="flex-1 text-left justify-start text-xs truncate"
                        title={file.filePath}
                      >
                        {fileName}
                      </TabsTrigger>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Close ${fileName}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          closeFile(index);
                        }}
                      >
                        <X size={12} />
                      </Button>
                    </div>
                  );
                })}
              </TabsList>
            </ScrollArea>
          </Tabs>
        )}

        {closedRecentFiles.length > 0 && (
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">
              Recent Files
            </span>
            <ScrollArea className="max-h-32">
              <div className="flex flex-col gap-0.5">
                <TooltipProvider>
                  {closedRecentFiles.map((rf) => {
                    const isStale = stalePaths.has(rf);
                    return (
                      <Tooltip key={rf}>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            disabled={isStale}
                            onClick={() => handleOpenRecentFile(rf)}
                            className={`text-left text-xs px-2 py-1 rounded hover:bg-accent truncate ${
                              isStale
                                ? "line-through text-muted-foreground opacity-50 cursor-not-allowed"
                                : "cursor-pointer"
                            }`}
                          >
                            {extractFileName(rf)}
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="right">
                          {isStale ? `File not found: ${rf}` : rf}
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </TooltipProvider>
              </div>
            </ScrollArea>
          </div>
        )}

        {parseError && (
          <p className="text-xs text-destructive" role="alert">
            {parseError}
          </p>
        )}
      </div>

      {pendingFilePath && (
        <IncludePathDialog
          open={dialogOpen}
          initialPaths={pendingIncludePaths}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      )}
    </>
  );
}
