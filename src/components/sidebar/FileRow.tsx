import { FileCode, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { IconButton } from "@/components/common/IconButton";
import { IncludePathManager } from "@/components/sidebar/IncludePathManager";
import { useIncludePaths, fileName, dirName } from "@/components/sidebar/useIncludePaths";
import { cn } from "@/lib/utils";
import type { OpenFileEntry } from "@/stores/useProtoStore";

interface FileRowProps {
  file: OpenFileEntry;
  active: boolean;
  onActivate: () => void;
  onClose: () => void;
}

function countLabel(count: number, singular: string): string {
  return `${count} ${singular}${count === 1 ? "" : "s"}`;
}

export function FileRow({ file, active, onActivate, onClose }: FileRowProps) {
  const name = fileName(file.filePath);
  const { paths, loaded } = useIncludePaths(file.filePath);

  let meta = `${countLabel(file.schema.messages.length, "message")} · ${countLabel(
    file.schema.enums.length,
    "enum"
  )}`;
  if (loaded && paths.length > 0) {
    meta += ` · includes ${dirName(paths[0])}${paths.length > 1 ? ` +${paths.length - 1}` : ""}`;
  }

  return (
    <div
      role="button"
      tabIndex={0}
      title={file.filePath}
      onClick={onActivate}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onActivate();
        }
      }}
      className={cn(
        "flex h-10 items-center gap-2.5 rounded-lg px-2.5",
        active
          ? "border border-border bg-card"
          : "cursor-pointer text-muted-foreground hover:bg-card"
      )}
    >
      <span
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-md",
          active ? "bg-primary/12 text-violet-bright" : "bg-card text-muted-foreground"
        )}
      >
        <FileCode size={15} strokeWidth={1.5} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-13 font-medium">{name}</span>
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={`Include paths for ${name}`}
              onClick={(e) => e.stopPropagation()}
              className="truncate text-left text-11 text-ghost"
            >
              {meta}
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" onClick={(e) => e.stopPropagation()}>
            <IncludePathManager filePath={file.filePath} />
          </PopoverContent>
        </Popover>
      </div>
      {active && (
        <IconButton
          size={22}
          label={`Close ${name}`}
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
        >
          <X size={13} strokeWidth={1.5} />
        </IconButton>
      )}
    </div>
  );
}
