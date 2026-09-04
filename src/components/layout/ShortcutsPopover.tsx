import { Keyboard } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { IconButton } from "@/components/common/IconButton";
import { Kbd } from "@/components/common/Kbd";
import { usePlatformLabel } from "@/hooks/usePlatformLabel";

interface ShortcutRow {
  label: string;
  keys: (mod: string) => string;
}

const ROWS: ShortcutRow[] = [
  { label: "Open .proto", keys: (mod) => `${mod}O` },
  { label: "Reload schema", keys: (mod) => `${mod}R` },
  { label: "Send", keys: (mod) => `${mod}↵` },
  { label: "Clear form", keys: (mod) => `${mod}⇧R` },
  { label: "Focus activity filter", keys: (mod) => `${mod}1` },
  { label: "Toggle hex", keys: (mod) => `${mod}2` },
  { label: "Read queue", keys: (mod) => `${mod}3` },
];

export function ShortcutsPopover() {
  const { modSymbol } = usePlatformLabel();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <IconButton size={32} label="Shortcuts">
          <Keyboard size={17} strokeWidth={1.5} />
        </IconButton>
      </PopoverTrigger>
      <PopoverContent className="w-64">
        {ROWS.map((row) => (
          <div key={row.label} className="flex justify-between text-12">
            <span>{row.label}</span>
            <Kbd>{row.keys(modSymbol)}</Kbd>
          </div>
        ))}
      </PopoverContent>
    </Popover>
  );
}
