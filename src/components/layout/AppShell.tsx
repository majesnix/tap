import type { ReactNode } from "react";

interface AppShellProps {
  header: ReactNode;
  sidebar: ReactNode;
  drawer?: ReactNode;
  main: ReactNode;
  aside: ReactNode;
}

/**
 * The top-level workbench layout: a fixed-height header, a fixed-width sidebar,
 * an optional drawer (Blocks library), a flexible main area and a fixed-width
 * aside (Activity/RightPanel). Every view (Compose, Plans) renders through this.
 */
export function AppShell({ header, sidebar, drawer, main, aside }: AppShellProps) {
  return (
    <div className="flex h-screen w-screen min-w-[1240px] flex-col overflow-hidden bg-background text-foreground">
      {header}
      <div className="flex flex-1 min-h-0">
        <aside className="flex w-[272px] shrink-0 flex-col border-r border-border overflow-hidden">
          {sidebar}
        </aside>
        {drawer}
        <main className="flex min-w-0 flex-1 flex-col">{main}</main>
        <aside className="flex w-[360px] shrink-0 flex-col border-l border-border min-h-0">
          {aside}
        </aside>
      </div>
    </div>
  );
}
