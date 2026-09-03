import type { ConnectionProfile, ProfileEnvironment } from "@/lib/types";
import { isLocalHost } from "@/lib/hosts";

/** Broker operations that can take something away from other people. */
export type BrokerAction = "consume" | "subscribe" | "publish";

export const ENVIRONMENT_LABELS: Record<ProfileEnvironment, string> = {
  local: "Local",
  shared: "Shared",
  production: "Production",
};

/**
 * The environment a profile belongs to: its explicit tag, otherwise inferred from
 * the host. Unknown profiles count as shared so callers err on the side of asking.
 */
export function profileEnvironment(profile: ConnectionProfile | undefined): ProfileEnvironment {
  if (!profile) return "shared";
  if (profile.environment) return profile.environment;
  return isLocalHost(profile.host) ? "local" : "shared";
}

/**
 * Whether `action` on `profile` should be confirmed first.
 * Consume and Subscribe remove messages for other consumers, so everything that is
 * not local asks. Publishing only asks on production.
 */
export function requiresConfirmation(
  profile: ConnectionProfile | undefined,
  action: BrokerAction
): boolean {
  const environment = profileEnvironment(profile);
  if (action === "publish") return environment === "production";
  return environment !== "local";
}

/** Read-only profiles cannot send, consume, subscribe or run plans. */
export function isReadOnly(profile: ConnectionProfile | undefined): boolean {
  return profile?.read_only === true;
}

/** The profile with the given name, if it is loaded. */
export function findProfile(
  profiles: ReadonlyArray<ConnectionProfile>,
  name: string | null | undefined
): ConnectionProfile | undefined {
  if (!name) return undefined;
  return profiles.find((p) => p.name === name);
}

/** "host (Environment)" for confirmation dialogs. */
export function describeBroker(profile: ConnectionProfile | undefined): string {
  const host = profile?.host ?? "an unknown host";
  return `${host} (${ENVIRONMENT_LABELS[profileEnvironment(profile)]})`;
}

/** Whether sends through this profile are kept in the local history. */
export function recordsHistory(profile: ConnectionProfile | undefined): boolean {
  return profile?.record_history !== false;
}
