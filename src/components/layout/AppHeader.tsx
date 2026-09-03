import { Send, ListChecks, Library } from "lucide-react";
import { SegmentedControl } from "@/components/common/SegmentedControl";
import { IconButton } from "@/components/common/IconButton";
import { ConnectionPill } from "@/components/connection/ConnectionPill";
import { ShortcutsPopover } from "@/components/layout/ShortcutsPopover";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import type { WorkbenchView, SheetState } from "@/lib/workbench";

interface AppHeaderProps {
  view: WorkbenchView;
  onViewChange: (v: WorkbenchView) => void;
  blocksOpen: boolean;
  onToggleBlocks: () => void;
  blocksDisabled?: boolean;
  onOpenSheet: (s: Exclude<SheetState, null>) => void;
}

export function AppHeader({
  view,
  onViewChange,
  blocksOpen,
  onToggleBlocks,
  blocksDisabled,
  onOpenSheet,
}: AppHeaderProps) {
  return (
    <header className="flex h-[52px] shrink-0 items-center gap-4 border-b border-border px-5">
      <div className="flex items-center gap-2.5">
        <img src="/tap-mark.svg" alt="" className="size-6" />
        <span className="text-15 font-semibold tracking-[-.01em]">Tap</span>
      </div>
      <SegmentedControl
        aria-label="View"
        className="ml-2"
        size="md"
        value={view}
        onChange={onViewChange}
        items={[
          { value: "compose", label: "Compose", icon: <Send size={13} strokeWidth={1.5} /> },
          { value: "plans", label: "Plans", icon: <ListChecks size={13} strokeWidth={1.5} /> },
        ]}
      />
      <div className="flex-1" />
      <ConnectionPill onOpenSheet={onOpenSheet} />
      <div className="flex gap-0.5">
        <IconButton size={32} label="Blocks" active={blocksOpen} disabled={blocksDisabled} onClick={onToggleBlocks}>
          <Library size={17} strokeWidth={1.5} />
        </IconButton>
        <ShortcutsPopover />
        <ThemeToggle />
      </div>
    </header>
  );
}
