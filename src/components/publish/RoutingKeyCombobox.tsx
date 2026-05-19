import { useState } from "react";
import { ChevronsUpDown, Check, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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

interface RoutingKeyComboboxProps {
  value: string;
  onChange: (value: string) => void;
  bindingKeys: string[];
  isLoading: boolean;
}

/**
 * Combobox widget for routing key input — shows live suggestions from exchange bindings.
 *
 * D-01: Replaces plain <Input> when eligible suggestions are available.
 * D-02: Free-type is always permitted — CommandInput is controlled via value + onValueChange.
 * D-07: isWildcard identifies binding keys containing * or # characters.
 * D-08: Wildcard patterns (containing * or #) show an amber "pattern" badge.
 * D-09: Selecting a wildcard pattern copies it as-is into value.
 * D-10: Caller handles errors — component receives pre-fetched bindingKeys.
 */
export function RoutingKeyCombobox({
  value,
  onChange,
  bindingKeys,
  isLoading,
}: RoutingKeyComboboxProps) {
  const [open, setOpen] = useState(false);

  const isWildcard = (key: string): boolean =>
    key.includes("*") || key.includes("#");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-48 h-9 justify-between border-input bg-background font-normal"
        >
          <span className="truncate text-left flex-1">
            {value || <span className="text-muted-foreground">Routing key</span>}
          </span>
          {isLoading ? (
            <Loader2 className="ml-auto h-4 w-4 animate-spin text-muted-foreground shrink-0" />
          ) : (
            <ChevronsUpDown className="ml-auto h-4 w-4 shrink-0 text-muted-foreground" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-0">
        <Command>
          {/* CRITICAL: Controlled CommandInput enables free-type (D-02).
              value + onValueChange sync typing directly to parent state.
              Without this, the canonical shadcn demo only updates on selection. */}
          <CommandInput
            placeholder="Filter keys…"
            value={value}
            onValueChange={onChange}
          />
          <CommandList>
            <CommandEmpty>
              {isLoading ? "Loading…" : "No bindings found."}
            </CommandEmpty>
            <CommandGroup>
              {bindingKeys.map((key) => (
                <CommandItem
                  key={key}
                  value={key}
                  onSelect={(selectedKey) => {
                    // D-09: copy exact key string as-is (wildcard patterns included)
                    onChange(selectedKey);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === key ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="flex-1 truncate">{key}</span>
                  {isWildcard(key) && (
                    // D-08: amber badge for wildcard patterns (* or # in key)
                    <Badge className="ml-2 bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-300 font-semibold shrink-0">
                      pattern
                    </Badge>
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
