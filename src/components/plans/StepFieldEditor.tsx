import type { PlanStep } from "@/lib/types";
import { ScrollArea } from "@/components/ui/scroll-area";

interface StepFieldEditorProps {
  step: PlanStep | null;
  planId: string;
}

export function StepFieldEditor({ step, planId: _planId }: StepFieldEditorProps) {
  if (!step) {
    // Empty state: steps exist but none selected (D-05)
    return (
      <div className="flex flex-1 items-center justify-center p-6 text-center">
        <p className="text-sm text-muted-foreground">Select a step to edit it.</p>
      </div>
    );
  }

  // Full editor — implemented in Plan 03. Stub shows section structure only.
  return (
    <ScrollArea className="flex flex-1 flex-col min-h-0">
      {/* Section: Proto file + message type */}
      <div className="px-4 py-3 border-b border-border">
        <h3 className="text-sm font-semibold mb-3">Proto file</h3>
        <p className="text-xs text-muted-foreground">
          Proto file selector — implemented in Plan 03.
        </p>
      </div>
      {/* Section: Fields */}
      <div className="px-4 py-3 border-b border-border">
        <h3 className="text-sm font-semibold mb-3">Fields</h3>
        <p className="text-xs text-muted-foreground">
          Field primitives — implemented in Plan 03.
        </p>
      </div>
      {/* Section: Target */}
      <div className="px-4 py-3 border-b border-border">
        <h3 className="text-sm font-semibold mb-3">Target</h3>
        <p className="text-xs text-muted-foreground">
          Target selector — implemented in Plan 03.
        </p>
      </div>
      {/* Section: Response mode */}
      <div className="px-4 py-3 border-b border-border">
        <h3 className="text-sm font-semibold mb-3">Response mode</h3>
        <p className="text-xs text-muted-foreground">
          Response mode — implemented in Plan 03.
        </p>
      </div>
    </ScrollArea>
  );
}
