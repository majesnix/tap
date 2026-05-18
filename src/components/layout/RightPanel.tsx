import { useState, useEffect, useRef } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HexPreviewPanel } from "@/components/preview/HexPreviewPanel";
import { MessageHistoryPanel } from "@/components/history/MessageHistoryPanel";
import { useProtoStore } from "@/stores/useProtoStore";
import { useResponseStore } from "@/stores/useResponseStore";
import { ResponseTab } from "@/components/response/ResponseTab";

export function RightPanel() {
  // CRITICAL (Pitfall 6): activeTab MUST be local state, NOT in the global store.
  const [activeTab, setActiveTab] = useState<"hex" | "history" | "response">("hex");

  const lastSendAt = useProtoStore((s) => s.lastSendAt);
  const pendingReplayValues = useProtoStore((s) => s.pendingReplayValues);

  const prevLastSendAt = useRef<number | null>(null);
  const prevPendingReplay = useRef<Record<string, unknown> | null>(null);

  const lastReadAt = useResponseStore((s) => s.lastReadAt);
  const prevLastReadAt = useRef<number | null>(null);

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

  // Auto-switch to Response tab after a successful read (D-12)
  useEffect(() => {
    if (lastReadAt !== null && lastReadAt !== prevLastReadAt.current) {
      prevLastReadAt.current = lastReadAt;
      setActiveTab("response");
    }
  }, [lastReadAt]);

  return (
    <Tabs
      value={activeTab}
      onValueChange={(v) => setActiveTab(v as "hex" | "history" | "response")}
      className="flex flex-col h-full"
    >
      <TabsList className="w-full rounded-none border-b border-border justify-start px-2">
        <TabsTrigger value="hex" className="text-xs">
          Hex
        </TabsTrigger>
        <TabsTrigger value="history" className="text-xs">
          History
        </TabsTrigger>
        <TabsTrigger value="response" className="text-xs">
          Response
        </TabsTrigger>
      </TabsList>
      <TabsContent value="hex" className="flex-1 overflow-hidden m-0 p-0">
        <HexPreviewPanel />
      </TabsContent>
      <TabsContent value="history" className="flex-1 overflow-hidden m-0 p-0">
        <MessageHistoryPanel />
      </TabsContent>
      <TabsContent value="response" className="flex-1 overflow-hidden m-0 p-0">
        <ResponseTab />
      </TabsContent>
    </Tabs>
  );
}
