import { useState, useEffect, useRef } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HexPreviewPanel } from "@/components/preview/HexPreviewPanel";
import { MessageHistoryPanel } from "@/components/history/MessageHistoryPanel";
import { useProtoStore } from "@/stores/useProtoStore";

export function RightPanel() {
  // CRITICAL (Pitfall 6): activeTab MUST be local state, NOT in the global store.
  const [activeTab, setActiveTab] = useState<"hex" | "history">("hex");

  const lastSendAt = useProtoStore((s) => s.lastSendAt);
  const pendingReplayValues = useProtoStore((s) => s.pendingReplayValues);

  const prevLastSendAt = useRef<number | null>(null);
  const prevPendingReplay = useRef<Record<string, unknown> | null>(null);

  // Auto-switch to History tab after a successful send
  useEffect(() => {
    if (lastSendAt !== null && lastSendAt !== prevLastSendAt.current) {
      prevLastSendAt.current = lastSendAt;
      setActiveTab("history");
    }
  }, [lastSendAt]);

  // Auto-switch to Hex tab when a replay is triggered (null → non-null transition only).
  // Edge-detection ensures clearing pendingReplayValues back to null does NOT
  // trigger a second switch back to hex.
  useEffect(() => {
    if (pendingReplayValues !== null && prevPendingReplay.current === null) {
      setActiveTab("hex");
    }
    prevPendingReplay.current = pendingReplayValues;
  }, [pendingReplayValues]);

  return (
    <Tabs
      value={activeTab}
      onValueChange={(v) => setActiveTab(v as "hex" | "history")}
      className="flex flex-col h-full"
    >
      <TabsList className="w-full rounded-none border-b border-border justify-start px-2">
        <TabsTrigger value="hex" className="text-xs">
          Hex
        </TabsTrigger>
        <TabsTrigger value="history" className="text-xs">
          History
        </TabsTrigger>
      </TabsList>
      <TabsContent value="hex" className="flex-1 overflow-hidden m-0 p-0">
        <HexPreviewPanel />
      </TabsContent>
      <TabsContent value="history" className="flex-1 overflow-hidden m-0 p-0">
        <MessageHistoryPanel />
      </TabsContent>
    </Tabs>
  );
}
