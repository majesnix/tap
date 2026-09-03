import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { useProtoStore } from "@/stores/useProtoStore";
import { ProtoFormRenderer } from "@/components/form/ProtoFormRenderer";
import { JsonEditor } from "@/components/form/JsonEditor";
import { BrokerConfirmDialog } from "@/components/response/BrokerConfirmDialog";
import { BlockConflictDialog } from "@/components/compose/BlockConflictDialog";
import { DestinationStrip } from "@/components/compose/DestinationStrip";
import { EmptyState } from "@/components/compose/EmptyState";
import { PropertiesSection } from "@/components/compose/PropertiesSection";
import { RequestFooter } from "@/components/compose/RequestFooter";
import { RequestHeader } from "@/components/compose/RequestHeader";
import { useDestination } from "@/components/compose/useDestination";
import { usePublish } from "@/components/compose/usePublish";
import { useRequestForm } from "@/components/compose/useRequestForm";
import type { ComposeSignals } from "@/components/layout/ComposeView";
import { cn } from "@/lib/utils";

interface RequestCardProps {
  signals: ComposeSignals;
  blocksOpen: boolean;
  onToggleBlocks: () => void;
}

/**
 * One card for the whole request: what is being sent, where it goes, the properties it
 * carries, the form itself and the Send button with its wire bytes.
 *
 * Every hook runs before the empty-state branch — the clear and send shortcuts live in
 * useRequestForm and must stay registered whether or not a schema is open.
 */
export function RequestCard({
  signals: { toggleHex },
  blocksOpen,
  onToggleBlocks,
}: RequestCardProps) {
  const schema = useProtoStore((s) => s.schema);
  const selectedMessageType = useProtoStore((s) => s.selectedMessageType);
  const message =
    schema && selectedMessageType ? (schema.message_map[selectedMessageType] ?? null) : null;

  const {
    resetRef,
    getDirtyFieldsRef,
    applyBlockRef,
    dropZone: { setNodeRef: setDropZoneRef, isOver: isDragOver },
    conflict,
    ...form
  } = useRequestForm(message);
  const destination = useDestination();
  const publish = usePublish(destination);

  const [propsOpen, setPropsOpen] = useState(false);
  const [hexOpen, setHexOpen] = useState(false);
  const { resolvedTheme } = useTheme();

  // mod+2 toggles the hex dump from the shell.
  useEffect(() => {
    toggleHex.current = () => setHexOpen((v) => !v);
    return () => {
      toggleHex.current = null;
    };
  }, [toggleHex]);

  // A block can only land on the form, so the JSON editor shows no drop affordance.
  const isDropTarget = isDragOver && !form.isJsonMode;

  // Mounted in every branch: mod+enter can request a production send before a message type is
  // selected, and that confirmation must still be answerable.
  const confirmDialog = (
    <BrokerConfirmDialog
      request={publish.pendingPublish}
      onConfirm={publish.confirmPublish}
      onCancel={publish.cancelPublish}
    />
  );

  if (!schema || !selectedMessageType) {
    return (
      <>
        {confirmDialog}
        <EmptyState />
      </>
    );
  }

  if (!message) {
    return (
      <>
        {confirmDialog}
        <div className="flex flex-1 items-center justify-center text-12 text-ghost">
          Message type not found in schema
        </div>
      </>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col p-4">
      <BlockConflictDialog conflict={conflict} />
      {confirmDialog}

      <div
        ref={setDropZoneRef}
        data-testid="drop-zone"
        className={cn(
          "flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border bg-card transition-[border-color,box-shadow]",
          isDropTarget ? "border-border-strong ring-4 ring-primary/12" : "border-border"
        )}
      >
        <RequestHeader
          message={message}
          hasDraft={form.hasDraft}
          isJsonMode={form.isJsonMode}
          blocksOpen={blocksOpen}
          onToggleBlocks={onToggleBlocks}
          onRandomize={form.randomize}
          onClear={form.clear}
          onToggleJson={form.toggleJson}
          dropHint={
            isDropTarget
              ? `Drop to fill ${message.name} · ${message.fields.length} fields`
              : null
          }
        />

        <DestinationStrip
          destination={destination}
          propsOpen={propsOpen}
          onTogglePropsOpen={() => setPropsOpen((v) => !v)}
        />

        {propsOpen && <PropertiesSection onApplied={() => setPropsOpen(false)} />}

        {form.isJsonMode ? (
          // Plain flex column: CodeMirror must not be nested inside a ScrollArea.
          <div className="flex min-h-0 flex-1 flex-col">
            <JsonEditor
              value={form.jsonDraft}
              onChange={form.setJsonDraft}
              resolvedTheme={resolvedTheme}
              parseError={form.parseError}
              onFixJson={form.fixJson}
              onDiscard={form.discardJson}
              onSubmit={() => useProtoStore.getState().requestSend()}
            />
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-auto p-[18px]">
            <ProtoFormRenderer
              message={message}
              onValuesChange={form.handleValuesChange}
              resetRef={resetRef}
              getDirtyFieldsRef={getDirtyFieldsRef}
              applyBlockRef={applyBlockRef}
            />
          </div>
        )}

        <RequestFooter
          publish={publish}
          targetName={destination.targetName}
          messageFullName={message.full_name}
          hexOpen={hexOpen}
          onToggleHex={() => setHexOpen((v) => !v)}
        />
      </div>
    </div>
  );
}
