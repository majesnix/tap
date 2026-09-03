import { useEffect, useMemo, useRef, useState } from "react";
import { Download, Search } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { SectionLabel } from "@/components/common/SectionLabel";
import { SegmentedControl } from "@/components/common/SegmentedControl";
import { useDebounce } from "@/hooks/useDebounce";
import { useHistoryStore } from "@/stores/useHistoryStore";
import { useResponseStore } from "@/stores/useResponseStore";
import { useProtoStore } from "@/stores/useProtoStore";
import type { ComposeSignals } from "@/components/layout/ComposeView";
import type { FeedMode } from "@/lib/types";
import { ActivityRow } from "./ActivityRow";
import { ReadModePopover } from "./ReadModePopover";
import { useActivityActions } from "./useActivityActions";
import {
  activityGroups,
  buildActivity,
  summarizeActivity,
  type ActivityFilter,
} from "./activityModel";

const FILTER_DEBOUNCE_MS = 150;
const HIGHLIGHT_MS = 1500;

const FILTER_ITEMS = [
  { value: "all" as const, label: "All" },
  { value: "sent" as const, label: "Sent" },
  { value: "received" as const, label: "Received" },
];

/**
 * The right-hand timeline: everything Tap has sent and received, newest first,
 * with each reply grouped under the request it answers.
 */
export function ActivityPanel({ signals }: { signals: ComposeSignals }) {
  const [filter, setFilter] = useState<ActivityFilter>("all");
  const [query, setQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedReplyId, setExpandedReplyId] = useState<string | null>(null);
  const [readModeOpen, setReadModeOpen] = useState(false);
  const [mode, setMode] = useState<FeedMode>("tap");
  const [clearOpen, setClearOpen] = useState(false);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  const filterRef = useRef<HTMLInputElement>(null);
  const debouncedQuery = useDebounce(query, FILTER_DEBOUNCE_MS);

  const entries = useHistoryStore((s) => s.entries);
  const historyLoaded = useHistoryStore((s) => s.historyLoaded);
  const loadHistory = useHistoryStore((s) => s.loadHistory);
  const messages = useResponseStore((s) => s.messages);
  const lastSendAt = useProtoStore((s) => s.lastSendAt);

  const actions = useActivityActions();

  useEffect(() => {
    if (!historyLoaded) void loadHistory();
  }, [historyLoaded, loadHistory]);

  // mod+1 / mod+3 reach the panel through refs owned by ComposeView.
  useEffect(() => {
    signals.focusFilter.current = () => filterRef.current?.focus();
    return () => {
      signals.focusFilter.current = null;
    };
  }, [signals]);

  useEffect(() => {
    signals.toggleReadMode.current = () => setReadModeOpen((v) => !v);
    return () => {
      signals.toggleReadMode.current = null;
    };
  }, [signals]);

  const items = useMemo(() => buildActivity(entries, messages), [entries, messages]);
  const groups = useMemo(
    () => activityGroups(items, filter, debouncedQuery),
    [items, filter, debouncedQuery]
  );

  // After a send, flash the row it produced rather than switching panels.
  const prevSendAt = useRef<number | null>(lastSendAt);
  useEffect(() => {
    if (lastSendAt === null || lastSendAt === prevSendAt.current) return;
    prevSendAt.current = lastSendAt;
    const newest = useHistoryStore.getState().entries[0];
    if (!newest) return;
    setHighlightedId(newest.id);
    const timer = setTimeout(() => setHighlightedId(null), HIGHLIGHT_MS);
    return () => clearTimeout(timer);
  }, [lastSendAt]);

  // Received rows already on screen at mount stay put; anything arriving later
  // slides in. The CSS animation runs once, when the class is first applied.
  const [initialMessageIds] = useState(() => new Set(messages.map((m) => m.id)));
  const isNew = (id: string, kind: string) => kind === "received" && !initialMessageIds.has(id);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 p-[16px_16px_10px]">
        <SectionLabel>Activity</SectionLabel>
        <div className="flex-1" />
        <SegmentedControl
          aria-label="Activity filter"
          size="xs"
          value={filter}
          onChange={setFilter}
          items={FILTER_ITEMS}
        />
      </div>

      <div className="flex items-center gap-2 px-4 pb-2.5">
        <label className="flex h-[30px] flex-1 items-center gap-1.5 rounded-md border border-border bg-card px-2.5 text-12 text-ghost focus-within:border-border-strong">
          <Search size={13} strokeWidth={1.5} />
          <input
            ref={filterRef}
            // type=search keeps this out of the form's textbox role, where the
            // proto field inputs live.
            type="search"
            aria-label="Filter activity"
            placeholder="Filter type, target, payload…"
            className="min-w-0 flex-1 bg-transparent text-12 text-foreground outline-none [&::-webkit-search-cancel-button]:hidden"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <ReadModePopover
          open={readModeOpen}
          onOpenChange={setReadModeOpen}
          mode={mode}
          onModeChange={setMode}
        />
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto">
        {groups.length === 0 ? (
          <p className="p-4 text-12 text-ghost">
            {items.length === 0
              ? "Sent and received messages appear here as one timeline."
              : "Nothing matches the filter."}
          </p>
        ) : (
          groups.map((group) => (
            <ActivityRow
              key={group.item.id}
              group={group}
              expanded={expandedId === group.item.id}
              replyExpanded={group.reply !== null && expandedReplyId === group.reply.id}
              highlighted={group.item.id === highlightedId}
              slideIn={isNew(group.item.id, group.item.kind)}
              onToggle={() =>
                setExpandedId((current) => (current === group.item.id ? null : group.item.id))
              }
              onToggleReply={() =>
                setExpandedReplyId((current) =>
                  group.reply && current === group.reply.id ? null : (group.reply?.id ?? null)
                )
              }
              actions={actions}
            />
          ))
        )}
      </div>

      <div className="flex items-center justify-between border-t border-border p-[10px_16px] text-11 whitespace-nowrap text-ghost">
        <span>{summarizeActivity(items)}</span>
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground disabled:opacity-50"
            disabled={items.length === 0}
            onClick={() => setClearOpen(true)}
          >
            Clear
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1 text-12 text-muted-foreground hover:text-foreground disabled:opacity-50"
            disabled={groups.length === 0}
            onClick={() => void actions.exportVisible(groups)}
          >
            <Download size={12} strokeWidth={1.5} />
            Export
          </button>
        </div>
      </div>

      <AlertDialog open={clearOpen} onOpenChange={setClearOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear activity?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes every sent and received message from the timeline. Sent messages are
              also removed from the saved history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                setClearOpen(false);
                void actions.clearAll();
              }}
            >
              Clear
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
