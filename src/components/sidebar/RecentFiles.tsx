import { FileCode } from "lucide-react";
import { SectionLabel } from "@/components/common/SectionLabel";
import { fileName } from "@/components/sidebar/useIncludePaths";

interface RecentFilesProps {
  files: string[];
  stale: Set<string>;
  onOpen: (path: string) => void;
}

export function RecentFiles({ files, stale, onOpen }: RecentFilesProps) {
  return (
    <div className="flex flex-col gap-0.5">
      <SectionLabel className="px-2 pb-1.5">Recent</SectionLabel>
      {files.map((f) => {
        const isStale = stale.has(f);
        const name = fileName(f);
        if (isStale) {
          return (
            <div
              key={f}
              title={`File not found: ${f}`}
              className="flex h-8 items-center gap-2 rounded-md px-2.5 text-13 text-ghost line-through"
            >
              <FileCode size={14} strokeWidth={1.5} />
              <span className="truncate">{name}</span>
            </div>
          );
        }
        return (
          <button
            key={f}
            type="button"
            title={f}
            onClick={() => onOpen(f)}
            className="flex h-8 items-center gap-2 rounded-md px-2.5 text-left text-13 text-muted-foreground hover:bg-card hover:text-foreground"
          >
            <FileCode size={14} strokeWidth={1.5} />
            <span className="truncate">{name}</span>
          </button>
        );
      })}
    </div>
  );
}
