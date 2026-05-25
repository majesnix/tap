import { Input } from "@/components/ui/input";

interface HistoryFilterBarProps {
  typeFilter: string;
  targetFilter: string;
  onTypeChange: (query: string) => void;
  onTargetChange: (query: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export function HistoryFilterBar({
  typeFilter,
  targetFilter,
  onTypeChange,
  onTargetChange,
  searchQuery,
  onSearchChange,
}: HistoryFilterBarProps) {
  return (
    <div className="flex flex-col">
      <div className="px-3 pt-2 pb-0 border-b border-border">
        <Input
          aria-label="Full-text search"
          placeholder="Search…"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="h-7 text-xs w-full"
        />
      </div>
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
        <Input
          placeholder="Filter by type…"
          value={typeFilter}
          onChange={(e) => onTypeChange(e.target.value)}
          className="h-7 text-xs flex-1"
        />
        <Input
          placeholder="Filter by queue/exchange…"
          value={targetFilter}
          onChange={(e) => onTargetChange(e.target.value)}
          className="h-7 text-xs flex-1"
        />
      </div>
    </div>
  );
}
