import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { SegmentedControl } from "@/components/common/SegmentedControl";
import { getExchanges, getQueues } from "@/lib/brokerCatalog";
import { useConnectionStore } from "@/stores/useConnectionStore";
import type { PlanStep, PublishTarget } from "@/lib/types";
import { LiveCombobox } from "./LiveCombobox";
import { EditorField } from "./EditorField";

interface TargetSectionProps {
  step: PlanStep;
  planId: string;
  updateStep: (
    planId: string,
    stepId: string,
    partial: Partial<PlanStep>
  ) => Promise<void>;
}

/** Target cell of the expanded step's second grid: Queue|Exchange + combobox. */
export function TargetSection({ step, planId, updateStep }: TargetSectionProps) {
  const [targetKind, setTargetKind] = useState<"queue" | "exchange">(step.target.kind);
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
      target: { kind: "exchange", exchange: exchangeName, routing_key: routingKey },
    }).catch(console.error);
  }

  return (
    <EditorField label="Target">
      <div className="flex items-center gap-2">
        <SegmentedControl
          aria-label="Target kind"
          variant="choice"
          size="sm"
          value={targetKind}
          onChange={handleKindChange}
          items={[
            { value: "queue", label: "Queue" },
            { value: "exchange", label: "Exchange" },
          ]}
        />
        <div className="min-w-0 flex-1">
          {targetKind === "queue" ? (
            <LiveCombobox
              id={`queue-name-${step.id}`}
              value={queueName}
              onChange={setQueueName}
              onCommit={(val) =>
                updateStep(planId, step.id, {
                  target: { kind: "queue", queue: val },
                }).catch(console.error)
              }
              items={queues}
              placeholder="queue-name"
            />
          ) : (
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
          )}
        </div>
      </div>
      {targetKind === "exchange" && (
        <Input
          id={`routing-key-${step.id}`}
          aria-label="Routing key"
          value={routingKey}
          onChange={(e) => setRoutingKey(e.target.value)}
          onBlur={handleRoutingKeyBlur}
          placeholder="routing.key"
          className="h-[34px] font-mono text-[12.5px]"
        />
      )}
    </EditorField>
  );
}
