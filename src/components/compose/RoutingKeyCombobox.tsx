import { useState } from "react";
import { ChevronsUpDown, Check, LoaderCircle } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Tag } from "@/components/common/Tag";
import { cn } from "@/lib/utils";

interface RoutingKeyComboboxProps {
  value: string;
  onChange: (value: string) => void;
  bindingKeys: string[];
  isLoading: boolean;
}

/**
 * Routing key input with live suggestions from the exchange's bindings.
 *
 * Free typing is always allowed — CommandInput is controlled through value + onValueChange,
 * so what the user types is the routing key, whether or not it matches a binding. Wildcard
 * bindings (`*` or `#`) are tagged and copied verbatim when picked. Errors never reach here:
 * the caller falls back to a plain input instead (D-10).
 */
export function RoutingKeyCombobox({
  value,
  onChange,
  bindingKeys,
  isLoading,
}: RoutingKeyComboboxProps) {
  const [open, setOpen] = useState(false);

  const isWildcard = (key: string): boolean => key.includes("*") || key.includes("#");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          className="flex h-9 w-[220px] items-center gap-2 rounded-md border border-border bg-background pl-3 pr-2 text-left transition-colors hover:border-border-strong focus-visible:ring-3 focus-visible:ring-ring/35"
        >
          <span className="text-11 text-ghost">key</span>
          <span className="flex-1 truncate font-mono text-[12.5px]" title={value || undefined}>
            {value || <span className="font-sans text-muted-foreground">Routing key</span>}
          </span>
          {isLoading ? (
            <LoaderCircle size={14} strokeWidth={1.5} className="shrink-0 animate-spin text-ghost" />
          ) : (
            <ChevronsUpDown size={14} strokeWidth={1.5} className="shrink-0 text-ghost" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) p-0">
        <Command>
          <CommandInput placeholder="Filter keys…" value={value} onValueChange={onChange} />
          <CommandList>
            <CommandEmpty>{isLoading ? "Loading…" : "No bindings found."}</CommandEmpty>
            <CommandGroup>
              {bindingKeys.map((key) => (
                <CommandItem
                  key={key}
                  value={key}
                  onSelect={() => {
                    // Copy the key exactly as the broker reports it, wildcards included.
                    onChange(key);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn("mr-2 size-4", value === key ? "opacity-100" : "opacity-0")}
                    strokeWidth={1.5}
                  />
                  <span className="flex-1 truncate font-mono text-12">{key}</span>
                  {isWildcard(key) && (
                    <Tag tone="warning" size="xs" className="ml-2 shrink-0">
                      pattern
                    </Tag>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
