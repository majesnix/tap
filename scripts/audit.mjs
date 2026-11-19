#!/usr/bin/env node
// Audit the Rust and npm production dependencies for known advisories.
//
// Usage: node scripts/audit.mjs [--base <git-ref>]
//
// Without --base every advisory fails the run. That is what main and the
// scheduled run use: a red result there means main itself needs a fix.
//
// With --base only advisories the checked-out tree adds on top of <git-ref>
// fail the run. That is what pull requests use: an update that brings in a
// vulnerable version is blocked, while an advisory published against a
// version main already ships is reported as a warning and blocks nothing.
// Those are repaired on main by .github/workflows/audit-fix.yml (Rust) and
// Dependabot security updates (npm).
//
// Ignored Rust advisories live in .cargo/audit.toml. npm fails at high and
// above; development-only advisories never ship in the bundle (--prod).

import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  describeAdvisory,
  parseCargoAudit,
  parsePnpmAudit,
  splitAdvisories,
} from "./lib/advisories.mjs";

const CARGO_LOCK = "src-tauri/Cargo.lock";
const NPM_FILES = ["package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml"];
const USAGE = "Usage: node scripts/audit.mjs [--base <git-ref>]";

function parseArgs(args) {
  if (args.length === 0) return { base: null };
  if (args.length === 2 && args[0] === "--base" && args[1]) return { base: args[1] };
  throw new Error(USAGE);
}

/**
 * Run an audit tool and parse its JSON report. Both tools exit non-zero when
 * they find advisories, so the exit code is not an error signal; output that
 * is not JSON is.
 */
function runJson(command, args, cwd, requiredKey) {
  const result = spawnSync(command, args, { cwd, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (result.error) throw new Error(`Cannot run ${command}: ${result.error.message}`);
  const invocation = `${command} ${args.join(" ")}`;
  let parsed;
  try {
    parsed = JSON.parse(result.stdout);
  } catch {
    throw new Error(`${invocation} did not return JSON:\n${result.stderr || result.stdout}`);
  }
  // A registry or network failure also prints JSON; never read that as "clean".
  if (typeof parsed?.[requiredKey] !== "object" || parsed[requiredKey] === null) {
    throw new Error(`${invocation} returned no "${requiredKey}" section:\n${result.stdout.slice(0, 2000)}`);
  }
  return parsed;
}

function fileAtRef(ref, path) {
  return execFileSync("git", ["show", `${ref}:${path}`], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
}

/** Copy the given files as they are at `ref` into `dir`, skipping ones the ref does not have. */
function checkoutFiles(ref, paths, dir) {
  for (const path of paths) {
    try {
      writeFileSync(join(dir, path.split("/").pop()), fileAtRef(ref, path));
    } catch (error) {
      if (path === "pnpm-workspace.yaml") continue; // optional file
      throw new Error(`Cannot read ${path} at ${ref}: ${error.message}`);
    }
  }
}

function auditRust(lockfile) {
  // Runs from the repo root so .cargo/audit.toml applies to any lockfile.
  return parseCargoAudit(runJson("cargo", ["audit", "--json", "-f", lockfile], undefined, "vulnerabilities"));
}

function auditNpm(cwd) {
  return parsePnpmAudit(runJson("pnpm", ["audit", "--prod", "--audit-level=high", "--json"], cwd, "advisories"));
}

function auditBase(ref) {
  const dir = mkdtempSync(join(tmpdir(), "tap-audit-base-"));
  try {
    checkoutFiles(ref, [CARGO_LOCK, ...NPM_FILES], dir);
    return { rust: auditRust(join(dir, "Cargo.lock")), npm: auditNpm(dir) };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function report(ecosystem, { introduced, existing }, base) {
  for (const advisory of existing) {
    // GitHub Actions annotation; plain text everywhere else.
    console.log(`::warning title=${ecosystem} advisory already on ${base}::${describeAdvisory(advisory)}`);
  }
  for (const advisory of introduced) {
    console.error(`::error title=${ecosystem} advisory::${describeAdvisory(advisory)}`);
  }
  return introduced.length;
}

function main() {
  const { base } = parseArgs(process.argv.slice(2));
  const head = { rust: auditRust(CARGO_LOCK), npm: auditNpm(process.cwd()) };
  const baseline = base ? auditBase(base) : { rust: null, npm: null };

  const failures =
    report("Rust", splitAdvisories(head.rust, baseline.rust), base) +
    report("npm", splitAdvisories(head.npm, baseline.npm), base);

  if (failures > 0) {
    const scope = base ? `introduced on top of ${base}` : "found";
    console.error(`${failures} blocking advisor${failures === 1 ? "y" : "ies"} ${scope}.`);
    process.exit(1);
  }
  console.log(base ? `No advisories introduced on top of ${base}.` : "No blocking advisories.");
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exit(2);
}
