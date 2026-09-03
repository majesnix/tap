/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
  plugins: [react(), tailwindcss()],

  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },

  // Vite options tailored for Tauri development
  clearScreen: false,

  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**", "**/examples/**", "**/.planning/**"],
    },
  },

  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    // Agent worktrees live under .claude/worktrees inside the repo; never collect their tests.
    exclude: ["**/node_modules/**", "**/dist/**", "**/.claude/**", "**/src-tauri/**"],
    coverage: {
      // Ratchet: set just below the measured coverage so it can only go up.
      // Raise these as the plan and history UIs gain tests.
      thresholds: { statements: 78, branches: 70, functions: 76, lines: 79 },
      exclude: ["src/components/ui/**", "src/test/**", "src/**/*.test.*", "src/**/__tests__/**", "src/vite-env.d.ts", "src/main.tsx"],
    },
  },
});
