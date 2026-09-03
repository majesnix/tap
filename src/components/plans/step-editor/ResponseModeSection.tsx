import { useState } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  REPLY_TIMEOUT_MAX_MS,
  STEP_DELAY_MAX_MS,
  clampReplyTimeout,
  clampStepDelay,
} from "@/lib/planTimings";
import { useConnectionStore } from "@/stores/useConnectionStore";
import type { PlanStep, ResponseMode } from "@/lib/types";
import { LiveCombobox } from "./LiveCombobox";
import { EditorField } from "./EditorField";

type ModeName = "no-wait" | "correlation-id" | "first-arrival";

const MODE_LABEL: Record<ModeName, string> = {
  "no-wait": "No wait",
  "correlation-id": "Correlation ID",
  "first-arrival": "First arrival",
};

interface ResponseModeArgs {
  step: PlanStep;
  planId: string;
  updateStep: (
    planId: string,
    stepId: string,
    partial: Partial<PlanStep>
  ) => Promise<void>;
}

export interface ResponseModeState {
  stepId: string;
  mode: ModeName;
  delayMs: string;
  timeoutMs: string;
  replyQueue: string;
  queues: string[];
  setDelayMs: (value: string) => void;
  setTimeoutMs: (value: string) => void;
  setReplyQueue: (value: string) => void;
  changeMode: (mode: string) => void;
  commit: () => void;
  commitReplyQueue: (value: string) => void;
}

/**
 * Owns the response-mode draft state shared by the mode Select (grid 1) and the
 * delay/timeout + reply-queue cells (grid 2), which live in different grids.
 */
export function useResponseMode({ step, planId, updateStep }: ResponseModeArgs): ResponseModeState {
  const [mode, setMode] = useState<ModeName>(step.response_mode.mode);
  const [delayMs, setDelayMs] = useState(
    step.response_mode.mode === "no-wait" ? String(step.response_mode.delay_ms) : "200"
  );
  const [replyQueue, setReplyQueue] = useState(
    step.response_mode.mode !== "no-wait" ? step.response_mode.reply_queue : ""
  );
  const [timeoutMs, setTimeoutMs] = useState(
    step.response_mode.mode !== "no-wait" ? String(step.response_mode.timeout_ms) : "10000"
  );
  const queues = useConnectionStore((s) => s.queues);

  function buildResponseMode(currentMode: string, replyQueueOverride?: string): ResponseMode {
    if (currentMode === "no-wait") {
      return { mode: "no-wait", delay_ms: clampStepDelay(delayMs) };
    }
    const rm = currentMode === "correlation-id" ? "correlation-id" : "first-arrival";
    return {
      mode: rm,
      reply_queue: replyQueueOverride ?? replyQueue,
      timeout_ms: clampReplyTimeout(timeoutMs),
    };
  }

  return {
    stepId: step.id,
    mode,
    delayMs,
    timeoutMs,
    replyQueue,
    queues,
    setDelayMs,
    setTimeoutMs,
    setReplyQueue,
    changeMode: (newMode: string) => {
      setMode(newMode as ModeName);
      updateStep(planId, step.id, { response_mode: buildResponseMode(newMode) }).catch(
        console.error
      );
    },
    commit: () => {
      updateStep(planId, step.id, { response_mode: buildResponseMode(mode) }).catch(
        console.error
      );
    },
    commitReplyQueue: (value: string) => {
      updateStep(planId, step.id, {
        response_mode: buildResponseMode(mode, value),
      }).catch(console.error);
    },
  };
}

/** Response mode cell of grid 1. */
export function ModeSelect({ state }: { state: ResponseModeState }) {
  return (
    <EditorField label="Response mode">
      <Select value={state.mode} onValueChange={state.changeMode}>
        <SelectTrigger size="sm" className="w-full text-[12.5px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(Object.keys(MODE_LABEL) as ModeName[]).map((m) => (
            <SelectItem key={m} value={m}>
              {MODE_LABEL[m]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </EditorField>
  );
}

/**
 * Delay/Timeout and Reply queue cells of grid 2 — a fragment so both land as
 * siblings in the parent grid.
 */
export function ModeParams({ state }: { state: ResponseModeState }) {
  const isNoWait = state.mode === "no-wait";
  const inputId = isNoWait ? `delay-${state.stepId}` : `timeout-${state.stepId}`;

  return (
    <>
      <EditorField label={isNoWait ? "Delay" : "Timeout"} htmlFor={inputId}>
        <div className="relative">
          <Input
            id={inputId}
            type="number"
            min={isNoWait ? "0" : "1"}
            max={isNoWait ? STEP_DELAY_MAX_MS : REPLY_TIMEOUT_MAX_MS}
            value={isNoWait ? state.delayMs : state.timeoutMs}
            onChange={(e) =>
              isNoWait ? state.setDelayMs(e.target.value) : state.setTimeoutMs(e.target.value)
            }
            onBlur={state.commit}
            className="h-[34px] pr-9 font-mono text-[12.5px]"
          />
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-11 text-ghost">
            ms
          </span>
        </div>
      </EditorField>

      <EditorField
        label="Reply queue"
        htmlFor={isNoWait ? undefined : `reply-queue-${state.stepId}`}
        hint="Leave empty and Tap creates a private reply queue for this step and passes it as reply-to (recommended). Naming a shared queue makes Tap requeue other services' messages while it waits."
      >
        {isNoWait ? (
          <div className="flex h-[34px] items-center rounded-md border border-border bg-background px-3 font-mono text-[12.5px] text-ghost">
            —
          </div>
        ) : (
          <LiveCombobox
            id={`reply-queue-${state.stepId}`}
            value={state.replyQueue}
            onChange={state.setReplyQueue}
            onCommit={state.commitReplyQueue}
            items={state.queues}
            placeholder="empty = private reply queue"
          />
        )}
      </EditorField>
    </>
  );
}
