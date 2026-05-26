import { useCallback, useEffect, useRef, useState } from "react";
import { FormProvider, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { Check, ChevronsUpDown, Dices } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { fetchQueues, fetchExchanges } from "@/lib/ipc";
import { generateRandomValues } from "@/lib/randomizer";
import { buildDefaultValues } from "@/components/form/ProtoFormRenderer";
import { ScalarField } from "@/components/form/fields/ScalarField";
import { EnumField } from "@/components/form/fields/EnumField";
import { NestedMessageField } from "@/components/form/fields/NestedMessageField";
import { OneofField } from "@/components/form/fields/OneofField";
import { RepeatedField } from "@/components/form/fields/RepeatedField";
import { BytesField } from "@/components/form/fields/BytesField";
import { MapField } from "@/components/form/fields/MapField";
import { WellKnownTypeField } from "@/components/form/fields/WellKnownTypeField";
import { usePlanStore } from "@/stores/usePlanStore";
import { useProtoStore } from "@/stores/useProtoStore";
import { useConnectionStore } from "@/stores/useConnectionStore";
import { ProtoSchemaContext } from "@/components/form/ProtoSchemaContext";
import type {
  FieldSchema,
  MessageSchema,
  PlanStep,
  PublishTarget,
  ResponseMode,
} from "@/lib/types";

const MAX_DEPTH = 5;

// ── safeParseFieldValues ──────────────────────────────────────────────────────
// Never call JSON.parse directly on step.field_values — falls back to
// buildDefaultValues on any parse error or non-object result (T-21-07).
function safeParseFieldValues(
  fieldValues: string,
  schema: MessageSchema | null
): Record<string, unknown> {
  if (!schema) return {};
  try {
    const parsed = JSON.parse(fieldValues);
    if (typeof parsed === "object" && parsed !== null) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // corrupt JSON — fall back to schema defaults
  }
  return buildDefaultValues(schema);
}

// ── renderField (mirrors ProtoFormRenderer dispatch switch) ───────────────────
function renderField(
  field: FieldSchema,
  path: string,
  depth: number
): React.ReactNode {
  if (depth > MAX_DEPTH) {
    return (
      <div key={path} className="text-xs text-muted-foreground">
        (max depth reached)
      </div>
    );
  }

  // bytes fields bypass the switch (pre-dispatch, ProtoFormRenderer FROZEN pattern)
  if (field.kind.type === "scalar" && field.kind.scalar === "bytes") {
    return <BytesField key={path} field={field} path={path} />;
  }

  // map fields bypass the switch (pre-dispatch, ProtoFormRenderer FROZEN pattern)
  if (field.kind.type === "map") {
    return (
      <MapField
        key={path}
        field={field}
        path={path}
        depth={depth}
        renderValue={renderField}
      />
    );
  }

  switch (field.kind.type) {
    case "scalar":
      return <ScalarField key={path} field={field} path={path} />;

    case "message":
      return (
        <NestedMessageField
          key={path}
          field={field}
          path={path}
          depth={depth}
          renderChildField={renderField}
        />
      );

    case "enum":
      return <EnumField key={path} field={field} path={path} />;

    case "oneof":
      return (
        <OneofField
          key={path}
          field={field}
          path={path}
          depth={depth}
          renderBranchField={renderField}
        />
      );

    case "well_known":
      return <WellKnownTypeField key={path} field={field} path={path} />;

    default:
      return null;
  }
}

// ── LiveCombobox ──────────────────────────────────────────────────────────────
// Combobox with live server-side items and free-text input.
// Falls back to plain Input when items is empty (no management API or not yet loaded).
// Shows an error below when the typed value matches no available item.

interface LiveComboboxProps {
  value: string;
  onChange: (value: string) => void;
  /** Called with the committed value on item selection or input blur. */
  onCommit?: (value: string) => void;
  items: string[];
  placeholder?: string;
  id?: string;
}

function LiveCombobox({ value, onChange, onCommit, items, placeholder, id }: LiveComboboxProps) {
  const [open, setOpen] = useState(false);

  if (items.length === 0) {
    return (
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => onCommit?.(value)}
        placeholder={placeholder}
        className="text-sm"
      />
    );
  }

  const filtered = items.filter((i) => i.toLowerCase().includes(value.toLowerCase()));
  const noMatch = value.length > 0 && filtered.length === 0;

  return (
    <div className="flex flex-col gap-1">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full h-9 justify-between border-input bg-background font-normal text-sm"
          >
            <span className="truncate text-left flex-1">
              {value || <span className="text-muted-foreground">{placeholder}</span>}
            </span>
            <ChevronsUpDown className="ml-auto h-4 w-4 shrink-0 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="p-0 min-w-[12rem]">
          <Command>
            <CommandInput
              placeholder="Filter…"
              value={value}
              onValueChange={onChange}
            />
            <CommandList>
              <CommandEmpty>No results found.</CommandEmpty>
              <CommandGroup>
                {items.map((item) => (
                  <CommandItem
                    key={item}
                    value={item}
                    onSelect={() => {
                      onChange(item);
                      onCommit?.(item);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn("mr-2 h-4 w-4", value === item ? "opacity-100" : "opacity-0")}
                    />
                    {item}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {noMatch && (
        <p className="text-xs text-destructive">No results for &ldquo;{value}&rdquo;</p>
      )}
    </div>
  );
}

// ── TargetSection ─────────────────────────────────────────────────────────────

interface TargetSectionProps {
  step: PlanStep;
  planId: string;
  updateStep: (
    planId: string,
    stepId: string,
    partial: Partial<PlanStep>
  ) => Promise<void>;
}

function TargetSection({ step, planId, updateStep }: TargetSectionProps) {
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
    fetchQueues(activeProfileName).then(setQueues).catch(() => {});
    fetchExchanges(activeProfileName).then(setExchanges).catch(() => {});
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

interface ResponseModeSectionProps {
  step: PlanStep;
  planId: string;
  updateStep: (
    planId: string,
    stepId: string,
    partial: Partial<PlanStep>
  ) => Promise<void>;
}

function ResponseModeSection({
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
      return { mode: "no-wait", delay_ms: parseInt(delayMs, 10) || 200 };
    }
    const rm =
      currentMode === "correlation-id" ? "correlation-id" : "first-arrival";
    return {
      mode: rm,
      reply_queue: replyQueueOverride ?? replyQueue,
      timeout_ms: parseInt(timeoutMs, 10) || 10000,
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
                placeholder="reply-queue-name"
              />
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
                min="0"
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

// ── StepFieldEditor ───────────────────────────────────────────────────────────

interface StepFieldEditorProps {
  step: PlanStep | null;
  planId: string;
  disabled?: boolean;
}

export function StepFieldEditor({ step, planId, disabled = false }: StepFieldEditorProps) {
  const { updateStep } = usePlanStore();
  const openFiles = useProtoStore((s) => s.openFiles);

  // Empty state: no step selected (D-05)
  if (!step) {
    return (
      <div className="flex flex-1 items-center justify-center p-6 text-center">
        <p className="text-sm text-muted-foreground">
          Select a step to edit it.
        </p>
      </div>
    );
  }

  // Proto resolution (four states — RESEARCH Pattern 5)
  const matchedFile = openFiles.find((f) => f.filePath === step.proto_path);
  const schema = matchedFile?.schema ?? null;
  // message_map lives on ProtoSchema — MessageSchema is the value type
  const message = schema?.message_map[step.message_type] ?? null;

  return (
    <StepFieldEditorInner
      key={step.id}
      step={step}
      planId={planId}
      updateStep={updateStep}
      schema={schema}
      message={message}
      matchedFile={matchedFile !== undefined}
      openFiles={openFiles}
      disabled={disabled}
    />
  );
}

// ── StepFieldEditorInner ──────────────────────────────────────────────────────
// Separated so hooks can run unconditionally (React rules of hooks — hooks
// cannot be called after an early return, so we pull the hook-heavy body
// into a child that always renders once step is non-null).

interface OpenFileEntry {
  filePath: string;
  schema: { message_map: Record<string, MessageSchema> };
}

interface StepFieldEditorInnerProps {
  step: PlanStep;
  planId: string;
  updateStep: (
    planId: string,
    stepId: string,
    partial: Partial<PlanStep>
  ) => Promise<void>;
  schema: { message_map: Record<string, MessageSchema> } | null;
  message: MessageSchema | null;
  matchedFile: boolean;
  openFiles: OpenFileEntry[];
  disabled?: boolean;
}

function StepFieldEditorInner({
  step,
  planId,
  updateStep,
  schema,
  message,
  matchedFile,
  openFiles,
  disabled = false,
}: StepFieldEditorInnerProps) {
  // Isolated react-hook-form instance (D-07) — NOT shared with useProtoStore
  const methods = useForm({
    defaultValues: safeParseFieldValues(step.field_values, message),
  });

  // Reset when step.id changes OR when message becomes available for the first time.
  // NEVER include step.field_values in deps — would cause echo loop:
  // auto-save writes → field_values changes → reset → auto-save → …
  const prevStepIdRef = useRef(step.id);
  const messagePrevNullRef = useRef(message === null);
  useEffect(() => {
    const stepChanged = prevStepIdRef.current !== step.id;
    const messageFirstLoaded = messagePrevNullRef.current && message !== null;
    messagePrevNullRef.current = message === null;
    if (stepChanged || messageFirstLoaded) {
      prevStepIdRef.current = step.id;
      methods.reset(safeParseFieldValues(step.field_values, message));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step.id, message]); // Deliberately omit step.field_values from deps

  // Debounced auto-save with stale-step guard (T-21-09)
  const watchedValues = useWatch({ control: methods.control });
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentStepIdRef = useRef(step.id);
  currentStepIdRef.current = step.id; // update on every render

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    // Don't persist when schema isn't loaded — writing {} would wipe real field values.
    if (!message) return;
    const capturedStepId = step.id;
    debounceRef.current = setTimeout(() => {
      if (currentStepIdRef.current === capturedStepId) {
        // stale-step guard: prevents pending debounce from writing to a switched-away step
        const json = JSON.stringify(watchedValues);
        updateStep(planId, capturedStepId, { field_values: json }).catch(() =>
          toast.error("Failed to save step. Changes may be lost.")
        );
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedValues, message]); // message added: re-evaluate when schema loads

  const handleRandomize = useCallback(() => {
    if (!schema || !message) return;
    // Preserve fields the user has edited in this session; randomize the rest.
    // Mirrors FormPanel's randomize semantics (FormPanel.tsx:182).
    const dirtyFields = methods.formState.dirtyFields as Record<string, boolean>;
    const randomValues = generateRandomValues(message, schema.message_map, dirtyFields);
    // reset() pushes the new values through useWatch, which trips the debounced
    // auto-save effect above and persists field_values for this step only.
    methods.reset(randomValues);
  }, [schema, message, methods]);

  return (
    <ProtoSchemaContext.Provider value={schema?.message_map ?? null}>
    <ScrollArea className="flex-1 min-h-0">
      {/* fieldset[disabled] cascades disabled state to all descendant form controls
          without prop drilling into deeply nested field components (D-09) */}
      <fieldset disabled={disabled} className="contents">
      <FormProvider {...methods}>
        <form onSubmit={(e) => e.preventDefault()}>
          {/* Section 1: Proto file + message type */}
          <div className="px-4 py-3 border-b border-border">
            <h3 className="text-sm font-semibold mb-3">Proto file</h3>
            <div className="flex flex-col gap-2">
              <Label className="text-xs text-muted-foreground">File</Label>
              <Select
                value={step.proto_path}
                onValueChange={(path) => {
                  // Only reset message_type when the file actually changes.
                  // Radix UI fires onValueChange even when the user clicks the
                  // already-selected item, which would otherwise wipe message_type.
                  const changes: Partial<PlanStep> = { proto_path: path };
                  if (path !== step.proto_path) changes.message_type = "";
                  updateStep(planId, step.id, changes).catch(console.error);
                }}
              >
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="Select a .proto file" />
                </SelectTrigger>
                <SelectContent>
                  {step.proto_path && !openFiles.some((f) => f.filePath === step.proto_path) && (
                    <SelectItem value={step.proto_path}>
                      {step.proto_path.split("/").pop() ?? step.proto_path} (not open)
                    </SelectItem>
                  )}
                  {openFiles.map((f) => (
                    <SelectItem key={f.filePath} value={f.filePath}>
                      {f.filePath.split("/").pop() ?? f.filePath}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Message type read-only display when file is saved but schema not yet loaded */}
              {step.proto_path && !schema && step.message_type && (
                <p className="text-xs text-muted-foreground">
                  Message type:{" "}
                  <span className="font-mono">
                    {step.message_type.split(".").pop() ?? step.message_type}
                  </span>
                </p>
              )}

              {/* Message type selector — only shown when file is selected and open */}
              {step.proto_path && schema && (
                <>
                  <Label className="text-xs text-muted-foreground">
                    Message type
                  </Label>
                  <Select
                    value={step.message_type}
                    onValueChange={(type) => {
                      if (type !== step.message_type) {
                        updateStep(planId, step.id, {
                          message_type: type,
                        }).catch(console.error);
                      }
                    }}
                  >
                    <SelectTrigger className="text-sm">
                      <SelectValue placeholder="Select a message type" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.keys(schema.message_map).map((typeName) => (
                        <SelectItem key={typeName} value={typeName}>
                          {typeName.split(".").pop() ?? typeName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </>
              )}

              {/* Proto not open state */}
              {step.proto_path && !matchedFile && (
                <p className="text-xs text-muted-foreground">
                  Open{" "}
                  {step.proto_path.split("/").pop() ?? step.proto_path} in the
                  file picker, then retry.
                </p>
              )}
            </div>
          </div>

          {/* Section 2: Fields */}
          <div className="px-4 py-3 border-b border-border">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">Fields</h3>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Randomize fields"
                title="Fill empty fields with random values"
                onClick={handleRandomize}
                disabled={disabled || !message}
              >
                <Dices size={16} />
              </Button>
            </div>
            {!message ? (
              <p className="text-xs text-muted-foreground">
                No message type selected.
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {message.fields.map((field) => {
                  const path = field.name;
                  // Repeated fields dispatch to RepeatedField regardless of inner kind
                  // (mirrors ProtoFormRenderer lines 260-277 — must precede renderField)
                  if (field.repeated) {
                    return (
                      <RepeatedField
                        key={path}
                        field={field}
                        path={path}
                        depth={0}
                        renderItem={renderField}
                      />
                    );
                  }
                  return renderField(field, path, 0);
                })}
              </div>
            )}
          </div>

          {/* Sections 3 & 4: Target and Response mode (outside form watch scope) */}
        </form>
      </FormProvider>
      <TargetSection step={step} planId={planId} updateStep={updateStep} />
      <ResponseModeSection
        step={step}
        planId={planId}
        updateStep={updateStep}
      />
      </fieldset>
    </ScrollArea>
    </ProtoSchemaContext.Provider>
  );
}
