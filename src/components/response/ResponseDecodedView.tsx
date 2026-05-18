import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface JsonTreeNodeProps {
  keyName: string;
  value: unknown;
  depth?: number;
}

function JsonTreeNode({ keyName, value, depth = 0 }: JsonTreeNodeProps) {
  const [open, setOpen] = useState(true); // all nodes start expanded

  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    // Nested message — render as collapsible section
    return (
      <Collapsible
        open={open}
        onOpenChange={setOpen}
        className="ml-4 border-l border-border pl-3 mb-1"
      >
        <CollapsibleTrigger className="flex items-center gap-1 text-sm font-semibold text-foreground py-0.5 cursor-pointer">
          {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          {keyName}
        </CollapsibleTrigger>
        <CollapsibleContent>
          {Object.entries(value as Record<string, unknown>).map(([k, v]) => (
            <JsonTreeNode key={k} keyName={k} value={v} depth={depth + 1} />
          ))}
        </CollapsibleContent>
      </Collapsible>
    );
  }

  if (Array.isArray(value)) {
    // Repeated field — show as collapsible list
    return (
      <Collapsible
        open={open}
        onOpenChange={setOpen}
        className="ml-4 border-l border-border pl-3 mb-1"
      >
        <CollapsibleTrigger className="flex items-center gap-1 text-sm font-semibold text-foreground py-0.5 cursor-pointer">
          {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          {keyName} [{value.length}]
        </CollapsibleTrigger>
        <CollapsibleContent>
          {value.map((item, idx) => (
            <JsonTreeNode key={idx} keyName={String(idx)} value={item} depth={depth + 1} />
          ))}
        </CollapsibleContent>
      </Collapsible>
    );
  }

  // Scalar — render as key: value row (UI-SPEC: field name semibold, value muted)
  return (
    <div className="flex gap-2 text-sm pl-4 py-0.5">
      <span className="font-semibold text-foreground">{keyName}:</span>
      <span className="text-muted-foreground break-all">{String(value)}</span>
    </div>
  );
}

interface ResponseDecodedViewProps {
  decoded: Record<string, unknown> | null;
  error: string | null;
}

export function ResponseDecodedView({ decoded, error }: ResponseDecodedViewProps) {
  if (error !== null) {
    return (
      <div className="text-xs text-destructive font-mono break-all p-4">{error}</div>
    );
  }

  if (decoded === null) return null;

  return (
    <div className="p-4 space-y-1">
      {Object.entries(decoded).map(([key, val]) => (
        <JsonTreeNode key={key} keyName={key} value={val} />
      ))}
    </div>
  );
}
