import { useState, useEffect } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { useProtoStore } from "@/stores/useProtoStore";
import { FileSection } from "@/components/sidebar/FileSection";
import { ConnectionSection } from "@/components/sidebar/ConnectionSection";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "@/components/sidebar/ThemeToggle";
import { Button } from "@/components/ui/button";
import { RefreshCw, ListChecks } from "lucide-react";
import { cn } from "@/lib/utils";
import { RELEASE_NAME } from "@/lib/release";
import { runUpdateCheck } from "@/UpdateChecker";
import { usePlatformLabel } from "@/hooks/usePlatformLabel";

interface SidebarProps {
  viewMode?: "main" | "plans";
  onViewChange?: (mode: "main" | "plans") => void;
}

export function Sidebar({ viewMode, onViewChange }: SidebarProps) {
  const { isMac } = usePlatformLabel();
  const { schema, selectedMessageType, setSelectedType } = useProtoStore();
  const [appVersion, setAppVersion] = useState<string>("");

  useEffect(() => {
    getVersion().then(setAppVersion).catch(() => {});
  }, []);

  return (
    <div className="flex flex-col h-full p-4 gap-4">
      <div className="flex flex-col gap-2">
        <h1 className="text-lg font-semibold">Tap</h1>
        <p className="text-xs text-muted-foreground">
          Load a .proto file to get started
        </p>
      </div>

      {/* Plans nav button — toggle: active state when viewMode === "plans", click toggles to main or plans */}
      <Button
        variant="ghost"
        className={cn(
          "w-full justify-start gap-2",
          viewMode === "plans" && "bg-accent text-accent-foreground"
        )}
        onClick={() => onViewChange?.(viewMode === "plans" ? "main" : "plans")}
      >
        <ListChecks size={16} />
        Plans
      </Button>

      <Separator />

      <FileSection />

      {schema && schema.messages.length > 0 && (
        <>
          <Separator />
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">Message Type</label>
            <Select
              value={selectedMessageType ?? ""}
              onValueChange={setSelectedType}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select message..." />
              </SelectTrigger>
              <SelectContent>
                {schema.messages.map((msg) => (
                  <SelectItem key={msg.full_name} value={msg.full_name}>
                    {msg.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </>
      )}

      {/* Connection panel: profile dropdown + status dot + manage button */}
      <Separator />
      <ConnectionSection />

      <div className="flex-1" />
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">
          {appVersion ? `v${appVersion}` : "v1.3.0"} — {RELEASE_NAME}
        </div>
        <div className="flex items-center gap-1">
          {!isMac && (
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={() => runUpdateCheck({ manual: true })}
              aria-label="Check for updates"
              title="Check for updates"
            >
              <RefreshCw className="size-4" />
            </Button>
          )}
          <ThemeToggle />
        </div>
      </div>
    </div>
  );
}
