import { useState, useRef, useMemo, type ReactNode, type MutableRefObject } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors, type DragStartEvent } from "@dnd-kit/core";
import { GripVertical } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { FilesSidebar } from "@/components/sidebar/FilesSidebar";
import { RequestCard } from "@/components/compose/RequestCard";
import { ActivityPanel } from "@/components/activity/ActivityPanel";
import { BlockLibraryPanel } from "@/components/blocks/BlockLibraryPanel";
import { useBlockStore } from "@/stores/useBlockStore";
import { useGlobalShortcuts } from "@/hooks/useGlobalShortcuts";

interface ComposeViewProps {
  header: ReactNode;
  blocksOpen: boolean;
  onToggleBlocks: () => void;
}

/**
 * The three signal refs Compose sub-components bind to for mod+1/2/3.
 */
export interface ComposeSignals {
  focusFilter: MutableRefObject<(() => void) | null>;
  toggleHex: MutableRefObject<(() => void) | null>;
  toggleReadMode: MutableRefObject<(() => void) | null>;
}

export function ComposeView({ header, blocksOpen, onToggleBlocks }: ComposeViewProps) {
  // Bound here — see useGlobalShortcuts.ts for why App mounts exactly one of
  // ComposeView/PlanView (never both), so this is safe.
  useGlobalShortcuts();

  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const blocks = useBlockStore((s) => s.blocks);
  const activeDragBlock = activeDragId ? (blocks.find((b) => b.id === activeDragId) ?? null) : null;

  const focusFilter = useRef<(() => void) | null>(null);
  const toggleHex = useRef<(() => void) | null>(null);
  const toggleReadMode = useRef<(() => void) | null>(null);
  // Stable identity across renders — sub-components receive this object as a
  // prop and must not re-run their registration effects on every ComposeView
  // re-render.
  const signals: ComposeSignals = useMemo(
    () => ({ focusFilter, toggleHex, toggleReadMode }),
    []
  );

  useHotkeys(
    "mod+1",
    (e) => {
      e.preventDefault();
      signals.focusFilter.current?.();
    },
    { enableOnFormTags: true }
  );
  useHotkeys(
    "mod+2",
    (e) => {
      e.preventDefault();
      signals.toggleHex.current?.();
    },
    { enableOnFormTags: true }
  );
  useHotkeys(
    "mod+3",
    (e) => {
      e.preventDefault();
      signals.toggleReadMode.current?.();
    },
    { enableOnFormTags: true }
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  function handleDragStart(event: DragStartEvent) {
    setActiveDragId(event.active.id as string);
  }

  function handleDragEnd() {
    setActiveDragId(null);
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragEnd}
    >
      <AppShell
        header={header}
        sidebar={<FilesSidebar />}
        drawer={
          blocksOpen && (
            <div className="flex w-[272px] shrink-0 flex-col p-[16px_0_16px_16px]">
              <BlockLibraryPanel />
            </div>
          )
        }
        main={
          <RequestCard signals={signals} blocksOpen={blocksOpen} onToggleBlocks={onToggleBlocks} />
        }
        aside={<ActivityPanel signals={signals} />}
      />
      {/* Handoff §3 drag overlay treatment (matches PlanView's step overlay). */}
      <DragOverlay dropAnimation={null}>
        {activeDragBlock ? (
          <div className="flex max-w-48 cursor-grabbing items-center gap-2 rounded-lg border border-border-strong bg-surface-3 p-[10px_14px] text-13 shadow-lg -rotate-2">
            <GripVertical size={14} strokeWidth={1.5} className="text-muted-foreground shrink-0" />
            <span className="font-medium truncate">{activeDragBlock.name}</span>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
