import { describe, expect, it } from "vitest";
import {
  describeAdvisory,
  parseCargoAudit,
  parsePnpmAudit,
  splitAdvisories,
} from "./advisories.mjs";

const cargoEntry = (id, name, version, patched = []) => ({
  advisory: { id },
  package: { name, version },
  versions: { patched, unaffected: [] },
});

const pnpmEntry = (id, ghsa, name, severity, versions, patched = "") => ({
  id,
  github_advisory_id: ghsa,
  module_name: name,
  severity,
  patched_versions: patched,
  findings: versions.map((version) => ({ version })),
});

describe("parseCargoAudit", () => {
  it("maps vulnerabilities to the common advisory shape", () => {
    const report = {
      vulnerabilities: {
        list: [cargoEntry("RUSTSEC-2026-0506", "hickory-net", "0.26.1", [">=0.26.2"])],
      },
    };

    expect(parseCargoAudit(report)).toEqual([
      { id: "RUSTSEC-2026-0506", package: "hickory-net", version: "0.26.1", fix: ">=0.26.2" },
    ]);
  });

  it("joins several patched ranges and reports null when none exists", () => {
    const report = {
      vulnerabilities: {
        list: [
          cargoEntry("RUSTSEC-1", "quinn-udp", "0.5.14", [">=0.5.16, <0.6.0", ">=0.6.3"]),
          cargoEntry("RUSTSEC-2", "spin", "0.9.8"),
        ],
      },
    };

    const fixes = parseCargoAudit(report).map((advisory) => advisory.fix);

    expect(fixes).toEqual([">=0.5.16, <0.6.0 or >=0.6.3", null]);
  });

  it("returns an empty list for a clean or malformed report", () => {
    expect(parseCargoAudit({ vulnerabilities: { list: [] } })).toEqual([]);
    expect(parseCargoAudit({})).toEqual([]);
    expect(parseCargoAudit(undefined)).toEqual([]);
  });
});

describe("parsePnpmAudit", () => {
  it("keeps only high and critical advisories", () => {
    const report = {
      advisories: {
        1: pnpmEntry(1, "GHSA-low", "a", "low", ["1.0.0"]),
        2: pnpmEntry(2, "GHSA-mod", "b", "moderate", ["1.0.0"]),
        3: pnpmEntry(3, "GHSA-high", "c", "high", ["1.0.0"], ">=1.0.1"),
        4: pnpmEntry(4, "GHSA-crit", "d", "critical", ["2.0.0"]),
      },
    };

    expect(parsePnpmAudit(report)).toEqual([
      { id: "GHSA-high", package: "c", version: "1.0.0", fix: ">=1.0.1" },
      { id: "GHSA-crit", package: "d", version: "2.0.0", fix: null },
    ]);
  });

  it("lists each installed version once and falls back to the numeric id", () => {
    const entry = { ...pnpmEntry(77, undefined, "e", "high", ["1.0.0", "1.0.0", "1.2.0"]) };

    const [advisory] = parsePnpmAudit({ advisories: { 77: entry } });

    expect(advisory).toMatchObject({ id: "77", version: "1.0.0, 1.2.0" });
  });

  it("returns an empty list when the report has no advisories", () => {
    expect(parsePnpmAudit({ advisories: {} })).toEqual([]);
    expect(parsePnpmAudit({})).toEqual([]);
  });
});

describe("splitAdvisories", () => {
  const hickory = { id: "RUSTSEC-1", package: "hickory-net", version: "0.26.1", fix: null };
  const zip = { id: "RUSTSEC-2", package: "zip", version: "4.6.1", fix: null };

  it("treats every advisory as introduced when there is no base", () => {
    expect(splitAdvisories([hickory, zip], null)).toEqual({
      introduced: [hickory, zip],
      existing: [],
    });
  });

  it("separates advisories already on the base from new ones", () => {
    expect(splitAdvisories([hickory, zip], [hickory])).toEqual({
      introduced: [zip],
      existing: [hickory],
    });
  });

  it("still counts an advisory as existing after a version change that keeps it", () => {
    const stillVulnerable = { ...hickory, version: "0.26.0" };

    expect(splitAdvisories([stillVulnerable], [hickory]).introduced).toEqual([]);
  });

  it("counts the same advisory id on another package as introduced", () => {
    const otherPackage = { ...hickory, package: "hickory-proto" };

    expect(splitAdvisories([otherPackage], [hickory]).introduced).toEqual([otherPackage]);
  });

  it("reports nothing when the change removes all advisories", () => {
    expect(splitAdvisories([], [hickory, zip])).toEqual({ introduced: [], existing: [] });
  });
});

describe("describeAdvisory", () => {
  it("includes the fix range when one is released", () => {
    const advisory = { id: "RUSTSEC-1", package: "zip", version: "4.6.1", fix: ">=9.0.5" };

    expect(describeAdvisory(advisory)).toBe("RUSTSEC-1 zip 4.6.1 (fix: >=9.0.5)");
  });

  it("says so when no fix is released", () => {
    const advisory = { id: "RUSTSEC-1", package: "spin", version: "0.9.8", fix: null };

    expect(describeAdvisory(advisory)).toBe("RUSTSEC-1 spin 0.9.8 (no fix released)");
  });
});
