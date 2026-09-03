import type { ConnectionProfile } from "@/lib/types";

const LOCAL_HOST_NAMES: ReadonlySet<string> = new Set(["localhost", "::1", "[::1]"]);

/**
 * True when `host` can only be the developer's own machine.
 *
 * Anything unknown counts as remote: callers use this to decide whether a
 * destructive broker operation needs confirmation, and "we could not tell"
 * must land on the cautious side.
 */
export function isLocalHost(host: string | null | undefined): boolean {
  if (!host) return false;
  const normalized = host.trim().toLowerCase();
  if (normalized === "") return false;
  if (LOCAL_HOST_NAMES.has(normalized)) return true;
  return normalized.startsWith("127.");
}

/** Host of the named profile, or undefined when the profile is not loaded. */
export function profileHost(
  profiles: ReadonlyArray<ConnectionProfile>,
  profileName: string | null | undefined
): string | undefined {
  if (!profileName) return undefined;
  return profiles.find((p) => p.name === profileName)?.host;
}
