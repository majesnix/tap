import { useState, type ReactNode } from "react";
import { ChevronsUpDown, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
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
}

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
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-48 h-9 justify-between border-input bg-background font-normal",
            className
          )}
        >
          <span className="truncate text-left flex-1" title={value || undefined}>
            {value || <span className="text-muted-foreground">{placeholder}</span>}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className={cn("w-48 p-0", className)}>
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
