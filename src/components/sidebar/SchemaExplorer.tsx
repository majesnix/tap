import { useState } from "react";
import { FileText, List, ChevronRight } from "lucide-react";
import { useProtoStore } from "@/stores/useProtoStore";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import type {
  MessageSchema,
  FieldSchema,
  FieldKind,
  EnumSchema,
} from "@/lib/types";

const MAX_DEPTH = 5;

function typeBadgeLabel(kind: FieldKind): string {
  switch (kind.type) {
    case "scalar":
      return kind.scalar;
    case "message": {
      const parts = kind.full_name.split(".");
      return parts[parts.length - 1];
    }
    case "enum":
      return "enum";
    case "oneof":
      return "oneof";
    case "well_known":
      return kind.wkt;
    case "map":
      return `map<${kind.key_type}, …>`;
  }
}

function FieldNode({
  field,
  schema,
  depth,
  visited,
}: {
  field: FieldSchema;
  schema: { message_map: Record<string, MessageSchema> };
  depth: number;
  visited: Set<string>;
}) {
  const isExpandable =
    field.kind.type === "message" &&
    !visited.has(field.kind.full_name) &&
    depth < MAX_DEPTH;

  const isRecursive =
    field.kind.type === "message" && visited.has(field.kind.full_name);

  const indicator = field.repeated
    ? "repeated"
    : field.kind.type === "map"
      ? "map"
      : null;

  if (isExpandable && field.kind.type === "message") {
    const nestedMsg = schema.message_map[field.kind.full_name];
    if (!nestedMsg) {
      return (
        <div className="flex items-center gap-1 text-xs py-0.5" style={{ paddingLeft: `${depth * 12}px` }}>
          <span className="text-muted-foreground">{field.name}</span>
          <Badge variant="outline" className="text-[10px] h-4 px-1">
            {typeBadgeLabel(field.kind)}
          </Badge>
          <span className="text-muted-foreground text-[10px]">#{field.field_number}</span>
          {indicator && (
            <span className="text-muted-foreground text-[10px] italic">{indicator}</span>
          )}
        </div>
      );
    }

    return (
      <ExpandableField
        field={field}
        nestedMsg={nestedMsg}
        schema={schema}
        depth={depth}
        visited={visited}
        indicator={indicator}
      />
    );
  }

  if (field.kind.type === "oneof") {
    return (
      <OneofNode
        field={field}
        schema={schema}
        depth={depth}
        visited={visited}
      />
    );
  }

  return (
    <div className="flex items-center gap-1 text-xs py-0.5" style={{ paddingLeft: `${depth * 12}px` }}>
      <span className="text-muted-foreground">{field.name}</span>
      <Badge variant="outline" className="text-[10px] h-4 px-1">
        {typeBadgeLabel(field.kind)}
      </Badge>
      <span className="text-muted-foreground text-[10px]">#{field.field_number}</span>
      {indicator && (
        <span className="text-muted-foreground text-[10px] italic">{indicator}</span>
      )}
      {isRecursive && (
        <span className="text-muted-foreground text-[10px] italic">(recursive)</span>
      )}
    </div>
  );
}

function ExpandableField({
  field,
  nestedMsg,
  schema,
  depth,
  visited,
  indicator,
}: {
  field: FieldSchema;
  nestedMsg: MessageSchema;
  schema: { message_map: Record<string, MessageSchema> };
  depth: number;
  visited: Set<string>;
  indicator: string | null;
}) {
  const [open, setOpen] = useState(false);
  const nextVisited = new Set(visited);
  if (field.kind.type === "message") {
    nextVisited.add(field.kind.full_name);
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center gap-1 text-xs py-0.5 w-full hover:bg-accent/50 rounded" style={{ paddingLeft: `${depth * 12}px` }}>
        <ChevronRight className={`size-3 shrink-0 transition-transform ${open ? "rotate-90" : ""}`} />
        <span className="text-muted-foreground">{field.name}</span>
        <Badge variant="outline" className="text-[10px] h-4 px-1">
          {typeBadgeLabel(field.kind)}
        </Badge>
        <span className="text-muted-foreground text-[10px]">#{field.field_number}</span>
        {indicator && (
          <span className="text-muted-foreground text-[10px] italic">{indicator}</span>
        )}
      </CollapsibleTrigger>
      <CollapsibleContent>
        {nestedMsg.fields.map((f) => (
          <FieldNode
            key={f.name}
            field={f}
            schema={schema}
            depth={depth + 1}
            visited={nextVisited}
          />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

function OneofNode({
  field,
  schema,
  depth,
  visited,
}: {
  field: FieldSchema;
  schema: { message_map: Record<string, MessageSchema> };
  depth: number;
  visited: Set<string>;
}) {
  const [open, setOpen] = useState(false);
  if (field.kind.type !== "oneof") return null;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center gap-1 text-xs py-0.5 w-full hover:bg-accent/50 rounded" style={{ paddingLeft: `${depth * 12}px` }}>
        <ChevronRight className={`size-3 shrink-0 transition-transform ${open ? "rotate-90" : ""}`} />
        <span className="text-muted-foreground">{field.name}</span>
        <Badge variant="outline" className="text-[10px] h-4 px-1">oneof</Badge>
        <span className="text-muted-foreground text-[10px]">#{field.field_number}</span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        {field.kind.branches.map((branch, bi) =>
          branch.map((f) => (
            <FieldNode
              key={`${bi}-${f.name}`}
              field={f}
              schema={schema}
              depth={depth + 1}
              visited={visited}
            />
          ))
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

function MessageNode({
  msg,
  schema,
  onSelect,
}: {
  msg: MessageSchema;
  schema: { message_map: Record<string, MessageSchema> };
  onSelect: (fullName: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const visited = new Set<string>([msg.full_name]);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="flex items-center gap-1 text-xs py-0.5">
        <CollapsibleTrigger className="flex items-center gap-1 hover:bg-accent/50 rounded p-0.5" aria-label={`Expand ${msg.name}`}>
          <ChevronRight className={`size-3 shrink-0 transition-transform ${open ? "rotate-90" : ""}`} />
          <FileText className="size-3 shrink-0 text-muted-foreground" />
        </CollapsibleTrigger>
        <button
          type="button"
          className="hover:underline cursor-pointer truncate"
          onClick={() => onSelect(msg.full_name)}
          aria-label={`Select ${msg.name}`}
        >
          {msg.name}
        </button>
        <Badge variant="secondary" className="text-[10px] h-4 px-1 shrink-0">
          {msg.fields.length}
        </Badge>
      </div>
      <CollapsibleContent>
        {msg.fields.map((f) => (
          <FieldNode
            key={f.name}
            field={f}
            schema={schema}
            depth={1}
            visited={visited}
          />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

function EnumNode({ enumDef }: { enumDef: EnumSchema }) {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center gap-1 text-xs py-0.5 w-full hover:bg-accent/50 rounded">
        <ChevronRight className={`size-3 shrink-0 transition-transform ${open ? "rotate-90" : ""}`} />
        <List className="size-3 shrink-0 text-muted-foreground" />
        <span className="truncate">{enumDef.name}</span>
        <Badge variant="secondary" className="text-[10px] h-4 px-1 shrink-0">
          {enumDef.values.length}
        </Badge>
      </CollapsibleTrigger>
      <CollapsibleContent>
        {enumDef.values.map((v) => (
          <div
            key={v.name}
            className="text-xs text-muted-foreground py-0.5"
            style={{ paddingLeft: "24px" }}
          >
            {v.name} = {v.number}
          </div>
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

export function SchemaExplorer() {
  const { schema, setSelectedType } = useProtoStore();

  if (!schema || schema.messages.length === 0) return null;

  return (
    <ScrollArea className="max-h-64">
      <div className="flex flex-col gap-0.5">
        <span className="text-xs font-medium text-muted-foreground mb-1">
          Messages
        </span>
        {schema.messages.map((msg) => (
          <MessageNode
            key={msg.full_name}
            msg={msg}
            schema={schema}
            onSelect={setSelectedType}
          />
        ))}

        {schema.enums.length > 0 && (
          <>
            <span className="text-xs font-medium text-muted-foreground mt-2 mb-1">
              Enums
            </span>
            {schema.enums.map((e) => (
              <EnumNode key={e.full_name} enumDef={e} />
            ))}
          </>
        )}
      </div>
    </ScrollArea>
  );
}
