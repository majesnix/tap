import { useState, useEffect } from "react";
import { ThemeProvider, useTheme } from "next-themes";
import { load } from "@tauri-apps/plugin-store";
import { AppLayout } from "@/components/layout/AppLayout";
import { Toaster } from "@/components/ui/sonner";
import { UpdateChecker } from "./UpdateChecker";

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
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <ThemeBootstrap />
      <UpdateChecker />
      <AppLayout />
      <Toaster />
    </ThemeProvider>
  );
}
