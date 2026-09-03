import { SectionLabel } from "@/components/common/SectionLabel";
import { cn } from "@/lib/utils";
import type { ProtoSchema } from "@/lib/types";

interface MessageListProps {
  schema: ProtoSchema;
  selected: string | null;
  onSelect: (fullName: string) => void;
}

export function MessageList({ schema, selected, onSelect }: MessageListProps) {
  return (
    <div className="flex flex-col gap-0.5 overflow-hidden">
      <SectionLabel className="px-2 pb-1.5">Messages</SectionLabel>
      {schema.messages.map((m) => {
        const isSelected = m.full_name === selected;
        return (
          <button
            key={m.full_name}
            type="button"
            aria-current={isSelected}
            onClick={() => onSelect(m.full_name)}
            className={cn(
              "flex h-8 items-center gap-2 rounded-md px-2.5 text-13",
              isSelected
                ? "bg-primary/12 text-foreground"
                : "text-muted-foreground hover:bg-card"
            )}
          >
            <span
              className={cn("size-1.5 shrink-0 rounded-full", isSelected ? "bg-primary" : "bg-ghost")}
            />
            <span className="flex-1 truncate text-left font-medium">{m.name}</span>{" "}
            <span className="shrink-0 font-mono text-11 text-ghost">{m.fields.length}</span>
          </button>
        );
      })}
      {schema.enums.length > 0 && (
        <>
          <SectionLabel className="px-2 pt-3.5 pb-1.5">Enums</SectionLabel>
          {schema.enums.map((e) => (
            <div
              key={e.full_name}
              className="flex h-8 items-center gap-2 rounded-md px-2.5 text-13 text-muted-foreground"
            >
              <span className="size-1.5 shrink-0 rounded-xs bg-ghost" />
              <span className="flex-1 truncate">{e.name}</span>
              <span className="shrink-0 font-mono text-11 text-ghost">{e.values.length}</span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
