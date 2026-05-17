import { useEffect, useState } from "react";
import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { listProfiles, activateProfile } from "@/lib/ipc";
import { useConnectionStore } from "@/stores/useConnectionStore";
import { ProfileManagementModal } from "@/components/connection/ProfileManagementModal";

const STATUS_DOT_CLASS: Record<string, string> = {
  connected: "bg-emerald-500",
  error: "bg-destructive",
  disconnected: "bg-muted-foreground",
};

const STATUS_TEXT: Record<string, string> = {
  connected: "Connected",
  error: "Error",
  disconnected: "Not connected",
};

export function ConnectionSection() {
  const { profiles, activeProfileName, connectionStatus, setProfiles, setActiveProfile, setConnectionStatus } =
    useConnectionStore();
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    listProfiles()
      .then(setProfiles)
      .catch(() => {
        // Profiles load failure is non-fatal on startup
      });
  }, [setProfiles]);

  const handleProfileChange = async (name: string) => {
    setActiveProfile(name);
    setConnectionStatus("disconnected");
    try {
      await activateProfile(name);
      setConnectionStatus("connected");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setConnectionStatus("error", message);
    }
  };

  const dotClass = STATUS_DOT_CLASS[connectionStatus] ?? "bg-muted-foreground";
  const statusText = STATUS_TEXT[connectionStatus] ?? "Not connected";

  if (profiles.length === 0) {
    return (
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">Add connection</p>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setDialogOpen(true)}
          aria-label="Manage connection profiles"
        >
          <Settings className="w-4 h-4" />
        </Button>
        <ProfileManagementModal open={dialogOpen} onClose={() => setDialogOpen(false)} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-semibold">Connection</label>
      <Select value={activeProfileName ?? ""} onValueChange={handleProfileChange}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Select connection…" />
        </SelectTrigger>
        <SelectContent>
          {profiles.map((p) => (
            <SelectItem key={p.name} value={p.name}>
              {p.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${dotClass}`} />
        <span className="text-xs text-muted-foreground">{statusText}</span>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setDialogOpen(true)}
          aria-label="Manage connection profiles"
        >
          <Settings className="w-4 h-4" />
        </Button>
      </div>
      <ProfileManagementModal open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </div>
  );
}
