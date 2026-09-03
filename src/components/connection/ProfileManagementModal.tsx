import { useState } from "react";
import { Pencil, FolderOpen } from "lucide-react";
import { open as openFileDialog } from "@tauri-apps/plugin-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { saveProfile, listProfiles, deleteProfile, testConnection } from "@/lib/ipc";
import { useConnectionStore } from "@/stores/useConnectionStore";
import { ConnectionTestResult } from "@/components/connection/ConnectionTestResult";
import type { ConnectionProfile, ProfileEnvironment } from "@/lib/types";
import { isLocalHost } from "@/lib/hosts";
import { ENVIRONMENT_LABELS, profileEnvironment } from "@/lib/profileSafety";
import { invalidateCatalog } from "@/lib/brokerCatalog";

const ENVIRONMENTS: ProfileEnvironment[] = ["local", "shared", "production"];

/** Standard AMQP TLS port: choosing it is a strong hint that the broker expects amqps. */
const AMQP_TLS_PORT = "5671";
/** Standard RabbitMQ Management HTTPS port. */
const MANAGEMENT_TLS_PORT = "15671";

interface ProfileFormValues {
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

const DEFAULT_FORM_VALUES: ProfileFormValues = {
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
 * Build the profile object sent to the backend from the form state.
 * Ports fall back to the AMQP / Management defaults when unparsable.
 */
function profileFromForm(values: ProfileFormValues): ConnectionProfile {
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
function cleartextTransports(values: ProfileFormValues): string[] {
  if (isLocalHost(values.host)) return [];
  const exposed: string[] = [];
  if (!values.amqpTls) exposed.push("AMQP");
  if (!values.managementSsl) exposed.push("Management API");
  return exposed;
}

interface ProfileManagementModalProps {
  open: boolean;
  onClose: () => void;
}

type TestState = "idle" | "testing" | "success" | "error";

export function ProfileManagementModal({ open, onClose }: ProfileManagementModalProps) {
  const { profiles, setProfiles, setActiveProfile, setConnectionStatus } = useConnectionStore();
  const [formMode, setFormMode] = useState<"list" | "create" | "edit">("list");
  const [formValues, setFormValues] = useState<ProfileFormValues>(DEFAULT_FORM_VALUES);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [testState, setTestState] = useState<TestState>("idle");
  const [testError, setTestError] = useState<string | null>(null);

  const handleShowNewForm = () => {
    setFormValues(DEFAULT_FORM_VALUES);
    setError(null);
    setTestState("idle");
    setTestError(null);
    setFormMode("create");
  };

  const handleShowEditForm = (profile: ConnectionProfile) => {
    setFormValues({
      name: profile.name,
      host: profile.host,
      port: String(profile.port),
      vhost: profile.vhost,
      username: profile.username,
      password: "",             // intentionally blank — user must re-enter to change
      managementPort: String(profile.management_port ?? 15672),
      managementSsl: profile.management_ssl ?? false,
      amqpTls: profile.amqp_tls ?? false,
      caCertPath: profile.ca_cert_path ?? "",
      environment: profileEnvironment(profile),
      environmentTouched: true, // editing: never silently retag an existing profile
      readOnly: profile.read_only ?? false,
      recordHistory: profile.record_history !== false,
    });
    setError(null);
    setTestState("idle");
    setTestError(null);
    setFormMode("edit");
  };

  const handleCancel = () => {
    setFormMode("list");
    setError(null);
    setTestState("idle");
    setTestError(null);
  };

  const handleFieldChange = (field: keyof ProfileFormValues, value: string) => {
    setFormValues((prev) => ({ ...prev, [field]: value }));
  };

  // Until the user picks an environment, follow the host: a local address is
  // "local", anything else is "shared". Production is always an explicit choice.
  const handleHostChange = (value: string) => {
    setFormValues((prev) => ({
      ...prev,
      host: value,
      environment: prev.environmentTouched
        ? prev.environment
        : isLocalHost(value)
          ? "local"
          : "shared",
    }));
  };

  // Picking the standard TLS port is the clearest signal a user gives about the
  // transport; follow it, but leave the checkbox editable afterwards.
  const handlePortChange = (value: string) => {
    setFormValues((prev) => ({
      ...prev,
      port: value,
      amqpTls: value === AMQP_TLS_PORT ? true : value === "5672" ? false : prev.amqpTls,
    }));
  };

  const handleManagementPortChange = (value: string) => {
    setFormValues((prev) => ({
      ...prev,
      managementPort: value,
      managementSsl:
        value === MANAGEMENT_TLS_PORT ? true : value === "15672" ? false : prev.managementSsl,
    }));
  };

  const handleBrowseCaCert = async () => {
    const selected = await openFileDialog({
      multiple: false,
      filters: [{ name: "PEM certificate", extensions: ["pem", "crt", "cer"] }],
    });
    if (selected && typeof selected === "string") {
      setFormValues((prev) => ({ ...prev, caCertPath: selected }));
    }
  };

  const exposedTransports = cleartextTransports(formValues);

  const handleTestOnly = async () => {
    setError(null);
    setTestState("idle");
    setTestError(null);

    const profile = profileFromForm(formValues);

    if (!profile.name) {
      setError("Profile name is required.");
      return;
    }
    if (!profile.host) {
      setError("Host is required.");
      return;
    }

    try {
      await saveProfile(profile, formValues.password);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      return;
    }

    // Refresh the profiles list unconditionally so the profile appears in the sidebar
    const updated = await listProfiles();
    setProfiles(updated);

    setTestState("testing");
    try {
      await testConnection(profile.name);
      setTestState("success");
      // Do NOT call setActiveProfile or setConnectionStatus — profile is saved but not activated
      // Do NOT close the modal
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setTestState("error");
      setTestError(message);
      // Do NOT call setConnectionStatus — this is a non-activating test
      // Do NOT close the modal
    }
  };

  const handleSave = async () => {
    setError(null);
    setTestState("idle");
    setTestError(null);

    const profile = profileFromForm(formValues);

    if (!profile.name) {
      setError("Profile name is required.");
      return;
    }
    if (!profile.host) {
      setError("Host is required.");
      return;
    }
    if (formMode === "edit" && formValues.password.trim() === "") {
      setError(
        "Password is required to save changes. Enter the current password to keep it, or a new password to change it."
      );
      return;
    }

    try {
      // Step 1: persist profile + keychain password
      await saveProfile(profile, formValues.password);
      invalidateCatalog(profile.name); // host or credentials may have changed
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      return;
    }

    // Step 2: test the connection inline (spinner → checkmark / red X)
    setTestState("testing");
    try {
      await testConnection(profile.name);
      setTestState("success");
      // Step 3 on success: refresh profiles, activate, update status
      const updated = await listProfiles();
      setProfiles(updated);
      setActiveProfile(profile.name);
      setConnectionStatus("connected");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setTestState("error");
      setTestError(message);
      setConnectionStatus("error", message);
      // Do NOT close the modal — user can correct and retry
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      await deleteProfile(deleteTarget);
      invalidateCatalog(deleteTarget);
      const updated = await listProfiles();
      setProfiles(updated);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setDeleteTarget(null);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>Connection Profiles</DialogTitle>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-y-auto" data-testid="profile-modal-scroll">
            {/* Profile list */}
            {profiles.length > 0 && (
              <div className="flex flex-col gap-2">
                {profiles.map((profile) => (
                  <div
                    key={profile.name}
                    className="flex items-center justify-between rounded-md border px-3 py-2"
                  >
                    <span className="text-sm font-medium">{profile.name}</span>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleShowEditForm(profile)}
                        aria-label={`Edit profile ${profile.name}`}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteTarget(profile.name)}
                        aria-label={`Delete profile ${profile.name}`}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {profiles.length === 0 && formMode === "list" && (
              <p className="text-sm text-muted-foreground">No profiles saved yet.</p>
            )}

            {/* New profile button */}
            {formMode === "list" && (
              <Button variant="outline" onClick={handleShowNewForm} className="w-full mt-2">
                + New Profile
              </Button>
            )}

            {/* Inline profile form (create or edit) */}
            {(formMode === "create" || formMode === "edit") && (
              <div className="flex flex-col gap-3">
                <p className="text-sm font-semibold text-foreground">
                  {formMode === "edit" ? "Edit Profile" : "New Profile"}
                </p>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-semibold">Profile Name</label>
                  <Input
                    placeholder="e.g. Local RabbitMQ"
                    value={formValues.name}
                    onChange={(e) => handleFieldChange("name", e.target.value)}
                    readOnly={formMode === "edit"}
                    className={formMode === "edit" ? "opacity-60 cursor-not-allowed" : ""}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-semibold">Host</label>
                  <Input
                    placeholder="localhost"
                    value={formValues.host}
                    onChange={(e) => handleHostChange(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-semibold">Environment</label>
                  <RadioGroup
                    value={formValues.environment}
                    onValueChange={(value) =>
                      setFormValues((prev) => ({
                        ...prev,
                        environment: value as ProfileEnvironment,
                        environmentTouched: true,
                      }))
                    }
                    className="flex gap-4"
                  >
                    {ENVIRONMENTS.map((env) => (
                      <div key={env} className="flex items-center gap-2">
                        <RadioGroupItem value={env} id={`env-${env}`} />
                        <label htmlFor={`env-${env}`} className="text-sm cursor-pointer">
                          {ENVIRONMENT_LABELS[env]}
                        </label>
                      </div>
                    ))}
                  </RadioGroup>
                  <p className="text-xs text-muted-foreground">
                    Shared and Production ask before consuming or subscribing; Production also asks before sending.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="read-only"
                    checked={formValues.readOnly}
                    onCheckedChange={(checked) =>
                      setFormValues((prev) => ({ ...prev, readOnly: checked === true }))
                    }
                  />
                  <label htmlFor="read-only" className="text-sm font-semibold cursor-pointer">
                    Read-only profile (no Send, Consume, Subscribe or plan runs)
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="record-history"
                    checked={formValues.recordHistory}
                    onCheckedChange={(checked) =>
                      setFormValues((prev) => ({ ...prev, recordHistory: checked === true }))
                    }
                  />
                  <label htmlFor="record-history" className="text-sm font-semibold cursor-pointer">
                    Record sent messages in history (off keeps production payloads off this machine)
                  </label>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-semibold">Port</label>
                  <Input
                    type="number"
                    value={formValues.port}
                    onChange={(e) => handlePortChange(e.target.value)}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="amqp-tls"
                    checked={formValues.amqpTls}
                    onCheckedChange={(checked) =>
                      setFormValues((prev) => ({ ...prev, amqpTls: checked === true }))
                    }
                  />
                  <label htmlFor="amqp-tls" className="text-sm font-semibold cursor-pointer">
                    AMQP over TLS (amqps, port 5671)
                  </label>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-semibold">Virtual Host</label>
                  <Input
                    placeholder="/"
                    value={formValues.vhost}
                    onChange={(e) => handleFieldChange("vhost", e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-semibold">Username</label>
                  <Input
                    placeholder="guest"
                    value={formValues.username}
                    onChange={(e) => handleFieldChange("username", e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-semibold">Password</label>
                  <Input
                    type="password"
                    placeholder={
                      formMode === "edit"
                        ? "Enter password to update; leave blank to keep current"
                        : "••••••••"
                    }
                    value={formValues.password}
                    onChange={(e) => handleFieldChange("password", e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-semibold">Management API Port</label>
                  <Input
                    type="number"
                    value={formValues.managementPort}
                    onChange={(e) => handleManagementPortChange(e.target.value)}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="management-ssl"
                    checked={formValues.managementSsl}
                    onCheckedChange={(checked) =>
                      setFormValues((prev) => ({ ...prev, managementSsl: checked === true }))
                    }
                  />
                  <label htmlFor="management-ssl" className="text-sm font-semibold cursor-pointer">
                    Management API SSL (HTTPS)
                  </label>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-semibold">CA certificate</label>
                  <div className="flex items-center gap-1">
                    <Input
                      placeholder="CA certificate (PEM), optional"
                      value={formValues.caCertPath}
                      onChange={(e) => handleFieldChange("caCertPath", e.target.value)}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => void handleBrowseCaCert()}
                      aria-label="Browse for CA certificate"
                    >
                      <FolderOpen className="w-4 h-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Only needed when the broker uses an internal PKI that the OS trust store does not know.
                  </p>
                </div>

                {exposedTransports.length > 0 && (
                  <p role="status" className="text-xs text-amber-700 dark:text-amber-400">
                    The password will travel unencrypted to {formValues.host.trim()} over{" "}
                    {exposedTransports.join(" and ")}. Enable TLS before using this profile on a shared broker.
                  </p>
                )}

                {error && (
                  <p className="text-sm text-destructive">{error}</p>
                )}

                <ConnectionTestResult state={testState} errorMessage={testError} />

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={handleCancel}>
                    Cancel
                  </Button>
                  {formMode === "create" && (
                    <Button
                      variant="outline"
                      onClick={handleTestOnly}
                      disabled={testState === "testing"}
                    >
                      Test Connection
                    </Button>
                  )}
                  <Button onClick={handleSave} disabled={testState === "testing"}>
                    Save &amp; Connect
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <AlertDialog open={deleteTarget !== null} onOpenChange={(isOpen) => { if (!isOpen) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Profile</AlertDialogTitle>
            <AlertDialogDescription>
              Delete {deleteTarget}? This will also remove the saved password from your OS keychain.
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Profile</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm}>
              Delete Profile
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
