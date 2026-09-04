#!/usr/bin/env node
// Fail when a Tauri crate and its npm counterpart drift apart at major.minor.
//
// Dependabot bumps the cargo and npm ecosystems in separate pull requests, and
// the Tauri CLI refuses to build once e.g. tauri-plugin-updater 2.11 meets
// @tauri-apps/plugin-updater 2.10. CI only runs cargo test and vitest, which
// never notice. This check runs after `pnpm install` and reads the versions
// that are actually resolved: Cargo.lock for the crates, node_modules for the
// packages.
//
// Usage: node scripts/check-tauri-versions.mjs [Cargo.lock] [node_modules]

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const cargoLockPath = process.argv[2] ?? "src-tauri/Cargo.lock";
const nodeModulesDir = process.argv[3] ?? "node_modules";

/** Crates that have an npm package whose minor version must match. */
const CRATE_TO_PACKAGE = {
  tauri: "@tauri-apps/api",
  "tauri-plugin-dialog": "@tauri-apps/plugin-dialog",
  "tauri-plugin-fs": "@tauri-apps/plugin-fs",
  "tauri-plugin-opener": "@tauri-apps/plugin-opener",
  "tauri-plugin-process": "@tauri-apps/plugin-process",
  "tauri-plugin-store": "@tauri-apps/plugin-store",
  "tauri-plugin-updater": "@tauri-apps/plugin-updater",
};

/** `[[package]]` entries of Cargo.lock as { name → version }. */
export function parseCargoLock(text) {
  const versions = new Map();
  for (const block of text.split("[[package]]")) {
    const name = /^name = "([^"]+)"/m.exec(block)?.[1];
    const version = /^version = "([^"]+)"/m.exec(block)?.[1];
    if (name && version && !versions.has(name)) versions.set(name, version);
  }
  return versions;
}

/** "2.11.5" → "2.11" */
export function majorMinor(version) {
  return version.split(".").slice(0, 2).join(".");
}

/**
 * Compare every mapped crate with its installed npm package.
 * Returns the human-readable mismatches; an empty array means aligned.
 */
export function findMismatches(crateVersions, readPackageVersion) {
  const mismatches = [];
  for (const [crate, pkg] of Object.entries(CRATE_TO_PACKAGE)) {
    const crateVersion = crateVersions.get(crate);
    const pkgVersion = readPackageVersion(pkg);
    if (!crateVersion || !pkgVersion) continue; // not used on one side
    if (majorMinor(crateVersion) !== majorMinor(pkgVersion)) {
      mismatches.push(`${crate} (v${crateVersion}) : ${pkg} (v${pkgVersion})`);
    }
  }
  return mismatches;
}

function installedVersion(pkg) {
  const manifest = join(nodeModulesDir, pkg, "package.json");
  if (!existsSync(manifest)) return null;
  return JSON.parse(readFileSync(manifest, "utf8")).version;
}

const isEntrypoint = process.argv[1]?.endsWith("check-tauri-versions.mjs");
if (isEntrypoint) {
  const crates = parseCargoLock(readFileSync(cargoLockPath, "utf8"));
  const mismatches = findMismatches(crates, installedVersion);
  if (mismatches.length > 0) {
    console.error("Tauri crate and npm package versions differ at major.minor:");
    for (const line of mismatches) console.error(`  ${line}`);
    console.error("Bump the lagging side so both ecosystems agree before building.");
    process.exit(1);
  }
  console.log(`Tauri crates and npm packages aligned (${Object.keys(CRATE_TO_PACKAGE).length} pairs checked).`);
}
