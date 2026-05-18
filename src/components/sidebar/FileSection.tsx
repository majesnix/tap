import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { load } from "@tauri-apps/plugin-store";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { IncludePathDialog } from "@/components/include-paths/IncludePathDialog";
import { parseProto } from "@/lib/ipc";
import { useProtoStore } from "@/stores/useProtoStore";

const STORE_PATH = "proto-sender.json";
const INCLUDE_PATH_KEY_PREFIX = "include_paths:";

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
 * Persistence (D-08/D-09): key = "include_paths:{absoluteFilePath}", store = "proto-sender.json"
 */
export function FileSection() {
  const openFiles = useProtoStore((s) => s.openFiles);
  const activeIndex = useProtoStore((s) => s.activeIndex);
  const addOrActivateFile = useProtoStore((s) => s.addOrActivateFile);
  const closeFile = useProtoStore((s) => s.closeFile);
  const setActiveIndex = useProtoStore((s) => s.setActiveIndex);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [pendingFilePath, setPendingFilePath] = useState<string | null>(null);
  const [pendingIncludePaths, setPendingIncludePaths] = useState<string[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);

  const handleOpenFile = async () => {
    const selected = await open({
      multiple: false,
      filters: [{ name: "Proto files", extensions: ["proto"] }],
    });

    if (!selected || typeof selected !== "string") return;

    // WR-04: Derive parent directory cross-platform.
    // On Windows, Tauri's dialog returns native paths with "\" separators; on
    // macOS/Linux it uses "/". Detect which separator is present to avoid
    // splitting on "/" when the path contains only "\", which would leave the
    // entire path as a single element and produce a bogus parent dir.
    const sep = selected.includes("\\") ? "\\" : "/";
    const pathParts = selected.split(sep);
    pathParts.pop();
    const parentDir = pathParts.join(sep) || sep;

    // Load previously saved include paths for this file (D-09)
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
      // Persist include paths for next open (D-09)
      const store = await load(STORE_PATH);
      await store.set(`${INCLUDE_PATH_KEY_PREFIX}${pendingFilePath}`, paths);
      await store.save();

      const schema = await parseProto(pendingFilePath, paths);
      addOrActivateFile(pendingFilePath, schema);
      setParseError(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);

      // Surface import resolution failures with actionable guidance
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

  return (
    <>
      <div className="flex flex-col gap-2">
        <Button onClick={handleOpenFile} variant="outline" className="w-full">
          Open .proto File
        </Button>

        {openFiles.length === 0 ? (
          <p className="text-xs text-muted-foreground">No file open</p>
        ) : (
          <Tabs
            value={String(activeIndex)}
            onValueChange={(v) => setActiveIndex(Number(v))}
          >
            <TabsList className="flex flex-col h-auto w-full items-stretch gap-0.5 p-1">
              {openFiles.map((file, index) => {
                // WR-04: split on the OS separator to extract the file name
                const fileSep = file.filePath.includes("\\") ? "\\" : "/";
                const fileName =
                  file.filePath.split(fileSep).pop() ?? file.filePath;
                return (
                  <div key={file.filePath} className="flex items-center">
                    <TabsTrigger
                      value={String(index)}
                      className="flex-1 text-left justify-start text-xs truncate"
                      title={file.filePath}
                    >
                      {fileName}
                    </TabsTrigger>
                    <button
                      type="button"
                      aria-label={`Close ${fileName}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        closeFile(index);
                      }}
                      className="ml-1 flex items-center justify-center rounded-sm px-1 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      ×
                    </button>
                  </div>
                );
              })}
            </TabsList>
          </Tabs>
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
