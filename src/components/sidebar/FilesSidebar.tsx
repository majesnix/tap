import { Plus, RefreshCw, TriangleAlert } from "lucide-react";
import { useProtoStore } from "@/stores/useProtoStore";
import { usePlatformLabel } from "@/hooks/usePlatformLabel";
import { useProtoFiles } from "@/components/sidebar/useProtoFiles";
import { FileRow } from "@/components/sidebar/FileRow";
import { MessageList } from "@/components/sidebar/MessageList";
import { RecentFiles } from "@/components/sidebar/RecentFiles";
import { SidebarFooter } from "@/components/sidebar/SidebarFooter";
import { IncludePathDialog } from "@/components/include-paths/IncludePathDialog";
import { IconButton } from "@/components/common/IconButton";
import { SectionLabel } from "@/components/common/SectionLabel";
import { Kbd } from "@/components/common/Kbd";

export function FilesSidebar() {
  const { modSymbol } = usePlatformLabel();
  const schema = useProtoStore((s) => s.schema);
  const selectedMessageType = useProtoStore((s) => s.selectedMessageType);
  const setSelectedType = useProtoStore((s) => s.setSelectedType);

  const {
    openFiles,
    activeIndex,
    closedRecentFiles,
    stalePaths,
    parseError,
    isReloading,
    openFile,
    reload,
    openRecent,
    activate,
    close,
    includeDialog,
  } = useProtoFiles();

  return (
    <div className="flex h-full flex-col gap-[18px] overflow-hidden p-[16px_12px]">
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between px-2">
          <SectionLabel>Files</SectionLabel>
          <div className="flex gap-0.5">
            {openFiles.length > 0 && (
              <IconButton
                size={24}
                label="Reload proto schema"
                title={`Reload (${modSymbol}R)`}
                onClick={() => void reload()}
                disabled={isReloading}
              >
                <RefreshCw size={14} strokeWidth={1.5} className={isReloading ? "animate-spin" : ""} />
              </IconButton>
            )}
            <IconButton
              size={24}
              tone="violet"
              label="Open .proto"
              title={`Open .proto (${modSymbol}O)`}
              onClick={() => void openFile()}
            >
              <Plus size={15} strokeWidth={1.5} />
            </IconButton>
          </div>
        </div>
        {openFiles.length === 0 ? (
          <button
            type="button"
            onClick={() => void openFile()}
            className="flex h-10 items-center justify-center gap-2 rounded-lg border border-dashed border-border-strong text-13 font-medium text-violet-bright hover:bg-primary/8"
          >
            <Plus size={14} strokeWidth={1.5} />
            Open .proto
            <Kbd className="bg-transparent text-10 text-ghost">{modSymbol}O</Kbd>
          </button>
        ) : (
          <div className="flex max-h-56 flex-col gap-0.5 overflow-y-auto">
            {openFiles.map((f, i) => (
              <FileRow
                key={f.filePath}
                file={f}
                active={i === activeIndex}
                onActivate={() => activate(i)}
                onClose={() => close(i)}
              />
            ))}
          </div>
        )}
        {parseError && (
          <p role="alert" className="flex items-start gap-1.5 px-2 text-12 text-danger">
            <TriangleAlert size={13} strokeWidth={1.5} className="mt-0.5 shrink-0" />
            {parseError}
          </p>
        )}
      </div>
      {schema && <MessageList schema={schema} selected={selectedMessageType} onSelect={setSelectedType} />}
      {openFiles.length === 0 && closedRecentFiles.length > 0 && (
        <RecentFiles files={closedRecentFiles} stale={stalePaths} onOpen={(p) => void openRecent(p)} />
      )}
      <div className="flex-1" />
      <SidebarFooter />
      {includeDialog.open && (
        <IncludePathDialog
          open={includeDialog.open}
          initialPaths={includeDialog.initialPaths}
          onConfirm={includeDialog.onConfirm}
          onCancel={includeDialog.onCancel}
        />
      )}
    </div>
  );
}
