import { useState } from "react";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { IconButton } from "@/components/common/IconButton";
import { SegmentedControl } from "@/components/common/SegmentedControl";
import {
  useAmqpStore,
  type AmqpProperties,
  INITIAL_PROPERTIES,
  MAX_HEADERS,
} from "@/stores/useAmqpStore";

interface PropertiesSectionProps {
  /** Called after Apply commits the draft, so the card can close the section. */
  onApplied: () => void;
}

const DELIVERY_ITEMS = [
  { value: "transient" as const, label: "Transient" },
  { value: "persistent" as const, label: "Persistent" },
];

const LABEL_CLASS = "text-12 text-muted-foreground";

/**
 * Per-message AMQP properties, edited inline under the destination strip.
 *
 * Everything is local until Apply: the store — and therefore the next send — only sees the
 * values the user committed.
 */
export function PropertiesSection({ onApplied }: PropertiesSectionProps) {
  // Local draft — the store is untouched until Apply.
  const [draft, setDraft] = useState<AmqpProperties>(() => useAmqpStore.getState().properties);
  const [ttlError, setTtlError] = useState<string | null>(null);

  const [headerPopoverOpen, setHeaderPopoverOpen] = useState(false);
  const [newHeaderKey, setNewHeaderKey] = useState("");
  const [newHeaderValue, setNewHeaderValue] = useState("");

  const handleTtlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (!raw) {
      setDraft((d) => ({ ...d, ttl: null }));
      setTtlError(null);
      return;
    }
    const parsed = Number(raw);
    if (!Number.isInteger(parsed) || parsed < 0) {
      setTtlError("TTL must be a non-negative integer (ms)");
      return; // keep the previous valid value
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
    onApplied();
  };

  const handleReset = () => {
    setDraft({ ...INITIAL_PROPERTIES, headers: [] });
    setTtlError(null);
  };

  const addHeader = () => {
    const key = newHeaderKey.trim();
    if (!key) return;
    if (draft.headers.length >= MAX_HEADERS) {
      toast.error("Maximum 20 custom headers reached");
      return;
    }
    setDraft((d) => ({
      ...d,
      headers: [...d.headers, { key, value: newHeaderValue.trim() }],
    }));
    setNewHeaderKey("");
    setNewHeaderValue("");
    setHeaderPopoverOpen(false);
  };

  return (
    <div className="flex flex-col gap-3 px-[18px] pb-4 pt-1">
      <div className="grid grid-cols-[2fr_1fr_1fr] gap-3">
        <label className="flex flex-col gap-1.5">
          <span className={LABEL_CLASS}>Content type</span>
          <Input
            className="h-9 text-[12.5px]"
            value={draft.contentType ?? ""}
            placeholder="application/octet-stream"
            onChange={(e) => setDraft((d) => ({ ...d, contentType: e.target.value || null }))}
          />
        </label>

        <div className="flex flex-col gap-1.5">
          <span className={LABEL_CLASS}>Delivery</span>
          <SegmentedControl
            aria-label="Delivery mode"
            variant="choice"
            stretch
            className="h-9"
            value={draft.deliveryMode === 2 ? "persistent" : "transient"}
            onChange={(v) => setDraft((d) => ({ ...d, deliveryMode: v === "persistent" ? 2 : 1 }))}
            items={DELIVERY_ITEMS}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex flex-col gap-1.5">
            <span className={LABEL_CLASS}>TTL</span>
            <div className="flex h-9 items-center gap-2 rounded-md border border-border bg-background pl-3 pr-2.5 focus-within:border-border-strong">
              <Input
                type="number"
                min={0}
                aria-label="TTL"
                placeholder="—"
                className="h-auto flex-1 border-0 bg-transparent p-0 text-[12.5px] shadow-none focus-visible:ring-0"
                value={draft.ttl ?? ""}
                onChange={handleTtlChange}
              />
              <span className="text-11 text-ghost">ms</span>
            </div>
          </div>
          {ttlError && <span className="text-12 text-danger">{ttlError}</span>}
        </div>
      </div>

      <div className="grid grid-cols-[1fr_1fr_2fr] gap-3">
        <label className="flex flex-col gap-1.5">
          <span className={LABEL_CLASS}>Correlation ID</span>
          <Input
            className="h-9 text-[12.5px]"
            value={draft.correlationId ?? ""}
            placeholder="Optional correlation ID"
            onChange={(e) => setDraft((d) => ({ ...d, correlationId: e.target.value || null }))}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className={LABEL_CLASS}>Reply-to</span>
          <Input
            className="h-9 text-[12.5px]"
            value={draft.replyTo ?? ""}
            placeholder="Optional reply-to queue"
            onChange={(e) => setDraft((d) => ({ ...d, replyTo: e.target.value || null }))}
          />
        </label>

        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between">
            <span className={LABEL_CLASS}>Headers</span>
            <span className="font-mono text-11 text-ghost">
              {draft.headers.length} / {MAX_HEADERS}
            </span>
          </div>
          <div className="flex min-h-9 flex-wrap items-center gap-1.5">
            {draft.headers.map((header, index) => (
              <span
                key={`${header.key}-${index}`}
                className="inline-flex h-7 items-center gap-1.5 rounded-full border border-border bg-background pl-2.5 pr-1.5 font-mono text-12"
              >
                {header.key}
                <span className="text-muted-foreground"> = {header.value}</span>
                <IconButton
                  size={22}
                  label={`Remove header ${header.key}`}
                  onClick={() =>
                    setDraft((d) => ({
                      ...d,
                      headers: d.headers.filter((_, i) => i !== index),
                    }))
                  }
                >
                  <X size={12} />
                </IconButton>
              </span>
            ))}

            <Popover open={headerPopoverOpen} onOpenChange={setHeaderPopoverOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="inline-flex h-7 items-center gap-1 rounded-full border border-dashed border-border-strong px-2.5 text-12 text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/35"
                >
                  <Plus size={12} />
                  header
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-3" side="bottom" align="start">
                <div className="flex flex-col gap-2">
                  <Input
                    className="h-7 text-12"
                    placeholder="Header key"
                    value={newHeaderKey}
                    onChange={(e) => setNewHeaderKey(e.target.value)}
                  />
                  <Input
                    className="h-7 text-12"
                    placeholder="Header value"
                    value={newHeaderValue}
                    onChange={(e) => setNewHeaderValue(e.target.value)}
                  />
                  <Button size="sm" disabled={!newHeaderKey.trim()} onClick={addHeader}>
                    Add header
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleReset}
          className="text-12 text-muted-foreground transition-colors hover:text-foreground"
        >
          Reset to defaults
        </button>
        <div className="flex-1" />
        <Button size="sm" onClick={handleApply}>
          Apply
        </Button>
      </div>
    </div>
  );
}
