import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";

type ThemeMode = "system" | "light" | "dark";

const CYCLE_ORDER: ThemeMode[] = ["system", "light", "dark"];

const ICONS: Record<ThemeMode, React.ReactNode> = {
  system: <Monitor className="size-4" />,
  light: <Sun className="size-4" />,
  dark: <Moon className="size-4" />,
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
    return <Button variant="ghost" size="icon" className="size-8" disabled />;
  }

  const current = (theme as ThemeMode) ?? "system";
  const nextIndex = (CYCLE_ORDER.indexOf(current) + 1) % CYCLE_ORDER.length;
  const nextMode = CYCLE_ORDER[nextIndex];

  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-8"
      onClick={() => setTheme(nextMode)}
      aria-label={LABELS[current]}
      title={LABELS[current]}
    >
      {ICONS[current]}
    </Button>
  );
}
