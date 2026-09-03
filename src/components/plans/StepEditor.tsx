import { useCallback, useEffect, useRef, useState } from "react";
import { FormProvider, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { Dices, Pencil } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { IconButton } from "@/components/common/IconButton";
import { RepeatedField } from "@/components/form/fields/RepeatedField";
import { generateRandomValues } from "@/lib/randomizer";
import { usePlanStore } from "@/stores/usePlanStore";
import { useProtoStore } from "@/stores/useProtoStore";
import { ProtoSchemaContext } from "@/components/form/ProtoSchemaContext";
import { cn } from "@/lib/utils";
import type { MessageSchema, PlanStep } from "@/lib/types";
import { TargetSection } from "./step-editor/TargetSection";
import {
  ModeParams,
  ModeSelect,
  useResponseMode,
} from "./step-editor/ResponseModeSection";
import { EditorField } from "./step-editor/EditorField";
import {
  countEmptyFields,
  renderField,
  safeParseFieldValues,
} from "./step-editor/stepFields";

// ── StepEditor ────────────────────────────────────────────────────────────────

interface StepEditorProps {
  step: PlanStep;
  planId: string;
  disabled?: boolean;
}

/** The expanded body of a selected step card (handoff §5 "Expanded step"). */
export function StepEditor({ step, planId, disabled = false }: StepEditorProps) {
  const { updateStep } = usePlanStore();
  const openFiles = useProtoStore((s) => s.openFiles);

  // Proto resolution (four states — RESEARCH Pattern 5)
  const matchedFile = openFiles.find((f) => f.filePath === step.proto_path);
  const schema = matchedFile?.schema ?? null;
  // message_map lives on ProtoSchema — MessageSchema is the value type
  const message = schema?.message_map[step.message_type] ?? null;

  return (
    <StepEditorInner
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

// ── StepEditorInner ───────────────────────────────────────────────────────────
// Separated so hooks can run unconditionally (React rules of hooks — hooks
// cannot be called after an early return, so we pull the hook-heavy body
// into a child that always renders once step is non-null).

interface OpenFileEntry {
  filePath: string;
  schema: { message_map: Record<string, MessageSchema> };
}

interface StepEditorInnerProps {
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

function StepEditorInner({
  step,
  planId,
  updateStep,
  schema,
  message,
  matchedFile,
  openFiles,
  disabled = false,
}: StepEditorInnerProps) {
  const [fieldsOpen, setFieldsOpen] = useState(false);

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

  const responseMode = useResponseMode({ step, planId, updateStep });

  const fieldCount = message?.fields.length ?? 0;
  const emptyCount = countEmptyFields(
    message?.fields ?? [],
    (watchedValues ?? {}) as Record<string, unknown>
  );
  const shortType = step.message_type.split(".").pop() ?? step.message_type;

  return (
    <ProtoSchemaContext.Provider value={schema?.message_map ?? null}>
      {/* fieldset[disabled] cascades disabled state to all descendant form controls
          without prop drilling into deeply nested field components (D-09) */}
      <fieldset
        disabled={disabled}
        className={cn(
          "flex flex-col gap-3.5 border-t border-hairline p-[14px_16px_16px_72px]",
          disabled && "opacity-60"
        )}
      >
        {/* Grid 1 — proto file, message type, response mode */}
        <div className="grid grid-cols-3 gap-3">
          <EditorField label="Proto file" htmlFor={`proto-file-${step.id}`}>
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
              <SelectTrigger
                id={`proto-file-${step.id}`}
                size="sm"
                className="w-full text-[12.5px]"
              >
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
          </EditorField>

          <EditorField label="Message type" htmlFor={`message-type-${step.id}`}>
            {schema ? (
              <Select
                value={step.message_type}
                onValueChange={(type) => {
                  if (type !== step.message_type) {
                    updateStep(planId, step.id, { message_type: type }).catch(console.error);
                  }
                }}
              >
                <SelectTrigger
                  id={`message-type-${step.id}`}
                  size="sm"
                  className="w-full text-[12.5px]"
                >
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
            ) : (
              <div className="flex h-[34px] items-center rounded-md border border-border bg-background px-3 text-[12.5px] text-ghost">
                {step.message_type ? shortType : "—"}
              </div>
            )}
          </EditorField>

          <ModeSelect state={responseMode} />
        </div>

        {step.proto_path && !matchedFile && (
          <p className="text-11 text-ghost">
            Open {step.proto_path.split("/").pop() ?? step.proto_path} in the file picker,
            then retry.
          </p>
        )}

        {/* Grid 2 — target, delay/timeout, reply queue */}
        <div className="grid grid-cols-3 items-start gap-3">
          <TargetSection step={step} planId={planId} updateStep={updateStep} />
          <ModeParams state={responseMode} />
        </div>

        {/* Fields row — summary + the toggle that reveals the field form */}
        <div className="flex items-center justify-between text-12 text-muted-foreground">
          <span>
            Fields{" "}
            <span className="font-mono text-11 text-ghost">
              · {fieldCount} fields · {emptyCount} empty
            </span>
          </span>
          <span className="flex items-center gap-1.5">
            <IconButton
              size={22}
              label="Randomize fields"
              title="Fill empty fields with random values"
              onClick={handleRandomize}
              disabled={disabled || !message}
            >
              <Dices size={13} />
            </IconButton>
            <button
              type="button"
              aria-expanded={fieldsOpen}
              onClick={() => setFieldsOpen((open) => !open)}
              className="inline-flex items-center gap-1.5 rounded-sm text-12 font-medium text-violet-bright outline-none focus-visible:ring-3 focus-visible:ring-ring/35"
            >
              <Pencil size={12} />
              Edit fields
            </button>
          </span>
        </div>

        {fieldsOpen && (
          <FormProvider {...methods}>
            <form onSubmit={(e) => e.preventDefault()}>
              {!message ? (
                <p className="text-12 text-ghost">No message type selected.</p>
              ) : (
                <div className="flex flex-col gap-4">
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
            </form>
          </FormProvider>
        )}
      </fieldset>
    </ProtoSchemaContext.Provider>
  );
}
