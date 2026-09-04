import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon, Monitor } from "lucide-react";
import { IconButton } from "@/components/common/IconButton";

type ThemeMode = "system" | "light" | "dark";

const CYCLE_ORDER: ThemeMode[] = ["system", "light", "dark"];

const ICONS: Record<ThemeMode, React.ReactNode> = {
  system: <Monitor size={17} strokeWidth={1.5} />,
  light: <Sun size={17} strokeWidth={1.5} />,
  dark: <Moon size={17} strokeWidth={1.5} />,
};

const LABELS: Record<ThemeMode, string> = {
  system: "System theme",
  light: "Light theme",
  dark: "Dark theme",
};

export function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();

  useEffect(() => setMounted(true), []);

  // Return same-size placeholder before mount to avoid layout shift (Pitfall 1)
  if (!mounted) {
    return <IconButton size={32} label="Theme" disabled />;
  }

  const raw = theme ?? "system";
  const current: ThemeMode = CYCLE_ORDER.includes(raw as ThemeMode)
    ? (raw as ThemeMode)
    : "system";
  const nextIndex = (CYCLE_ORDER.indexOf(current) + 1) % CYCLE_ORDER.length;
  const nextMode = CYCLE_ORDER[nextIndex];

  return (
    <IconButton size={32} label={LABELS[current]} onClick={() => setTheme(nextMode)}>
      {ICONS[current]}
    </IconButton>
  );
}
