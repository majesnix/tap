import { useState, useEffect, lazy, Suspense } from "react";
import { ThemeProvider, useTheme } from "next-themes";
import { load } from "@tauri-apps/plugin-store";
import { AppHeader } from "@/components/layout/AppHeader";
import { ComposeView } from "@/components/layout/ComposeView";
import { ProfileManagementModal } from "@/components/connection/ProfileManagementModal";
import { usePlanStore } from "@/stores/usePlanStore";
import { useDraftStore } from "@/stores/useDraftStore";
import type { WorkbenchView, SheetState } from "@/lib/workbench";

// The plan editor (with its own form tree and step editor) is only needed when the
// user opens Plans; keep it out of the chunk that every launch parses.
const PlanView = lazy(() =>
  import("@/components/plans/PlanView").then((m) => ({ default: m.PlanView }))
);
import { Toaster } from "@/components/ui/sonner";
import { UpdateChecker } from "./UpdateChecker";

export type { WorkbenchView, SheetState } from "@/lib/workbench";

const THEME_STORE_PATH = "tap.json";
const THEME_MODE_KEY = "theme-mode";
const VALID_THEMES: string[] = ["system", "light", "dark"];

// Exported for unit testing (ThemeBootstrap.test.tsx imports this directly)
export function ThemeBootstrap() {
  const { setTheme, theme } = useTheme();
  const [bootstrapped, setBootstrapped] = useState(false);

  // DRK-03: Read authoritative mode from tauri-plugin-store on startup.
  // Overrides whatever next-themes found in localStorage. Must complete
  // before mirror effect is allowed to write (bootstrapped flag).
  useEffect(() => {
    load(THEME_STORE_PATH)
      .then((store) => store.get<string>(THEME_MODE_KEY))
      .then((saved) => {
        if (saved && VALID_THEMES.includes(saved)) setTheme(saved);
      })
      .catch((err) => {
        // Log so the developer can diagnose; bootstrap still completes
        console.error("[ThemeBootstrap] Failed to load saved theme:", err);
      })
      .finally(() => {
        setBootstrapped(true);
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // DRK-03: Mirror each user-initiated change back to tauri-plugin-store.
  // MUST be gated on bootstrapped: without this guard, the effect fires
  // on first mount (theme = localStorage value) before the async bootstrap
  // read completes, clobbering the saved value with the stale localStorage
  // value (Pitfall 6 from 05-RESEARCH.md).
  useEffect(() => {
    if (!bootstrapped || !theme) return;
    load(THEME_STORE_PATH)
      .then((store) => store.set(THEME_MODE_KEY, theme).then(() => store.save()))
      .catch((err) => {
        console.error("[ThemeBootstrap] Failed to persist theme:", err);
      });
  }, [theme, bootstrapped]);

  return null;
}

export default function App() {
  const [view, setView] = useState<WorkbenchView>("compose");
  const [blocksOpen, setBlocksOpen] = useState(false);
  const [sheet, setSheet] = useState<SheetState>(null);

  const toggleBlocks = () => setBlocksOpen((v) => !v);

  // D-11: loadPlans() called at App mount so plan data is available immediately
  // on first navigation to the plan view. Pattern mirrors existing store loads.
  useEffect(() => {
    void usePlanStore.getState().loadPlans();
    void useDraftStore.getState().loadDrafts();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const header = (
    <AppHeader
      view={view}
      onViewChange={setView}
      blocksOpen={blocksOpen}
      onToggleBlocks={toggleBlocks}
      blocksDisabled={view !== "compose"}
      onOpenSheet={setSheet}
    />
  );

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <ThemeBootstrap />
      <UpdateChecker />
      {view === "compose"
        ? <ComposeView header={header} blocksOpen={blocksOpen} onToggleBlocks={toggleBlocks} />
        : (
          <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading plans…</div>}>
            <PlanView header={header} />
          </Suspense>
        )
      }
      <ProfileManagementModal open={sheet !== null} onClose={() => setSheet(null)} />
      <Toaster />
    </ThemeProvider>
  );
}
