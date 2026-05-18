import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  useAmqpStore,
  type AmqpProperties,
  INITIAL_PROPERTIES,
  MAX_HEADERS,
} from "@/stores/useAmqpStore";

interface AmqpPropertiesSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AmqpPropertiesSheet({
  open,
  onOpenChange,
}: AmqpPropertiesSheetProps) {
  // LOCAL DRAFT STATE — does NOT mutate useAmqpStore until "Apply Properties" is clicked
  const [draft, setDraft] = useState<AmqpProperties>(
    () => useAmqpStore.getState().properties
  );

  // T-03-02-04: TTL validation error state
  const [ttlError, setTtlError] = useState<string | null>(null);

  // Add Header Popover local state
  const [headerPopoverOpen, setHeaderPopoverOpen] = useState(false);
  const [newHeaderKey, setNewHeaderKey] = useState("");
  const [newHeaderValue, setNewHeaderValue] = useState("");

  // Re-sync draft from store whenever sheet opens (shows current committed values)
  useEffect(() => {
    if (open) {
      setDraft(useAmqpStore.getState().properties);
      setTtlError(null);
    }
  }, [open]);

  const handleTtlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (!raw) {
      setDraft((d) => ({ ...d, ttl: null }));
      setTtlError(null);
      return;
    }
    const parsed = Number(raw);
    // T-03-02-04: Validate TTL >= 0 and is integer
    if (!Number.isInteger(parsed) || parsed < 0) {
      setTtlError("TTL must be a non-negative integer (ms)");
      // Keep draft.ttl as previous valid value (do not commit invalid)
      return;
    }
    setTtlError(null);
    setDraft((d) => ({ ...d, ttl: parsed }));
  };

  const handleApply = () => {
    const { setProperties, setHeaders } = useAmqpStore.getState();
    setProperties({
      contentType: draft.contentType,
      deliveryMode: draft.deliveryMode,
      ttl: draft.ttl,
      correlationId: draft.correlationId,
      replyTo: draft.replyTo,
    });
    setHeaders(draft.headers);
    onOpenChange(false);
  };

  const handleReset = () => {
    setDraft({ ...INITIAL_PROPERTIES, headers: [] });
    setTtlError(null);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-80">
        <SheetHeader>
          <SheetTitle>AMQP Properties</SheetTitle>
          <SheetDescription>
            Set per-message AMQP properties. Applied on next send.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4 px-4 py-2 flex-1 min-h-0 overflow-y-auto">
          {/* Content Type */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">Content Type</label>
            <Input
              value={draft.contentType ?? ""}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  contentType: e.target.value || null,
                }))
              }
              placeholder="application/octet-stream"
              className="h-8 text-sm"
            />
          </div>

          {/* Delivery Mode */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">Delivery Mode</label>
            <div className="flex items-center gap-2">
              <Switch
                checked={draft.deliveryMode === 2}
                onCheckedChange={(checked) =>
                  setDraft((d) => ({
                    ...d,
                    deliveryMode: (checked ? 2 : 1) as 1 | 2,
                  }))
                }
              />
              <span className="text-sm">Persistent</span>
            </div>
          </div>

          {/* TTL */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">TTL (ms)</label>
            <Input
              type="number"
              value={draft.ttl ?? ""}
              onChange={handleTtlChange}
              placeholder="e.g. 60000"
              className="h-8 text-sm"
              min={0}
            />
            {ttlError && (
              <span className="text-xs text-destructive">{ttlError}</span>
            )}
          </div>

          {/* Correlation ID */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">Correlation ID</label>
            <Input
              value={draft.correlationId ?? ""}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  correlationId: e.target.value || null,
                }))
              }
              placeholder="Optional correlation ID"
              className="h-8 text-sm"
            />
          </div>

          {/* Reply-To */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">Reply-To</label>
            <Input
              value={draft.replyTo ?? ""}
              onChange={(e) =>
                setDraft((d) => ({ ...d, replyTo: e.target.value || null }))
              }
              placeholder="Optional reply-to queue"
              className="h-8 text-sm"
            />
          </div>

          {/* Custom Headers */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">Custom Headers</label>
            <div className="flex flex-col gap-1">
              {/* Existing headers list */}
              {draft.headers.map((header, idx) => (
                <div key={idx} className="flex items-center gap-1">
                  <span className="text-xs flex-1 truncate">{header.key}</span>
                  <span className="text-xs flex-1 truncate text-muted-foreground">
                    {header.value}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 shrink-0"
                    onClick={() =>
                      setDraft((d) => ({
                        ...d,
                        headers: d.headers.filter((_, i) => i !== idx),
                      }))
                    }
                  >
                    ×
                  </Button>
                </div>
              ))}

              {/* Add Header Popover */}
              <Popover
                open={headerPopoverOpen}
                onOpenChange={setHeaderPopoverOpen}
              >
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="mt-1 text-xs">
                    Add Header
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-64 p-3"
                  side="bottom"
                  align="start"
                >
                  <div className="flex flex-col gap-2">
                    <Input
                      placeholder="Header key"
                      value={newHeaderKey}
                      onChange={(e) => setNewHeaderKey(e.target.value)}
                      className="h-7 text-xs"
                    />
                    <Input
                      placeholder="Header value"
                      value={newHeaderValue}
                      onChange={(e) => setNewHeaderValue(e.target.value)}
                      className="h-7 text-xs"
                    />
                    <Button
                      size="sm"
                      className="text-xs"
                      disabled={!newHeaderKey.trim()}
                      onClick={() => {
                        if (!newHeaderKey.trim()) return;
                        // CR-03: enforce MAX_HEADERS cap in local draft state
                        if (draft.headers.length >= MAX_HEADERS) {
                          toast.error("Maximum 20 custom headers reached");
                          return;
                        }
                        setDraft((d) => ({
                          ...d,
                          headers: [
                            ...d.headers,
                            {
                              key: newHeaderKey.trim(),
                              value: newHeaderValue.trim(),
                            },
                          ],
                        }));
                        setNewHeaderKey("");
                        setNewHeaderValue("");
                        setHeaderPopoverOpen(false);
                      }}
                    >
                      Add Header
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>

        <SheetFooter className="flex flex-row gap-2 justify-end border-t pt-4">
          <Button variant="outline" onClick={handleReset}>
            Reset to defaults
          </Button>
          <Button variant="default" onClick={handleApply}>
            Apply Properties
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
