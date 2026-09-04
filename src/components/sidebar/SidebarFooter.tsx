import { useState, useEffect } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { RefreshCw } from "lucide-react";
import { IconButton } from "@/components/common/IconButton";
import { ClearLocalDataButton } from "@/components/sidebar/ClearLocalDataButton";
import { RELEASE_NAME } from "@/lib/release";
import { runUpdateCheck } from "@/UpdateChecker";
import { usePlatformLabel } from "@/hooks/usePlatformLabel";

/**
 * Sidebar footer: version + release name, an update-check button (non-mac
 * only) and ClearLocalDataButton. Self-contained (no props) so it can be
 * reused as-is for the Plans sidebar.
 */
export function SidebarFooter() {
  const { isMac } = usePlatformLabel();
  const [appVersion, setAppVersion] = useState("");

  useEffect(() => {
    getVersion()
      .then(setAppVersion)
      .catch(() => {});
  }, []);

  return (
    <div className="flex items-center justify-between px-2 text-11 text-ghost whitespace-nowrap">
      <span>
        {appVersion ? `v${appVersion} · ` : ""}
        {RELEASE_NAME}
      </span>
      <div className="flex items-center gap-0.5">
        {!isMac && (
          <IconButton
            size={24}
            label="Check for updates"
            onClick={() => void runUpdateCheck({ manual: true })}
          >
            <RefreshCw size={14} strokeWidth={1.5} />
          </IconButton>
        )}
        <ClearLocalDataButton />
      </div>
    </div>
  );
}
