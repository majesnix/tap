import { useState, useEffect, useCallback } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { load } from "@tauri-apps/plugin-store";
import { X, FolderPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { reloadProto } from "@/lib/ipc";
import { useProtoStore } from "@/stores/useProtoStore";

const STORE_PATH = "tap.json";
const INCLUDE_PATH_KEY_PREFIX = "include_paths:";

interface IncludePathManagerProps {
  filePath: string;
}

export function IncludePathManager({ filePath }: IncludePathManagerProps) {
  const [includePaths, setIncludePaths] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const openFiles = useProtoStore((s) => s.openFiles);
  const updateFileSchema = useProtoStore((s) => s.updateFileSchema);

  useEffect(() => {
    setIsLoading(true);
    load(STORE_PATH)
      .then(async (store) => {
        const saved = await store.get<string[]>(
          `${INCLUDE_PATH_KEY_PREFIX}${filePath}`
        );
        if (saved) {
          setIncludePaths(saved);
        } else {
          const sep = filePath.includes("\\") ? "\\" : "/";
          const parts = filePath.split(sep);
          parts.pop();
          setIncludePaths([parts.join(sep) || sep]);
        }
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [filePath]);

  const reloadWithPaths = useCallback(
    async (newPaths: string[]) => {
      try {
        const store = await load(STORE_PATH);
        await store.set(`${INCLUDE_PATH_KEY_PREFIX}${filePath}`, newPaths);
        await store.save();

        const allFilePaths = openFiles.map((f) => f.filePath);
        const allIncludePaths = await Promise.all(
          openFiles.map(async (f) => {
            if (f.filePath === filePath) return newPaths;
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

        // BUG-3 fix: reloadProto now returns ProtoSchema[] (one per file).
        // Update each open file's schema by index, matching FileSection.tsx pattern.
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

  const handleAdd = async () => {
    const selected = await open({ directory: true, multiple: false });
    if (!selected || typeof selected !== "string") return;
    if (includePaths.includes(selected)) {
      toast.info("Path already included");
      return;
    }
    const newPaths = [...includePaths, selected];
    setIncludePaths(newPaths);
    await reloadWithPaths(newPaths);
  };

  const handleRemove = async (index: number) => {
    const newPaths = includePaths.filter((_, i) => i !== index);
    setIncludePaths(newPaths);
    await reloadWithPaths(newPaths);
  };

  const extractDirName = (p: string) => {
    const sep = p.includes("\\") ? "\\" : "/";
    return p.split(sep).pop() ?? p;
  };

  if (isLoading) return null;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">
          Include Paths
        </span>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={handleAdd}
                aria-label="Add include path"
              >
                <FolderPlus size={14} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Add include path</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <div className="flex flex-wrap gap-1">
        {includePaths.map((p, i) => (
          <TooltipProvider key={`${p}-${i}`}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex items-center gap-0.5 rounded-md border px-1.5 py-0.5 text-xs text-muted-foreground">
                  {extractDirName(p)}
                  <button
                    type="button"
                    onClick={() => handleRemove(i)}
                    aria-label={`Remove include path ${p}`}
                    className="ml-0.5 rounded hover:bg-accent hover:text-foreground"
                  >
                    <X size={10} />
                  </button>
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom">{p}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ))}
      </div>
    </div>
  );
}
