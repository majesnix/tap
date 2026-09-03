/**
 * Shared workbench shell types. Living in their own module (rather than
 * `src/App.tsx`) lets every component import them without creating an
 * import cycle back through App.tsx.
 */
export type WorkbenchView = "compose" | "plans";

export type SheetState = null | { mode: "list" } | { mode: "new" } | { mode: "edit"; profile: string };
