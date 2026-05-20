import { useState } from "react";
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors, type DragStartEvent } from "@dnd-kit/core";
import { GripVertical } from "lucide-react";
import { Sidebar } from "@/components/sidebar/Sidebar";
import { FormPanel } from "@/components/form/FormPanel";
import { RightPanel } from "@/components/layout/RightPanel";
import { PublishBar } from "@/components/publish/PublishBar";
import { BlockLibraryPanel } from "@/components/blocks/BlockLibraryPanel";
import { useBlockStore } from "@/stores/useBlockStore";

export function AppLayout() {
  const [isBlockLibraryOpen, setIsBlockLibraryOpen] = useState(false);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const blocks = useBlockStore((s) => s.blocks);
  const activeDragBlock = activeDragId ? (blocks.find((b) => b.id === activeDragId) ?? null) : null;

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
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      {/* Left sidebar: file picker + message type selector */}
      <aside className="w-72 min-w-60 max-w-xs border-r border-border flex flex-col shrink-0">
        <Sidebar />
      </aside>

      {/* Center: publish bar above, panel + form side by side below */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <PublishBar />
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragEnd}
        >
          <div className="flex-1 flex flex-row min-h-0">
            {isBlockLibraryOpen && (
              <BlockLibraryPanel />
            )}
            <FormPanel
              isBlockLibraryOpen={isBlockLibraryOpen}
              onToggleBlockLibrary={() => setIsBlockLibraryOpen((v) => !v)}
            />
          </div>
          <DragOverlay dropAnimation={null}>
            {activeDragBlock ? (
              <div className="flex items-center gap-2 px-3 py-2 bg-popover border border-border rounded-md shadow-xl text-sm cursor-grabbing max-w-48">
                <GripVertical size={14} className="text-muted-foreground shrink-0" />
                <span className="font-medium truncate">{activeDragBlock.name}</span>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </main>

      {/* Right: hex preview + message history tabs */}
      <aside className="w-80 min-w-64 border-l border-border flex flex-col shrink-0">
        <RightPanel />
      </aside>
    </div>
  );
}
