import { useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface IncludePathDialogProps {
  open: boolean;
  initialPaths: string[];
  onConfirm: (paths: string[]) => void;
  onCancel: () => void;
}

/**
 * Dialog for configuring include paths used by protox to resolve .proto imports.
 * The file's parent directory is pre-populated by default.
 * Paths are persisted per file via tauri-plugin-store (handled in FileSection.tsx).
 *
 * Copywriting per UI-SPEC Copywriting Contract:
 *   Title:   "Configure include paths"
 *   Body:    "Add the directories that contain imported `.proto` files. The file's parent directory is included by default."
 *   Confirm: "Load file"
 *   Cancel:  "Discard path changes"
 */
export function IncludePathDialog({
  open: isOpen,
  initialPaths,
  onConfirm,
  onCancel,
}: IncludePathDialogProps) {
  const [paths, setPaths] = useState<string[]>(initialPaths);

  // Re-initialize paths whenever the dialog opens with new initialPaths
  useEffect(() => {
    if (isOpen) {
      setPaths(initialPaths);
    }
  }, [isOpen, initialPaths]);

  const handleAddPath = async () => {
    const selected = await open({ directory: true, multiple: false });
    if (selected && typeof selected === "string") {
      setPaths((prev) => [...prev, selected]);
    }
  };

  const handleRemovePath = (index: number) => {
    setPaths((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onCancel(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Configure include paths</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          Add the directories that contain imported{" "}
          <code className="text-xs font-mono">.proto</code> files. The
          file&apos;s parent directory is included by default.
        </p>

        <div className="flex flex-col gap-2 max-h-60 overflow-y-auto">
          {paths.map((path, index) => (
            <div key={`${path}-${index}`} className="flex items-center gap-2">
              <Input readOnly value={path} className="flex-1 text-xs" />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleRemovePath(index)}
                aria-label={`Remove ${path}`}
              >
                ✕
              </Button>
            </div>
          ))}
        </div>

        <Button type="button" variant="outline" onClick={handleAddPath} className="w-full">
          Add path
        </Button>

        <DialogFooter className="gap-2">
          <Button type="button" variant="ghost" onClick={onCancel}>
            Discard path changes
          </Button>
          <Button type="button" onClick={() => onConfirm(paths)}>
            Load file
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
