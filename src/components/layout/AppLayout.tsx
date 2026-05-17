import { Sidebar } from "@/components/sidebar/Sidebar";
import { FormPanel } from "@/components/form/FormPanel";
import { HexPreviewPanel } from "@/components/preview/HexPreviewPanel";

export function AppLayout() {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      {/* Left sidebar: file picker + message type selector */}
      <aside className="w-72 min-w-60 max-w-xs border-r border-border flex flex-col shrink-0">
        <Sidebar />
      </aside>

      {/* Center: dynamic proto form */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <FormPanel />
      </main>

      {/* Right: hex preview */}
      <aside className="w-80 min-w-64 border-l border-border flex flex-col shrink-0">
        <HexPreviewPanel />
      </aside>
    </div>
  );
}
