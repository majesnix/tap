import { useEffect } from "react";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { toast } from "sonner";

// Exported for unit testing (mirrors ThemeBootstrap export pattern in App.tsx)
// Returns null — this is a startup effect component with no rendered output.
export function UpdateChecker() {
  useEffect(() => {
    // Non-blocking background check; fires once on mount.
    // React 18 StrictMode fires twice in dev — check() is idempotent.
    check()
      .then((update) => {
        if (!update?.available) return;
        toast(`Update ${update.version} available`, {
          description: update.body ?? "A new version is ready to install.",
          action: {
            label: "Install & Relaunch",
            onClick: () => {
              update
                .downloadAndInstall()
                .then(() => relaunch())
                .catch((err: unknown) =>
                  console.error("Install failed:", err)
                );
            },
          },
          duration: Infinity,
        });
      })
      .catch((err: unknown) => {
        // Silent: update check failure (including 404 before first published release)
        // must not surface to user. App functionality must not be affected.
        console.error("Update check failed:", err);
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
