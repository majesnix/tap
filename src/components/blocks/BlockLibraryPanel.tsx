import { useState, useEffect } from "react";
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
import { useBlockStore, type Block } from "@/stores/useBlockStore";

interface BlockLibraryPanelProps {
  onClose?: () => void; // optional — for future use; Plan 03 does not pass it currently
}

type PanelView = "list" | "editor";

export function BlockLibraryPanel({ onClose: _onClose }: BlockLibraryPanelProps) {
  const { blocks, blocksLoaded, loadBlocks, addBlock, updateBlock, deleteBlock } =
    useBlockStore();
  const { resolvedTheme } = useTheme();

  const [view, setView] = useState<PanelView>("list");
  const [editingBlock, setEditingBlock] = useState<Block | null>(null);
  const [nameDraft, setNameDraft] = useState("");
  const [contentDraft, setContentDraft] = useState("{}");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [blockToDelete, setBlockToDelete] = useState<Block | null>(null);

  // Lazy-load on mount — mirrors MessageHistoryPanel.tsx lines 19-23
  useEffect(() => {
    if (!blocksLoaded) {
      void loadBlocks();
    }
  }, [blocksLoaded, loadBlocks]);

  function handleNewBlock() {
    setEditingBlock(null);
    setNameDraft("");
    setContentDraft("{}");
    setSaveError(null);
    setView("editor");
  }

  function handleEditBlock(block: Block) {
    setEditingBlock(block);
    setNameDraft(block.name);
    setContentDraft(block.content);
    setSaveError(null);
    setView("editor");
  }

  function handleBack() {
    setSaveError(null);
    setView("list");
  }

  function handleSave() {
    if (!nameDraft.trim()) {
      setSaveError("Name is required");
      return;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(contentDraft);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Invalid JSON");
      return;
    }
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      setSaveError("JSON must be an object");
      return;
    }
    setSaveError(null);
    if (editingBlock) {
      void updateBlock(editingBlock.id, { name: nameDraft.trim(), content: contentDraft });
    } else {
      void addBlock({ id: crypto.randomUUID(), name: nameDraft.trim(), content: contentDraft });
    }
    setView("list");
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
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3">
              <div className="flex items-start gap-2">
                <TriangleAlertIcon className="size-4 text-destructive shrink-0 mt-1" />
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-semibold text-destructive">
                    {saveError === "Name is required" || saveError === "JSON must be an object"
                      ? saveError
                      : "Invalid JSON"}
                  </span>
                  {saveError !== "Name is required" && saveError !== "JSON must be an object" && (
                    <p className="text-xs text-destructive mt-1" role="alert">
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
            <div
              key={block.id}
              className="px-3 py-2 flex items-center justify-between hover:bg-muted rounded-sm"
            >
              <span className="text-sm truncate flex-1">{block.name}</span>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Edit ${block.name}`}
                  onClick={() => handleEditBlock(block)}
                >
                  <Pencil size={14} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Delete ${block.name}`}
                  onClick={() => setBlockToDelete(block)}
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            </div>
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
                  void deleteBlock(blockToDelete.id);
                  setBlockToDelete(null);
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
