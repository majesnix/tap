import { useState } from "react";
import { Binary, RotateCcw } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HexViewDialog } from "./HexViewDialog";
import type { HistoryEntry } from "@/stores/useHistoryStore";

interface HistoryTableProps {
  entries: HistoryEntry[];
  isFiltered?: boolean;
  onReplay?: (entry: HistoryEntry) => void; // Row click — pre-fill form only (no send)
  onResend?: (entry: HistoryEntry) => void; // Resend button — republish stored bytes immediately
}

export function HistoryTable({
  entries,
  isFiltered,
  onReplay,
  onResend,
}: HistoryTableProps) {
  const [selectedEntry, setSelectedEntry] = useState<HistoryEntry | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleHexClick = (e: React.MouseEvent, entry: HistoryEntry) => {
    e.stopPropagation(); // Prevent row click from firing
    setSelectedEntry(entry);
    setDialogOpen(true);
  };

  if (entries.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground text-xs p-4 text-center">
        {isFiltered
          ? "No entries match the current filter."
          : "No messages sent yet. Send a message to see history here."}
      </div>
    );
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-xs">Time</TableHead>
            <TableHead className="text-xs">Type</TableHead>
            <TableHead className="text-xs">Target</TableHead>
            <TableHead className="text-xs">Status</TableHead>
            <TableHead className="text-xs w-16"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((entry) => (
            <TableRow
              key={entry.id}
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => onReplay?.(entry)}
            >
              <TableCell className="text-xs font-mono text-muted-foreground">
                {entry.timestamp.slice(11, 19)}
              </TableCell>
              <TableCell
                className="text-xs truncate max-w-24"
                title={entry.messageTypeName}
              >
                {entry.messageTypeName.split(".").pop() ?? entry.messageTypeName}
              </TableCell>
              <TableCell className="text-xs truncate max-w-24">
                {entry.exchange
                  ? `${entry.exchange} → ${entry.routingKey}`
                  : entry.routingKey}
              </TableCell>
              <TableCell>
                {entry.status === "sent" ? (
                  <Badge className="text-xs bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                    Sent
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="text-xs">
                    Failed
                  </Badge>
                )}
              </TableCell>
              <TableCell>
                <div className="flex gap-1 items-center">
                  {onResend && (
                    <Button
                      variant="default"
                      size="icon"
                      className="h-6 w-6"
                      onClick={(e) => {
                        e.stopPropagation();
                        onResend(entry);
                      }}
                      title="Resend this message"
                    >
                      <RotateCcw className="h-3 w-3" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={(e) => handleHexClick(e, entry)}
                    title="View binary payload"
                  >
                    <Binary className="h-3 w-3" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <HexViewDialog
        entry={selectedEntry}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </>
  );
}
