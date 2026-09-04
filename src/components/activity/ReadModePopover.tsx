import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SegmentedControl } from "@/components/common/SegmentedControl";
import { ResponseQueuePicker } from "@/components/response/ResponseQueuePicker";
import { SubscribePanel } from "@/components/response/SubscribePanel";
import { BrokerConfirmDialog } from "@/components/response/BrokerConfirmDialog";
import { useResponseStore } from "@/stores/useResponseStore";
import { useConnectionStore } from "@/stores/useConnectionStore";
import type { FeedMode } from "@/lib/types";
import { ReadModeButton } from "./ReadModeButton";
import { useQueueRead } from "./useQueueRead";

interface ReadModePopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: FeedMode;
  onModeChange: (mode: FeedMode) => void;
}

const MODE_ITEMS = [
  {
    value: "tap" as const,
    label: "Tap",
    title: "Copy of live traffic through a private queue; the original queue is untouched",
  },
  {
    value: "subscribe" as const,
    label: "Subscribe",
    title: "Competing consumer: what Tap receives is removed from the queue",
  },
  { value: "peek" as const, label: "Peek", title: "Read a batch and hand it back to the queue" },
  { value: "drain" as const, label: "Consume", title: "Read a batch and remove it from the queue" },
];

export function ReadModePopover({ open, onOpenChange, mode, onModeChange }: ReadModePopoverProps) {
  const selectedQueue = useResponseStore((s) => s.selectedQueue);
  const selectedDecodeTypes = useResponseStore((s) => s.selectedDecodeTypes);
  const subscribeStatus = useResponseStore((s) => s.subscribeStatus);
  const activeProfileName = useConnectionStore((s) => s.activeProfileName);

  const read = useQueueRead(mode);

  // Mode is locked while a live session runs (D-06) — switching would orphan the consumer.
  const isModeLocked = subscribeStatus === "Running" || subscribeStatus === "Stopping";
  const isLive = mode === "tap" || mode === "subscribe";

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <ReadModeButton mode={mode} status={subscribeStatus} queue={selectedQueue} />
      </PopoverTrigger>
      {/* forceMount: SubscribePanel stops its consumer when it unmounts, so the
          body has to survive closing — otherwise a running tap would end the
          moment the popover closes and "Tapping {queue}" could never show. */}
      <PopoverContent
        forceMount
        align="end"
        className="flex w-[360px] flex-col gap-3 p-3 data-[state=closed]:hidden"
      >
        <SegmentedControl
          aria-label="Read mode"
          stretch
          size="sm"
          value={mode}
          onChange={onModeChange}
          disabled={isModeLocked}
          items={MODE_ITEMS}
        />

        <ResponseQueuePicker onDrain={read.read} mode={mode} panelOpen={open} />

        {isLive && (
          <SubscribePanel
            selectedQueue={selectedQueue}
            decodeTypes={selectedDecodeTypes}
            profileName={activeProfileName ?? ""}
            mode={mode === "tap" ? "tap" : "competing"}
          />
        )}

        <BrokerConfirmDialog
          request={read.pending}
          onConfirm={read.confirm}
          onCancel={read.cancel}
        />
      </PopoverContent>
    </Popover>
  );
}
