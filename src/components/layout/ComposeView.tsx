import { useState, useRef, useMemo, type ReactNode, type MutableRefObject } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors, type DragStartEvent } from "@dnd-kit/core";
import { GripVertical } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { FilesSidebar } from "@/components/sidebar/FilesSidebar";
import { FormPanel } from "@/components/form/FormPanel";
import { RightPanel, type RightPanelTab } from "@/components/layout/RightPanel";
import { PublishBar } from "@/components/publish/PublishBar";
import { BlockLibraryPanel } from "@/components/blocks/BlockLibraryPanel";
import { useBlockStore } from "@/stores/useBlockStore";
import { useGlobalShortcuts } from "@/hooks/useGlobalShortcuts";

interface ComposeViewProps {
  header: ReactNode;
  blocksOpen: boolean;
  onToggleBlocks: () => void;
}

/**
 * The three signal refs later Compose sub-components (Task 8) will bind to for
 * mod+1/2/3. For this task they exist alongside the legacy RightPanel tab
 * switching (setActiveTabRef) so the existing shortcut tests keep passing.
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

  const setActiveTabRef = useRef<((tab: RightPanelTab) => void) | null>(null);

  const focusFilter = useRef<(() => void) | null>(null);
  const toggleHex = useRef<(() => void) | null>(null);
  const toggleReadMode = useRef<(() => void) | null>(null);
  // Stable identity across renders — later Compose sub-components (Task 8)
  // will receive this object as a prop and should not re-run effects that
  // depend on it every time ComposeView re-renders.
  const signals: ComposeSignals = useMemo(
    () => ({ focusFilter, toggleHex, toggleReadMode }),
    []
  );

  useHotkeys(
    "mod+1",
    (e) => {
      e.preventDefault();
      setActiveTabRef.current?.("hex");
      signals.focusFilter.current?.();
    },
    { enableOnFormTags: true }
  );
  useHotkeys(
    "mod+2",
    (e) => {
      e.preventDefault();
      setActiveTabRef.current?.("history");
      signals.toggleHex.current?.();
    },
    { enableOnFormTags: true }
  );
  useHotkeys(
    "mod+3",
    (e) => {
      e.preventDefault();
      setActiveTabRef.current?.("response");
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
          <>
            <PublishBar />
            <FormPanel isBlockLibraryOpen={blocksOpen} onToggleBlockLibrary={onToggleBlocks} />
          </>
        }
        aside={<RightPanel setActiveTabRef={setActiveTabRef} />}
      />
      <DragOverlay dropAnimation={null}>
        {activeDragBlock ? (
          <div className="flex items-center gap-2 px-3 py-2 bg-popover border border-border rounded-md shadow-xl text-sm cursor-grabbing max-w-48">
            <GripVertical size={14} className="text-muted-foreground shrink-0" />
            <span className="font-medium truncate">{activeDragBlock.name}</span>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
