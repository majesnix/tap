import { useState, type ReactNode } from "react";
import { ChevronsUpDown, Check } from "lucide-react";
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

export interface SearchableSelectItem {
  /** The queue/exchange name — also the cmdk filter key and the committed value. */
  value: string;
  /** Optional trailing element rendered after the label (e.g. an exchange [type] badge). */
  badge?: ReactNode;
}

interface SearchableSelectProps {
  items: SearchableSelectItem[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  className?: string;
  disabled?: boolean;
  /** Trailing hint rendered after the value on the trigger (e.g. a message count). */
  meta?: ReactNode;
  /** Renders the value in the monospace type scale used for queue/exchange names. */
  mono?: boolean;
  size?: "sm" | "md";
}

const SIZE_CLASS = { sm: "h-[34px]", md: "h-9" } as const;

/**
 * Filter-as-you-type combobox over a known list of values (queues/exchanges).
 *
 * Filter-only: typing narrows the list; selection commits the item's exact `value`.
 * We pass `item.value` to onChange (not the cmdk onSelect argument) so names keep
 * their original casing — cmdk lowercases the value it hands back to onSelect.
 */
export function SearchableSelect({
  items,
  value,
  onChange,
  placeholder = "Select…",
  searchPlaceholder = "Filter…",
  emptyText = "No results.",
  className,
  disabled = false,
  meta,
  mono = true,
  size = "md",
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "flex w-48 items-center gap-2 rounded-md border border-border bg-background pl-3 pr-2 text-left transition-colors hover:border-border-strong focus-visible:ring-3 focus-visible:ring-ring/35 disabled:opacity-50",
            SIZE_CLASS[size],
            className
          )}
        >
          <span
            className={cn("flex-1 truncate", mono && "font-mono text-[12.5px]")}
            title={value || undefined}
          >
            {value || <span className="text-muted-foreground">{placeholder}</span>}
          </span>
          {meta && <span className="font-mono text-11 text-ghost">{meta}</span>}
          <ChevronsUpDown size={14} className="shrink-0 text-ghost" />
        </button>
      </PopoverTrigger>
      <PopoverContent className={cn("w-(--radix-popover-trigger-width) p-0", className)}>
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {items.map((item) => (
                <CommandItem
                  key={item.value}
                  value={item.value}
                  onSelect={() => {
                    onChange(item.value);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === item.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="flex-1 truncate" title={item.value}>
                    {item.value}
                  </span>
                  {item.badge}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
