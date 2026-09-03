import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";

// ── LiveCombobox ──────────────────────────────────────────────────────────────
// Combobox with live server-side items and free-text input.
// Falls back to plain Input when items is empty (no management API or not yet loaded).
// Shows an error below when the typed value matches no available item.

interface LiveComboboxProps {
  value: string;
  onChange: (value: string) => void;
  /** Called with the committed value on item selection or input blur. */
  onCommit?: (value: string) => void;
  items: string[];
  placeholder?: string;
  id?: string;
}

export function LiveCombobox({ value, onChange, onCommit, items, placeholder, id }: LiveComboboxProps) {
  const [open, setOpen] = useState(false);

  if (items.length === 0) {
    return (
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => onCommit?.(value)}
        placeholder={placeholder}
        className="h-[34px] font-mono text-[12.5px]"
      />
    );
  }

  const filtered = items.filter((i) => i.toLowerCase().includes(value.toLowerCase()));
  const noMatch = value.length > 0 && filtered.length === 0;

  return (
    <div className="flex flex-col gap-1">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="h-[34px] w-full justify-between bg-background px-3 font-mono text-[12.5px] font-normal"
          >
            <span className="flex-1 truncate text-left">
              {value || <span className="text-ghost">{placeholder}</span>}
            </span>
            <ChevronsUpDown className="ml-auto size-3.5 shrink-0 text-ghost" strokeWidth={1.5} />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="p-0 min-w-[12rem]">
          <Command>
            <CommandInput
              placeholder="Filter…"
              value={value}
              onValueChange={onChange}
            />
            <CommandList>
              <CommandEmpty>No results found.</CommandEmpty>
              <CommandGroup>
                {items.map((item) => (
                  <CommandItem
                    key={item}
                    value={item}
                    onSelect={() => {
                      onChange(item);
                      onCommit?.(item);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn("mr-2 h-4 w-4", value === item ? "opacity-100" : "opacity-0")}
                      strokeWidth={1.5}
                    />
                    {item}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {noMatch && (
        <p className="text-11 text-danger">No results for &ldquo;{value}&rdquo;</p>
      )}
    </div>
  );
}

