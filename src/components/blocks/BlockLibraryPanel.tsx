import { useState, useEffect } from "react";
import { useDraggable } from "@dnd-kit/core";
import CodeMirror from "@uiw/react-codemirror";
import { json } from "@codemirror/lang-json";
import { Plus, Pencil, Trash2, ArrowLeft, TriangleAlertIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { useBlockStore, type Block } from "@/stores/useBlockStore";

type PanelView = "list" | "editor";

interface DraggableBlockRowProps {
  block: Block;
  onEdit: (block: Block) => void;
  onDelete: (block: Block) => void;
}

function DraggableBlockRow({ block, onEdit, onDelete }: DraggableBlockRowProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: block.id });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`px-3 py-2 flex items-center justify-between hover:bg-muted rounded-sm cursor-grab active:cursor-grabbing${isDragging ? ' opacity-50' : ''}`}
    >
      <span className="text-sm truncate flex-1">{block.name}</span>
      <div className="flex items-center gap-2 shrink-0">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Edit ${block.name}`}
          onClick={() => onEdit(block)}
        >
          <Pencil size={14} />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Delete ${block.name}`}
          onClick={() => onDelete(block)}
        >
          <Trash2 size={14} />
        </Button>
      </div>
    </div>
  );
}

export function BlockLibraryPanel() {
  const { blocks, blocksLoaded, loadBlocks, addBlock, updateBlock, deleteBlock } =
    useBlockStore();
  const { resolvedTheme } = useTheme();

  const [view, setView] = useState<PanelView>("list");
  const [editingBlock, setEditingBlock] = useState<Block | null>(null);
  const [nameDraft, setNameDraft] = useState("");
  const [contentDraft, setContentDraft] = useState("{}");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveErrorKind, setSaveErrorKind] = useState<"validation" | "json-parse" | "persistence" | null>(null);
  const [blockToDelete, setBlockToDelete] = useState<Block | null>(null);

  // Lazy-load on mount — mirrors MessageHistoryPanel.tsx lines 19-23
  useEffect(() => {
    if (!blocksLoaded) {
      void loadBlocks();
    }
  }, [blocksLoaded, loadBlocks]);

  function clearSaveError() {
    setSaveError(null);
    setSaveErrorKind(null);
  }

  function handleNewBlock() {
    setEditingBlock(null);
    setNameDraft("");
    setContentDraft("{}");
    clearSaveError();
    setView("editor");
  }

  function handleEditBlock(block: Block) {
    setEditingBlock(block);
    setNameDraft(block.name);
    setContentDraft(block.content);
    clearSaveError();
    setView("editor");
  }

  function handleBack() {
    clearSaveError();
    setView("list");
  }

  function handleSave() {
    if (!nameDraft.trim()) {
      setSaveError("Name is required");
      setSaveErrorKind("validation");
      return;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(contentDraft);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Invalid JSON");
      setSaveErrorKind("json-parse");
      return;
    }
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      setSaveError("JSON must be an object");
      setSaveErrorKind("validation");
      return;
    }
    clearSaveError();
    const op = editingBlock
      ? updateBlock(editingBlock.id, { name: nameDraft.trim(), content: contentDraft })
      : addBlock({ id: crypto.randomUUID(), name: nameDraft.trim(), content: contentDraft });
    op.then(() => {
      setView("list");
    }).catch((err: unknown) => {
      setSaveError(err instanceof Error ? err.message : "Failed to save block");
      setSaveErrorKind("persistence");
    });
  }

  if (view === "editor") {
    return (
      <div className="w-64 shrink-0 h-full flex flex-col border-r border-border">
        {/* Header */}
        <div className="px-4 py-3 border-b border-border shrink-0 flex items-center gap-2">
          <Button variant="ghost" size="icon-sm" aria-label="Back" onClick={handleBack}>
            <ArrowLeft size={16} />
          </Button>
          <h2 className="text-sm font-semibold">
            {editingBlock ? "Edit block" : "New block"}
          </h2>
        </div>
        {/* Editor body — MUST be flex-col min-h-0, NOT ScrollArea (Pitfall 4) */}
        <div className="flex-1 flex flex-col p-4 gap-3 min-h-0">
          <Input
            placeholder="Block name"
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
          />
          {/* CodeMirror — flex-1 so it fills remaining space */}
          <div className="flex-1 flex flex-col min-h-0">
            <CodeMirror
              value={contentDraft}
              height="100%"
              theme={resolvedTheme === "dark" ? "dark" : "light"}
              extensions={[json()]}
              onChange={setContentDraft}
              className="flex-1 min-h-0"
              basicSetup={{ lineNumbers: true, bracketMatching: true }}
            />
          </div>
          {saveError && (
            <div
              role="alert"
              className="rounded-md border border-destructive/40 bg-destructive/10 p-3"
            >
              <div className="flex items-start gap-2">
                <TriangleAlertIcon className="size-4 text-destructive shrink-0 mt-1" />
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-semibold text-destructive">
                    {saveErrorKind === "json-parse" ? "Invalid JSON" : saveError}
                  </span>
                  {saveErrorKind === "json-parse" && (
                    <p className="text-xs text-destructive mt-1">
                      {saveError}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
          <Button
            variant="default"
            className="w-full mt-auto"
            aria-label="Save block"
            onClick={handleSave}
            disabled={!blocksLoaded}
          >
            {blocksLoaded ? "Save block" : "Loading…"}
          </Button>
        </div>
      </div>
    );
  }

  // List view (default)
  return (
    <div className="w-64 shrink-0 h-full flex flex-col border-r border-border">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border shrink-0 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Block Library</h2>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="New block"
          onClick={handleNewBlock}
        >
          <Plus size={16} />
        </Button>
      </div>
      {/* Scrollable list */}
      <ScrollArea className="flex-1 min-h-0">
        {blocksLoaded && blocks.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-2 p-4">
            <p className="text-sm text-muted-foreground font-medium">No blocks yet</p>
            <p className="text-xs text-muted-foreground text-center">
              Save JSON snippets you can reuse across messages.
            </p>
          </div>
        )}
        {blocksLoaded &&
          blocks.map((block) => (
            <DraggableBlockRow
              key={block.id}
              block={block}
              onEdit={handleEditBlock}
              onDelete={(b) => setBlockToDelete(b)}
            />
          ))}
      </ScrollArea>
      {/* AlertDialog for delete — rendered outside ScrollArea, always in tree */}
      <AlertDialog
        open={!!blockToDelete}
        onOpenChange={(open) => {
          if (!open) setBlockToDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &quot;{blockToDelete?.name}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep block</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (blockToDelete) {
                  const id = blockToDelete.id;
                  setBlockToDelete(null);
                  deleteBlock(id).catch((err: unknown) => {
                    toast.error(
                      err instanceof Error ? err.message : "Failed to delete block"
                    );
                  });
                }
              }}
            >
              Delete block
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
