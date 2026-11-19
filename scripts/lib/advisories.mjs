// Pure helpers for scripts/audit.mjs: turn audit tool output into a common
// advisory shape and decide which advisories a change introduces.

/** npm severities that fail the audit; lower ones never ship a blocking risk. */
export const BLOCKING_NPM_SEVERITIES = ["high", "critical"];

/**
 * `cargo audit --json` report → [{ id, package, version, fix }].
 * Warnings (unmaintained, unsound, yanked) are not vulnerabilities and are skipped.
 */
export function parseCargoAudit(report) {
  const list = report?.vulnerabilities?.list ?? [];
  return list.map((entry) => ({
    id: entry.advisory.id,
    package: entry.package.name,
    version: entry.package.version,
    fix: entry.versions?.patched?.join(" or ") || null,
  }));
}

/** `pnpm audit --json` report → [{ id, package, version, fix }], blocking severities only. */
export function parsePnpmAudit(report) {
  const advisories = Object.values(report?.advisories ?? {});
  return advisories
    .filter((advisory) => BLOCKING_NPM_SEVERITIES.includes(advisory.severity))
    .map((advisory) => ({
      id: advisory.github_advisory_id ?? String(advisory.id),
      package: advisory.module_name,
      version: [...new Set(advisory.findings.map((finding) => finding.version))].join(", "),
      fix: advisory.patched_versions || null,
    }));
}

/** An advisory is the same finding on both sides when id and package match, whatever the version. */
function advisoryKey(advisory) {
  return `${advisory.id}:${advisory.package}`;
}

/**
 * Split the advisories of a change into those it introduces and those the
 * base branch already has. Without a base, every advisory counts as introduced.
 */
export function splitAdvisories(headAdvisories, baseAdvisories) {
  const baseKeys = new Set((baseAdvisories ?? []).map(advisoryKey));
  return {
    introduced: headAdvisories.filter((advisory) => !baseKeys.has(advisoryKey(advisory))),
    existing: headAdvisories.filter((advisory) => baseKeys.has(advisoryKey(advisory))),
  };
}

/** "RUSTSEC-2026-0506 hickory-net 0.26.1 (fix: >=0.26.2)" */
export function describeAdvisory(advisory) {
  const fix = advisory.fix ? `fix: ${advisory.fix}` : "no fix released";
  return `${advisory.id} ${advisory.package} ${advisory.version} (${fix})`;
}
