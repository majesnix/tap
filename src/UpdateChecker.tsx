import { useEffect } from "react";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { listen } from "@tauri-apps/api/event";
import { toast } from "sonner";

function showUpdateToast(update: Awaited<ReturnType<typeof check>>) {
  if (!update?.available) return;
  toast(`Update ${update.version} available`, {
    description: update.body ?? "A new version is ready to install.",
    action: {
      label: "Install & Relaunch",
      onClick: () => {
        update
          .downloadAndInstall()
          .then(() => relaunch())
          .catch((err: unknown) => console.error("Install failed:", err));
      },
    },
    duration: Infinity,
  });
}

export async function runUpdateCheck({ manual = false } = {}) {
  try {
    const update = await check();
    if (update?.available) {
      showUpdateToast(update);
    } else if (manual) {
      toast("You're up to date", { description: "No updates available." });
    }
  } catch (err: unknown) {
    if (manual) {
      toast.error(`Update check failed: ${String(err)}`);
    } else {
      console.error("Update check failed:", err);
    }
  }
}

export function UpdateChecker() {
  useEffect(() => {
    runUpdateCheck();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const unlisten = listen("check-for-updates", () => {
      runUpdateCheck({ manual: true });
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
