import { useEffect, useCallback } from "react";
import { Plus, ChevronDown, TriangleAlert, Settings } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatusDot } from "@/components/common/StatusDot";
import { EnvironmentPill } from "@/components/common/EnvironmentPill";
import { listProfiles, activateProfile, keychainStatus } from "@/lib/ipc";
import { useConnectionStore } from "@/stores/useConnectionStore";
import { usePlanExecutionStore } from "@/stores/usePlanExecutionStore";
import { findProfile, profileEnvironment } from "@/lib/profileSafety";
import type { SheetState } from "@/lib/workbench";

const DOT_TONE = {
  connected: "success",
  error: "danger",
  disconnected: "ghost",
} as const;

export function ConnectionPill({ onOpenSheet }: { onOpenSheet: (s: Exclude<SheetState, null>) => void }) {
  const {
    profiles,
    activeProfileName,
    connectionStatus,
    keychainError,
    setProfiles,
    setActiveProfile,
    setConnectionStatus,
    setKeychainError,
  } = useConnectionStore();

  useEffect(() => {
    listProfiles()
      .then(setProfiles)
      .catch(() => {
        // Profiles load failure is non-fatal on startup
      });
    keychainStatus()
      .then((status) => {
        if (status && status.available === false) {
          setKeychainError(status.error ?? "unknown error");
        }
      })
      .catch(() => {
        // Older backends without the command: assume the keychain works
      });
  }, [setProfiles, setKeychainError]);

  const handleQuickSwitch = useCallback(
    async (name: string) => {
      if (usePlanExecutionStore.getState().isRunning) {
        toast.warning("Cannot switch profile while a plan is running");
        return;
      }
      setActiveProfile(name);
      setConnectionStatus("disconnected");
      try {
        await activateProfile(name);
        setConnectionStatus("connected");
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        setConnectionStatus("error", message);
        toast.error(`Connection failed: ${message}`);
      }
    },
    [setActiveProfile, setConnectionStatus]
  );

  const activeProfile = findProfile(profiles, activeProfileName);
  const dotTone = DOT_TONE[connectionStatus] ?? "ghost";

  if (profiles.length === 0) {
    return (
      <button
        type="button"
        onClick={() => onOpenSheet({ mode: "new" })}
        className="flex h-[34px] items-center gap-2 rounded-full border border-dashed border-border-strong px-3 text-13 font-medium text-violet-bright hover:bg-primary/8"
      >
        <Plus size={14} strokeWidth={1.5} />
        Add connection
      </button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Connection"
          className="flex h-[34px] items-center gap-2.5 rounded-full border border-border bg-card pl-3 pr-1.5 text-13 transition-colors hover:border-border-strong"
        >
          <StatusDot tone={dotTone} glow={connectionStatus === "connected"} />
          <span className="font-medium whitespace-nowrap">{activeProfile?.name ?? "No profile"}</span>
          {activeProfile && (
            <span className="font-mono text-11 text-ghost whitespace-nowrap">{activeProfile.host}</span>
          )}
          {activeProfile && <EnvironmentPill environment={profileEnvironment(activeProfile)} />}
          {keychainError && (
            <span
              role="img"
              aria-label="Keychain unavailable"
              tabIndex={0}
              title={`Keychain unavailable: passwords are kept in memory for this session only (${keychainError})`}
              className="inline-flex"
            >
              <TriangleAlert size={14} strokeWidth={1.5} className="text-warning" />
            </span>
          )}
          <span className="inline-flex size-6 items-center justify-center text-muted-foreground">
            <ChevronDown size={14} strokeWidth={1.5} />
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56">
        {profiles.map((p) => (
          <DropdownMenuItem key={p.name} onSelect={() => void handleQuickSwitch(p.name)}>
            <StatusDot tone={p.name === activeProfileName ? "success" : "ghost"} size={6} />
            <span className="flex-1">{p.name}</span>
            <span className="font-mono text-11 text-ghost">{p.host}</span>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => onOpenSheet({ mode: "list" })}>
          <Settings size={14} strokeWidth={1.5} />
          Manage connections…
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
