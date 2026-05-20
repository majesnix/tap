import { useState } from "react";
import { DndContext, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { Sidebar } from "@/components/sidebar/Sidebar";
import { FormPanel } from "@/components/form/FormPanel";
import { RightPanel } from "@/components/layout/RightPanel";
import { PublishBar } from "@/components/publish/PublishBar";
import { BlockLibraryPanel } from "@/components/blocks/BlockLibraryPanel";

export function AppLayout() {
  const [isBlockLibraryOpen, setIsBlockLibraryOpen] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      {/* Left sidebar: file picker + message type selector */}
      <aside className="w-72 min-w-60 max-w-xs border-r border-border flex flex-col shrink-0">
        <Sidebar />
      </aside>

      {/* Center: publish bar above, panel + form side by side below */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <PublishBar />
        <DndContext sensors={sensors}>
          <div className="flex-1 flex flex-row min-h-0">
            {isBlockLibraryOpen && (
              <BlockLibraryPanel />
            )}
            <FormPanel
              isBlockLibraryOpen={isBlockLibraryOpen}
              onToggleBlockLibrary={() => setIsBlockLibraryOpen((v) => !v)}
            />
          </div>
        </DndContext>
      </main>

      {/* Right: hex preview + message history tabs */}
      <aside className="w-80 min-w-64 border-l border-border flex flex-col shrink-0">
        <RightPanel />
      </aside>
    </div>
  );
}
