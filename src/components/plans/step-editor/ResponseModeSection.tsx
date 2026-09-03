import { useState } from "react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  REPLY_TIMEOUT_MAX_MS,
  STEP_DELAY_MAX_MS,
  clampReplyTimeout,
  clampStepDelay,
} from "@/lib/planTimings";
import { useConnectionStore } from "@/stores/useConnectionStore";
import type { PlanStep, ResponseMode } from "@/lib/types";
import { LiveCombobox } from "./LiveCombobox";

interface ResponseModeSectionProps {
  step: PlanStep;
  planId: string;
  updateStep: (
    planId: string,
    stepId: string,
    partial: Partial<PlanStep>
  ) => Promise<void>;
}

export function ResponseModeSection({
  step,
  planId,
  updateStep,
}: ResponseModeSectionProps) {
  const [mode, setMode] = useState<
    "no-wait" | "correlation-id" | "first-arrival"
  >(step.response_mode.mode);
  const [delayMs, setDelayMs] = useState(
    step.response_mode.mode === "no-wait"
      ? String(step.response_mode.delay_ms)
      : "200"
  );
  const [replyQueue, setReplyQueue] = useState(
    step.response_mode.mode !== "no-wait"
      ? step.response_mode.reply_queue
      : ""
  );
  const [timeoutMs, setTimeoutMs] = useState(
    step.response_mode.mode !== "no-wait"
      ? String(step.response_mode.timeout_ms)
      : "10000"
  );
  const queues = useConnectionStore((s) => s.queues);

  function buildResponseMode(currentMode: string, replyQueueOverride?: string): ResponseMode {
    if (currentMode === "no-wait") {
      return { mode: "no-wait", delay_ms: clampStepDelay(delayMs) };
    }
    const rm =
      currentMode === "correlation-id" ? "correlation-id" : "first-arrival";
    return {
      mode: rm,
      reply_queue: replyQueueOverride ?? replyQueue,
      timeout_ms: clampReplyTimeout(timeoutMs),
    };
  }

  function handleModeChange(newMode: string) {
    setMode(newMode as "no-wait" | "correlation-id" | "first-arrival");
    updateStep(planId, step.id, {
      response_mode: buildResponseMode(newMode),
    }).catch(console.error);
  }

  function handleInputBlur() {
    updateStep(planId, step.id, {
      response_mode: buildResponseMode(mode),
    }).catch(console.error);
  }

  const modeLabelMap: Record<string, string> = {
    "no-wait": "No wait",
    "correlation-id": "Correlation ID",
    "first-arrival": "First arrival",
  };

  return (
    <div className="px-4 py-3 border-b border-border">
      <h3 className="text-sm font-semibold mb-3">Response mode</h3>
      <div className="flex flex-col gap-3">
        <RadioGroup
          value={mode}
          onValueChange={handleModeChange}
          className="flex gap-1 flex-wrap"
        >
          {(["no-wait", "correlation-id", "first-arrival"] as const).map(
            (m) => (
              <div key={m} className="flex items-center">
                <RadioGroupItem
                  value={m}
                  id={`mode-${m}-${step.id}`}
                  className="sr-only"
                />
                <label
                  htmlFor={`mode-${m}-${step.id}`}
                  className={`cursor-pointer rounded border px-3 py-1 text-sm font-semibold transition-colors ${
                    mode === m
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-foreground border-input hover:bg-muted"
                  }`}
                >
                  {modeLabelMap[m]}
                </label>
              </div>
            )
          )}
        </RadioGroup>

        {mode === "no-wait" && (
          <div className="flex flex-col gap-1">
            <Label
              htmlFor={`delay-${step.id}`}
              className="text-xs text-muted-foreground"
            >
              Delay (ms)
            </Label>
            <Input
              id={`delay-${step.id}`}
              type="number"
              min="0"
              max={STEP_DELAY_MAX_MS}
              value={delayMs}
              onChange={(e) => setDelayMs(e.target.value)}
              onBlur={handleInputBlur}
              className="text-sm w-32"
            />
          </div>
        )}

        {(mode === "correlation-id" || mode === "first-arrival") && (
          <div className="flex flex-col gap-2">
            <div className="flex flex-col gap-1">
              <Label
                htmlFor={`reply-queue-${step.id}`}
                className="text-xs text-muted-foreground"
              >
                Reply queue
              </Label>
              <LiveCombobox
                id={`reply-queue-${step.id}`}
                value={replyQueue}
                onChange={setReplyQueue}
                onCommit={(val) =>
                  updateStep(planId, step.id, {
                    response_mode: buildResponseMode(mode, val),
                  }).catch(console.error)
                }
                items={queues}
                placeholder="empty = private reply queue"
              />
              <p className="text-xs text-muted-foreground">
                Leave empty and Tap creates a private reply queue for this step and passes it as
                reply-to (recommended). Naming a shared queue makes Tap requeue other services&apos;
                messages while it waits.
              </p>
            </div>
            <div className="flex flex-col gap-1">
              <Label
                htmlFor={`timeout-${step.id}`}
                className="text-xs text-muted-foreground"
              >
                Timeout (ms)
              </Label>
              <Input
                id={`timeout-${step.id}`}
                type="number"
                min="1"
                max={REPLY_TIMEOUT_MAX_MS}
                value={timeoutMs}
                onChange={(e) => setTimeoutMs(e.target.value)}
                onBlur={handleInputBlur}
                className="text-sm w-32"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
