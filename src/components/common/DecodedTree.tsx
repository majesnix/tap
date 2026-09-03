import { useState } from "react";
import { cn } from "@/lib/utils";

const ENUM_NAME = /^[A-Z][A-Z0-9_]*$/;

/** Text + color class for a scalar (non-object, non-array) value. */
export function formatScalar(value: unknown): { text: string; className: string } {
  if (value === null) return { text: "null", className: "text-ghost" };
  if (typeof value === "string") {
    return ENUM_NAME.test(value)
      ? { text: value, className: "text-teal" }
      : { text: `"${value}"`, className: "text-violet-bright" };
  }
  return { text: String(value), className: "text-foreground" };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function Row({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="flex gap-2 min-w-0">
      <span className="text-muted-foreground">{label}</span>
      <ValueNode value={value} />
    </div>
  );
}

function Children({ entries }: { entries: [string, unknown][] }) {
  return (
    <div className="pl-3 border-l border-hairline">
      {entries.map(([key, value]) => (
        <Row key={key} label={key} value={value} />
      ))}
    </div>
  );
}

function ValueNode({ value }: { value: unknown }) {
  const [open, setOpen] = useState(false);

  if (Array.isArray(value)) {
    if (!open) {
      return (
        <button
          type="button"
          className="font-mono text-muted-foreground"
          onClick={() => setOpen(true)}
        >
          {`[${value.length} items]`}
        </button>
      );
    }
    return <Children entries={value.map((item, index) => [String(index), item] as [string, unknown])} />;
  }

  if (isPlainObject(value)) {
    if (!open) {
      return (
        <button
          type="button"
          className="font-mono text-muted-foreground"
          onClick={() => setOpen(true)}
        >
          {"{…}"}
        </button>
      );
    }
    return <Children entries={Object.entries(value)} />;
  }

  const { text, className } = formatScalar(value);
  return <span className={className}>{text}</span>;
}

export function DecodedTree({
  value,
  className,
}: {
  value: Record<string, unknown> | unknown[];
  className?: string;
}) {
  const entries: [string, unknown][] = Array.isArray(value)
    ? value.map((item, index) => [String(index), item])
    : Object.entries(value);

  return (
    <div className={cn("font-mono text-12 leading-[1.6]", className)}>
      {entries.map(([key, item]) => (
        <Row key={key} label={key} value={item} />
      ))}
    </div>
  );
}
