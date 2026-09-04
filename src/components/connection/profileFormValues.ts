import type { ConnectionProfile, ProfileEnvironment } from "@/lib/types";
import { isLocalHost } from "@/lib/hosts";
import { profileEnvironment } from "@/lib/profileSafety";

/** Standard AMQP TLS port: choosing it is a strong hint that the broker expects amqps. */
export const AMQP_TLS_PORT = "5671";
/** Standard RabbitMQ Management HTTPS port. */
export const MANAGEMENT_TLS_PORT = "15671";

export interface ProfileFormValues {
  name: string;
  host: string;
  port: string;
  vhost: string;
  username: string;
  password: string;
  managementPort: string;
  managementSsl: boolean;
  amqpTls: boolean;
  caCertPath: string;
  environment: ProfileEnvironment;
  /** True once the user picked an environment; the host no longer overrides it. */
  environmentTouched: boolean;
  readOnly: boolean;
  recordHistory: boolean;
}

export const DEFAULT_FORM_VALUES: ProfileFormValues = {
  name: "",
  host: "",
  port: "5672",
  vhost: "/",
  username: "",
  password: "",
  managementPort: "15672",
  managementSsl: false,
  amqpTls: false,
  caCertPath: "",
  environment: "local",
  environmentTouched: false,
  readOnly: false,
  recordHistory: true,
};

/**
 * Map a saved profile onto editable form values. The password is intentionally
 * left blank — the user must re-enter it to change it.
 */
export function formFromProfile(profile: ConnectionProfile): ProfileFormValues {
  return {
    name: profile.name,
    host: profile.host,
    port: String(profile.port),
    vhost: profile.vhost,
    username: profile.username,
    password: "",
    managementPort: String(profile.management_port ?? 15672),
    managementSsl: profile.management_ssl ?? false,
    amqpTls: profile.amqp_tls ?? false,
    caCertPath: profile.ca_cert_path ?? "",
    environment: profileEnvironment(profile),
    environmentTouched: true, // editing: never silently retag an existing profile
    readOnly: profile.read_only ?? false,
    recordHistory: profile.record_history !== false,
  };
}

/**
 * Build the profile object sent to the backend from the form state.
 * Ports fall back to the AMQP / Management defaults when unparsable.
 */
export function profileFromForm(values: ProfileFormValues): ConnectionProfile {
  return {
    name: values.name.trim(),
    host: values.host.trim(),
    port: Number(values.port) || 5672,
    vhost: values.vhost.trim() || "/",
    username: values.username.trim(),
    management_port: Number(values.managementPort) || 15672,
    management_ssl: values.managementSsl,
    amqp_tls: values.amqpTls,
    ca_cert_path: values.caCertPath.trim() || null,
    environment: values.environment,
    read_only: values.readOnly,
    record_history: values.recordHistory,
  };
}

/**
 * Which transports would carry the password in cleartext to a remote host.
 * Empty when the host is local or everything is encrypted.
 */
export function cleartextTransports(values: ProfileFormValues): string[] {
  if (isLocalHost(values.host)) return [];
  const exposed: string[] = [];
  if (!values.amqpTls) exposed.push("AMQP");
  if (!values.managementSsl) exposed.push("Management API");
  return exposed;
}

/**
 * Update the host. Until the user picks an environment explicitly, follow the
 * host: a local address is "local", anything else is "shared". Production is
 * always an explicit choice.
 */
export function withHost(values: ProfileFormValues, host: string): ProfileFormValues {
  return {
    ...values,
    host,
    environment: values.environmentTouched
      ? values.environment
      : isLocalHost(host)
        ? "local"
        : "shared",
  };
}

/**
 * Update the AMQP port. Picking the standard TLS port is the clearest signal a
 * user gives about the transport; follow it, but leave the switch editable
 * afterwards for any other port.
 */
export function withPort(values: ProfileFormValues, port: string): ProfileFormValues {
  return {
    ...values,
    port,
    amqpTls: port === AMQP_TLS_PORT ? true : port === "5672" ? false : values.amqpTls,
  };
}

/** Update the Management API port, following the standard TLS port the same way. */
export function withManagementPort(values: ProfileFormValues, port: string): ProfileFormValues {
  return {
    ...values,
    managementPort: port,
    managementSsl:
      port === MANAGEMENT_TLS_PORT ? true : port === "15672" ? false : values.managementSsl,
  };
}

/**
 * Validate the form before saving or testing. Returns a user-facing error
 * message, or null when the form is ready to submit.
 */
export function validateProfile(values: ProfileFormValues, mode: "new" | "edit"): string | null {
  if (!values.name.trim()) return "Profile name is required.";
  if (!values.host.trim()) return "Host is required.";
  if (mode === "edit" && values.password.trim() === "") {
    return "Password is required to save changes. Enter the current password to keep it, or a new password to change it.";
  }
  return null;
}
