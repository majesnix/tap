import { open } from "@tauri-apps/plugin-dialog";
import { FolderPlus, X } from "lucide-react";
import { toast } from "sonner";
import { IconButton } from "@/components/common/IconButton";
import { SectionLabel } from "@/components/common/SectionLabel";
import { useIncludePaths, dirName } from "@/components/sidebar/useIncludePaths";

interface IncludePathManagerProps {
  filePath: string;
}

export function IncludePathManager({ filePath }: IncludePathManagerProps) {
  const { paths, loaded, setPaths } = useIncludePaths(filePath);

  const handleAdd = async () => {
    const selected = await open({ directory: true, multiple: false });
    if (!selected || typeof selected !== "string") return;
    if (paths.includes(selected)) {
      toast.info("Path already included");
      return;
    }
    await setPaths([...paths, selected]);
  };

  const handleRemove = async (index: number) => {
    await setPaths(paths.filter((_, i) => i !== index));
  };

  if (!loaded) return null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <SectionLabel>Include paths</SectionLabel>
        <IconButton size={22} label="Add include path" onClick={() => void handleAdd()}>
          <FolderPlus size={13} strokeWidth={1.5} />
        </IconButton>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {paths.map((p, i) => (
          <span
            key={`${p}-${i}`}
            title={p}
            className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 font-mono text-12 text-muted-foreground"
          >
            {dirName(p)}
            <button
              type="button"
              onClick={() => void handleRemove(i)}
              aria-label={`Remove include path ${p}`}
              className="rounded-sm text-ghost hover:bg-surface-2 hover:text-foreground"
            >
              <X size={10} strokeWidth={1.5} />
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}
