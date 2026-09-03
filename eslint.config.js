// @ts-check
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";

export default tseslint.config(
  { ignores: ["dist/**", "src-tauri/**", "node_modules/**", "coverage/**", "src/components/ui/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks },
    languageOptions: {
      globals: { ...globals.browser, ...globals.es2021 },
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // Existing code opts out of exhaustive-deps deliberately in a few places with
      // comments explaining why; keep those as warnings, not errors.
      "react-hooks/exhaustive-deps": "warn",
      // Rules that ship with eslint-plugin-react-hooks 7 (React Compiler heuristics).
      // They flag long-standing patterns here (setState in mount effects, refs read
      // during render); tracked as warnings until those components are reworked.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/incompatible-library": "warn",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
  {
    files: ["src/**/*.test.{ts,tsx}", "src/**/__tests__/**/*.{ts,tsx}", "src/test/**"],
    languageOptions: { globals: { ...globals.node } },
    rules: { "@typescript-eslint/no-explicit-any": "off", "react-hooks/rules-of-hooks": "off" },
  }
);
