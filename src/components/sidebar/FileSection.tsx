import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { load } from "@tauri-apps/plugin-store";
import { Button } from "@/components/ui/button";
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
  const setFile = useProtoStore((state) => state.setFile);
  const activeFilePath = useProtoStore((state) => state.activeFilePath);

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

    // Derive parent directory from file path
    const pathParts = selected.split("/");
    pathParts.pop();
    const parentDir = pathParts.join("/") || "/";

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
      setFile(pendingFilePath, schema);
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

  const fileName = activeFilePath
    ? activeFilePath.split("/").pop() ?? activeFilePath
    : null;

  return (
    <>
      <div className="flex flex-col gap-2">
        <Button onClick={handleOpenFile} variant="outline" className="w-full">
          Open .proto File
        </Button>

        {fileName && (
          <p
            className="text-xs text-muted-foreground truncate"
            title={activeFilePath ?? ""}
          >
            {fileName}
          </p>
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
