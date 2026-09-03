import { useState, useEffect, useMemo } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { json } from "@codemirror/lang-json";
import { Plus, Search, ArrowLeft, TriangleAlertIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { IconButton } from "@/components/common/IconButton";
import { SectionLabel } from "@/components/common/SectionLabel";
import { jsonEditorTheme } from "@/components/form/jsonEditorTheme";
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
import { useProtoStore } from "@/stores/useProtoStore";
import { BlockCard } from "@/components/blocks/BlockCard";
import { describeBlockFit } from "@/components/blocks/blockFit";

type PanelView = "list" | "editor";

export function BlockLibraryPanel() {
  const { blocks, blocksLoaded, loadBlocks, addBlock, updateBlock, deleteBlock } =
    useBlockStore();
  const { resolvedTheme } = useTheme();
  // Same design-system CodeMirror theme the request form's JSON editor uses.
  const editorExtensions = useMemo(
    () => [json(), ...jsonEditorTheme(resolvedTheme === "dark")],
    [resolvedTheme]
  );
  const selectedMessage = useProtoStore(
    (s) => s.schema?.message_map[s.selectedMessageType ?? ""] ?? null
  );

  const [view, setView] = useState<PanelView>("list");
  const [editingBlock, setEditingBlock] = useState<Block | null>(null);
  const [nameDraft, setNameDraft] = useState("");
  const [contentDraft, setContentDraft] = useState("{}");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveErrorKind, setSaveErrorKind] = useState<"validation" | "json-parse" | "persistence" | null>(null);
  const [blockToDelete, setBlockToDelete] = useState<Block | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [filterText, setFilterText] = useState("");

  // Lazy-load on mount so the drawer only reads the block store once it is opened.
  useEffect(() => {
    if (!blocksLoaded) {
      void loadBlocks();
    }
  }, [blocksLoaded, loadBlocks]);

  const filteredBlocks = useMemo(() => {
    if (!searchOpen || !filterText.trim()) return blocks;
    const needle = filterText.trim().toLowerCase();
    return blocks.filter((b) => b.name.toLowerCase().includes(needle));
  }, [blocks, searchOpen, filterText]);

  function clearSaveError() {
    setSaveError(null);
    setSaveErrorKind(null);
  }

  function handleToggleSearch() {
    setSearchOpen((open) => {
      if (open) setFilterText("");
      return !open;
    });
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

  function handleDeleteRequest() {
    if (editingBlock) setBlockToDelete(editingBlock);
  }

  function handleConfirmDelete() {
    if (!blockToDelete) return;
    const id = blockToDelete.id;
    setBlockToDelete(null);
    deleteBlock(id)
      .then(() => {
        setView("list");
      })
      .catch((err: unknown) => {
        toast.error(err instanceof Error ? err.message : "Failed to delete block");
      });
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

  return (
    <>
      <div className="flex flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card">
        {view === "editor" ? (
          <>
            {/* Header */}
            <div className="flex items-center gap-2 p-[14px_14px_10px]">
              <IconButton size={24} label="Back" onClick={handleBack}>
                <ArrowLeft size={16} strokeWidth={1.5} />
              </IconButton>
              <h2 className="text-13 font-semibold">
                {editingBlock ? "Edit block" : "New block"}
              </h2>
            </div>
            {/* Editor body — MUST be flex-col min-h-0, NOT ScrollArea (Pitfall 4) */}
            <div className="flex flex-1 flex-col gap-3 p-3 min-h-0">
              <Input
                className="h-9"
                placeholder="Block name"
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
              />
              {/* CodeMirror — flex-1 so it fills remaining space */}
              <div className="flex-1 flex flex-col min-h-0">
                <CodeMirror
                  value={contentDraft}
                  height="100%"
                  theme="none"
                  extensions={editorExtensions}
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
                    <TriangleAlertIcon className="size-4 text-destructive shrink-0 mt-1" strokeWidth={1.5} />
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
              <div className="mt-auto flex flex-col gap-2">
                {editingBlock && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="self-start px-0 text-12 text-danger hover:bg-danger/12 hover:text-danger"
                    onClick={handleDeleteRequest}
                  >
                    Delete block
                  </Button>
                )}
                <Button
                  variant="default"
                  className="w-full"
                  aria-label="Save block"
                  onClick={handleSave}
                  disabled={!blocksLoaded}
                >
                  {blocksLoaded ? "Save block" : "Loading…"}
                </Button>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center justify-between p-[14px_14px_10px]">
              <SectionLabel>Blocks</SectionLabel>
              <div className="flex gap-0.5">
                <IconButton size={24} label="Search blocks" onClick={handleToggleSearch}>
                  <Search size={14} strokeWidth={1.5} />
                </IconButton>
                <IconButton size={24} tone="violet" label="New block" onClick={handleNewBlock}>
                  <Plus size={15} strokeWidth={1.5} />
                </IconButton>
              </div>
            </div>
            {searchOpen && (
              <Input
                className="mx-2.5 mb-2 h-7 text-12"
                aria-label="Filter blocks"
                placeholder="Filter blocks"
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                autoFocus
              />
            )}
            {/* Scrollable list */}
            <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-2.5 min-h-0">
              {blocksLoaded && blocks.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full gap-2 p-4">
                  <p className="text-sm text-muted-foreground font-medium">No blocks yet</p>
                  <p className="text-xs text-muted-foreground text-center">
                    Save JSON snippets you can reuse across messages.
                  </p>
                </div>
              )}
              {blocksLoaded &&
                filteredBlocks.map((block) => (
                  <BlockCard
                    key={block.id}
                    block={block}
                    fit={describeBlockFit(block.content, selectedMessage)}
                    onEdit={handleEditBlock}
                  />
                ))}
            </div>
            {/* Footer note */}
            <div className="border-t border-border p-[12px_14px] text-11 text-ghost leading-[1.5]">
              Drop onto the request. Fields that already have a value ask before being overwritten.
            </div>
          </>
        )}
      </div>
      {/* AlertDialog for delete — rendered outside the card, always in tree */}
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
            <AlertDialogAction variant="destructive" onClick={handleConfirmDelete}>
              Delete block
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
