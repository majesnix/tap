import { ArrowRight } from "lucide-react";
import { SectionLabel } from "@/components/common/SectionLabel";
import { SegmentedControl } from "@/components/common/SegmentedControl";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { CatalogStatus } from "@/components/compose/CatalogStatus";
import { PropertiesSummaryButton } from "@/components/compose/PropertiesSummaryButton";
import { RoutingKeyCombobox } from "@/components/compose/RoutingKeyCombobox";
import { routingKeyHint, type TargetMode } from "@/components/compose/destination";
import type { useDestination } from "@/components/compose/useDestination";

interface DestinationStripProps {
  destination: ReturnType<typeof useDestination>;
  propsOpen: boolean;
  onTogglePropsOpen: () => void;
}

const MODE_ITEMS = [
  { value: "queue" as TargetMode, label: "Queue" },
  { value: "exchange" as TargetMode, label: "Exchange" },
];

/** Where the message goes: queue or exchange, the routing key, and the AMQP properties. */
export function DestinationStrip({
  destination: d,
  propsOpen,
  onTogglePropsOpen,
}: DestinationStripProps) {
  const isQueueMode = d.mode === "queue";
  const value = isQueueMode ? d.selectedQueue : d.selectedExchange;
  const setValue = isQueueMode ? d.setSelectedQueue : d.setSelectedExchange;
  const hint = d.mode === "exchange" ? routingKeyHint(d.selectedExchangeType) : null;

  const meta = isQueueMode
    ? d.queueDepth !== null
      ? `${d.queueDepth} msgs`
      : null
    : d.selectedExchangeType || null;

  return (
    <div className="flex shrink-0 flex-col border-b border-border bg-foreground/[.02]">
      <div className="flex flex-wrap items-center gap-2.5 px-[18px] py-3">
        <SectionLabel>To</SectionLabel>

        <SegmentedControl
          aria-label="Target kind"
          variant="choice"
          value={d.mode}
          onChange={d.setMode}
          items={MODE_ITEMS}
          className="[&_button]:text-12 [&_button]:font-semibold"
        />

        {d.managementStatus === "live" ? (
          <SearchableSelect
            className="w-[280px]"
            mono
            meta={meta}
            value={value}
            onChange={setValue}
            placeholder={isQueueMode ? "Select queue…" : "Select exchange…"}
            searchPlaceholder={isQueueMode ? "Filter queues…" : "Filter exchanges…"}
            emptyText={isQueueMode ? "No queues found." : "No exchanges found."}
            items={
              isQueueMode
                ? d.queues.map((name) => ({ value: name }))
                : d.exchanges.map((ex) => ({
                    value: ex.name,
                    badge: <span className="font-mono text-11 text-ghost">{ex.exchange_type}</span>,
                  }))
            }
          />
        ) : (
          <Input
            className="w-[280px] font-mono text-[12.5px]"
            placeholder={isQueueMode ? "Queue name" : "Exchange name"}
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        )}

        {d.mode === "exchange" && (
          <>
            <ArrowRight size={14} className="text-ghost" />
            {d.useCombobox ? (
              <RoutingKeyCombobox
                value={d.routingKey}
                onChange={d.setRoutingKey}
                bindingKeys={d.bindingKeys}
                isLoading={d.isLoadingBindings}
              />
            ) : (
              <div className="flex h-9 w-[220px] items-center gap-2 rounded-md border border-border bg-background pl-3 pr-2 focus-within:border-border-strong">
                <span className="text-11 text-ghost">key</span>
                <Input
                  className="h-auto flex-1 border-0 bg-transparent p-0 font-mono text-[12.5px] shadow-none focus-visible:ring-0"
                  placeholder="Routing key"
                  value={d.routingKey}
                  onChange={(e) => d.setRoutingKey(e.target.value)}
                />
              </div>
            )}
          </>
        )}

        <CatalogStatus
          managementStatus={d.managementStatus}
          managementAuthError={d.managementAuthError}
        />

        <div className="flex-1" />

        <PropertiesSummaryButton open={propsOpen} onToggle={onTogglePropsOpen} />
      </div>

      {hint && <p className="px-[18px] pb-2.5 text-12 text-ghost">{hint}</p>}
    </div>
  );
}
