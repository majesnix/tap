import { useEffect, useRef, useState } from "react";
import { GripVertical, MoreVertical } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { IconButton } from "@/components/common/IconButton";
import { cn } from "@/lib/utils";
import type { PlanStep, PublishTarget, ResponseMode, StepStatus } from "@/lib/types";
import { usePlanExecutionStore } from "@/stores/usePlanExecutionStore";
import { StepStatusBadge } from "./StepStatusBadge";
import { StepEditor } from "./StepEditor";

// ── Formatting helpers ────────────────────────────────────────────────────────

function formatSeconds(ms: number): string {
  const seconds = ms / 1000;
  return `${Number.isInteger(seconds) ? seconds : seconds.toFixed(1)} s`;
}

/** "wait 200 ms" / "wait for correlation id · 10 s" — the meta row's "then" cell. */
export function describeResponseMode(mode: ResponseMode): string {
  if (mode.mode === "no-wait") return `wait ${mode.delay_ms} ms`;
  const label = mode.mode === "correlation-id" ? "correlation id" : "first arrival";
  return `wait for ${label} · ${formatSeconds(mode.timeout_ms)}`;
}

/** "orders" for a queue, "orders.x → created" for an exchange. */
export function describeTarget(target: PublishTarget): string {
  if (target.kind === "queue") return target.queue || "—";
  const exchange = target.exchange || "—";
  return target.routing_key ? `${exchange} → ${target.routing_key}` : exchange;
}

function formatDuration(ms: number): string {
  return ms < 1000 ? `${Math.round(ms)} ms` : formatSeconds(ms);
}

const CIRCLE_TONE: Record<StepStatus, string> = {
  pending: "bg-surface-2 text-muted-foreground",
  sending: "bg-primary text-white",
  "waiting-response": "bg-primary text-white",
  done: "bg-success/15 text-success",
  error: "bg-danger/15 text-danger",
};

// ── StepNameInput ─────────────────────────────────────────────────────────────
// Inline rename: autoFocus, select-all on mount, Escape cancels without the
// blur handler committing afterwards (cancellingRef guard).

function StepNameInput({
  initialValue,
  onCommit,
  onCancel,
}: {
  initialValue: string;
  onCommit: (value: string) => void;
  onCancel: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const cancellingRef = useRef(false);

  useEffect(() => {
    inputRef.current?.select();
  }, []);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      const trimmed = e.currentTarget.value.trim();
      if (trimmed) onCommit(trimmed);
      else onCancel();
    }
    if (e.key === "Escape") {
      cancellingRef.current = true; // set flag BEFORE blur fires
      onCancel();
      e.currentTarget.blur();
    }
  }

  function handleBlur(e: React.FocusEvent<HTMLInputElement>) {
    if (cancellingRef.current) {
      cancellingRef.current = false;
      return; // Escape already handled — don't commit
    }
    const trimmed = e.currentTarget.value.trim();
    if (trimmed) onCommit(trimmed);
    else onCancel();
  }

  return (
    <input
      ref={inputRef}
      type="text"
      autoFocus
      defaultValue={initialValue}
      aria-label="Step name"
      className="w-full border-b border-border bg-transparent text-14 font-semibold outline-none"
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
    />
  );
}

// ── StepCard ──────────────────────────────────────────────────────────────────

interface StepCardProps {
  step: PlanStep;
  index: number;
  planId: string;
  selected: boolean;
  status?: StepStatus;
  errorMsg?: string;
  hasReply: boolean;
  durationMs?: number;
  disabled: boolean;
  onSelect: () => void;
  onRename: (name: string) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

export function StepCard({
  step,
  index,
  planId,
  selected,
  status,
  errorMsg,
  hasReply,
  durationMs,
  disabled,
  onSelect,
  onRename,
  onDuplicate,
  onDelete,
}: StepCardProps) {
  const [renaming, setRenaming] = useState(false);
  const {
    attributes,
    listeners,
    setNodeRef: setSortableRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: step.id });

  // D-10: bring the running step into view whenever it becomes the active step.
  const cardRef = useRef<HTMLDivElement>(null);
  const isActive = usePlanExecutionStore((s) => s.activeStepId === step.id);
  useEffect(() => {
    if (isActive) {
      cardRef.current?.scrollIntoView?.({ behavior: "smooth", block: "nearest" });
    }
  }, [isActive]);

  function setRef(el: HTMLDivElement | null) {
    (cardRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
    setSortableRef(el);
  }

  const typeName = step.message_type.split(".").pop() || "—";

  return (
    <div
      ref={setRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "group relative flex flex-col rounded-lg border bg-card",
        selected ? "border-border-strong" : "border-border",
        isDragging && "opacity-50"
      )}
    >
      {renaming ? (
        <div className="grid grid-cols-[16px_28px_1fr_auto] items-center gap-3 p-[14px_16px]">
          <span />
          <span className="inline-flex size-7 items-center justify-center rounded-full bg-surface-2 font-mono text-12 font-semibold text-muted-foreground">
            {index + 1}
          </span>
          <StepNameInput
            initialValue={step.name}
            onCommit={(name) => {
              setRenaming(false);
              onRename(name);
            }}
            onCancel={() => setRenaming(false)}
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={onSelect}
          className="grid w-full grid-cols-[16px_28px_1fr_auto] items-start gap-3 p-[14px_16px] pr-10 text-left"
        >
          {/* Listeners on the grip ONLY — never the whole card (drag vs. select) */}
          <span
            {...attributes}
            {...listeners}
            onClick={(e) => e.stopPropagation()}
            className="mt-1.5 inline-flex cursor-grab touch-none text-ghost"
          >
            <GripVertical size={14} strokeWidth={1.5} />
          </span>
          <span
            data-testid="step-number"
            className={cn(
              "inline-flex size-7 items-center justify-center rounded-full font-mono text-12 font-semibold",
              CIRCLE_TONE[status ?? "pending"]
            )}
          >
            {index + 1}
          </span>
          <span className="flex min-w-0 flex-col gap-1.5">
            <span className="flex items-center gap-2.5">
              <span className="truncate text-14 font-semibold">{step.name}</span>
              {status !== undefined && (
                <StepStatusBadge status={status} errorMsg={errorMsg} />
              )}
            </span>
            <span
              data-testid="step-meta"
              className="flex flex-wrap gap-4 font-mono text-[11.5px] text-muted-foreground"
            >
              <span>
                <span className="text-ghost">type</span> {typeName}
              </span>
              <span>
                <span className="text-ghost">to</span> {describeTarget(step.target)}
              </span>
              <span>
                <span className="text-ghost">then</span>{" "}
                {describeResponseMode(step.response_mode)}
              </span>
            </span>
          </span>
          <span className="flex flex-col items-end gap-1">
            {durationMs !== undefined && (
              <span className="font-mono text-11 whitespace-nowrap text-ghost">
                {formatDuration(durationMs)}
              </span>
            )}
            {hasReply && (
              <span className="text-12 font-medium text-violet-bright">View reply</span>
            )}
          </span>
        </button>
      )}

      {/* Kebab — visible on hover, at the right of the header (handoff §5) */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <IconButton
            size={22}
            label="Step options"
            className="absolute top-2.5 right-2 opacity-0 group-hover:opacity-100 focus:opacity-100 aria-expanded:opacity-100"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreVertical size={14} strokeWidth={1.5} />
          </IconButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onSelect={() => {
              onSelect(); // renaming a step selects it first (old list behaviour)
              setRenaming(true);
            }}
          >
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onDuplicate()}>Duplicate</DropdownMenuItem>
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault(); // keep the menu open until the dialog state is set
              onDelete();
            }}
          >
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {selected && <StepEditor step={step} planId={planId} disabled={disabled} />}
    </div>
  );
}
