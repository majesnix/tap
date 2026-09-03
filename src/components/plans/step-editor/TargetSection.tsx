import { useEffect, useState } from "react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getExchanges, getQueues } from "@/lib/brokerCatalog";
import { useConnectionStore } from "@/stores/useConnectionStore";
import type { PlanStep, PublishTarget } from "@/lib/types";
import { LiveCombobox } from "./LiveCombobox";

interface TargetSectionProps {
  step: PlanStep;
  planId: string;
  updateStep: (
    planId: string,
    stepId: string,
    partial: Partial<PlanStep>
  ) => Promise<void>;
}

export function TargetSection({ step, planId, updateStep }: TargetSectionProps) {
  const [targetKind, setTargetKind] = useState<"queue" | "exchange">(
    step.target.kind
  );
  const [queueName, setQueueName] = useState(
    step.target.kind === "queue" ? step.target.queue : ""
  );
  const [exchangeName, setExchangeName] = useState(
    step.target.kind === "exchange" ? step.target.exchange : ""
  );
  const [routingKey, setRoutingKey] = useState(
    step.target.kind === "exchange" ? step.target.routing_key : ""
  );
  const queues = useConnectionStore((s) => s.queues);
  const exchanges = useConnectionStore((s) => s.exchanges);
  const activeProfileName = useConnectionStore((s) => s.activeProfileName);
  const setQueues = useConnectionStore((s) => s.setQueues);
  const setExchanges = useConnectionStore((s) => s.setExchanges);

  // Populate queues + exchanges from the management API whenever the active
  // profile changes — independent of whether PublishBar has been visited.
  useEffect(() => {
    if (!activeProfileName) return;
    getQueues(activeProfileName).then(setQueues).catch(() => {});
    getExchanges(activeProfileName).then(setExchanges).catch(() => {});
  }, [activeProfileName, setQueues, setExchanges]);

  const exchangeNames = exchanges.map((e) => e.name);

  function handleKindChange(kind: "queue" | "exchange") {
    setTargetKind(kind);
    const newTarget: PublishTarget =
      kind === "queue"
        ? { kind: "queue", queue: queueName }
        : { kind: "exchange", exchange: exchangeName, routing_key: routingKey };
    updateStep(planId, step.id, { target: newTarget }).catch(console.error);
  }

  function handleRoutingKeyBlur() {
    updateStep(planId, step.id, {
      target: {
        kind: "exchange",
        exchange: exchangeName,
        routing_key: routingKey,
      },
    }).catch(console.error);
  }

  return (
    <div className="px-4 py-3 border-b border-border">
      <h3 className="text-sm font-semibold mb-3">Target</h3>
      <div className="flex flex-col gap-3">
        {/* RadioGroup: Queue vs Exchange — mirror PublishBar sr-only pattern */}
        <RadioGroup
          value={targetKind}
          onValueChange={(v) => handleKindChange(v as "queue" | "exchange")}
          className="flex gap-1"
        >
          {(["queue", "exchange"] as const).map((kind) => (
            <div key={kind} className="flex items-center">
              <RadioGroupItem
                value={kind}
                id={`target-${kind}-${step.id}`}
                className="sr-only"
              />
              <label
                htmlFor={`target-${kind}-${step.id}`}
                className={`cursor-pointer rounded border px-3 py-1 text-sm font-semibold transition-colors ${
                  targetKind === kind
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-foreground border-input hover:bg-muted"
                }`}
              >
                {kind === "queue" ? "Queue" : "Exchange"}
              </label>
            </div>
          ))}
        </RadioGroup>

        {targetKind === "queue" ? (
          <div className="flex flex-col gap-1">
            <Label
              htmlFor={`queue-name-${step.id}`}
              className="text-xs text-muted-foreground"
            >
              Queue name
            </Label>
            <LiveCombobox
              id={`queue-name-${step.id}`}
              value={queueName}
              onChange={setQueueName}
              onCommit={(val) =>
                updateStep(planId, step.id, { target: { kind: "queue", queue: val } }).catch(console.error)
              }
              items={queues}
              placeholder="queue-name"
            />
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Exchange</Label>
              <LiveCombobox
                id={`exchange-${step.id}`}
                value={exchangeName}
                onChange={setExchangeName}
                onCommit={(val) =>
                  updateStep(planId, step.id, {
                    target: { kind: "exchange", exchange: val, routing_key: routingKey },
                  }).catch(console.error)
                }
                items={exchangeNames}
                placeholder="exchange-name"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label
                htmlFor={`routing-key-${step.id}`}
                className="text-xs text-muted-foreground"
              >
                Routing key
              </Label>
              <Input
                id={`routing-key-${step.id}`}
                value={routingKey}
                onChange={(e) => setRoutingKey(e.target.value)}
                onBlur={handleRoutingKeyBlur}
                placeholder="routing.key"
                className="text-sm"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── ResponseModeSection ───────────────────────────────────────────────────────
