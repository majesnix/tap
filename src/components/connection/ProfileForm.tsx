import { useState } from "react";
import { ArrowLeft, X, FolderPlus, Shield, TriangleAlert } from "lucide-react";
import { open as openFileDialog } from "@tauri-apps/plugin-dialog";
import { IconButton } from "@/components/common/IconButton";
import { EnvironmentPill } from "@/components/common/EnvironmentPill";
import { SectionLabel } from "@/components/common/SectionLabel";
import { SegmentedControl, type SegmentedItem } from "@/components/common/SegmentedControl";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
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
import { ConnectionTestResult } from "@/components/connection/ConnectionTestResult";
import { saveProfile, listProfiles, deleteProfile, testConnection } from "@/lib/ipc";
import { useConnectionStore } from "@/stores/useConnectionStore";
import { invalidateCatalog } from "@/lib/brokerCatalog";
import type { ProfileEnvironment } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  profileFromForm,
  cleartextTransports,
  withHost,
  withPort,
  withManagementPort,
  validateProfile,
  type ProfileFormValues,
} from "@/components/connection/profileFormValues";

type TestState = "idle" | "testing" | "success" | "error";

const ENVIRONMENT_ITEMS: SegmentedItem<ProfileEnvironment>[] = [
  { value: "local", label: "Local" },
  { value: "shared", label: "Shared", activeClassName: "text-warning" },
  { value: "production", label: "Production", activeClassName: "text-danger" },
];

interface ProfileFormProps {
  mode: "new" | "edit";
  initial: ProfileFormValues;
  onBack: () => void;
  onClose: () => void;
  onSaved: (profileName: string) => void;
  onDeleted: () => void;
}

function tlsSummary(values: ProfileFormValues, exposedTransports: string[]) {
  if (values.amqpTls && values.managementSsl) {
    return { icon: <Shield size={13} />, text: "Encrypted on both transports", className: "text-success" };
  }
  if (exposedTransports.length > 0) {
    return {
      icon: <TriangleAlert size={13} />,
      text: `Password travels unencrypted over ${exposedTransports.join(" and ")}`,
      className: "text-warning",
    };
  }
  return { icon: null, text: "Local host — TLS optional", className: "text-ghost" };
}

export function ProfileForm({ mode, initial, onBack, onClose, onSaved, onDeleted }: ProfileFormProps) {
  const setProfiles = useConnectionStore((s) => s.setProfiles);
  const setActiveProfile = useConnectionStore((s) => s.setActiveProfile);
  const setConnectionStatus = useConnectionStore((s) => s.setConnectionStatus);
  const [values, setValues] = useState<ProfileFormValues>(initial);
  const [error, setError] = useState<string | null>(null);
  const [testState, setTestState] = useState<TestState>("idle");
  const [testError, setTestError] = useState<string | null>(null);
  const [testLatencyMs, setTestLatencyMs] = useState<number | undefined>(undefined);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const exposedTransports = cleartextTransports(values);
  const tls = tlsSummary(values, exposedTransports);

  const handleTestOnly = async () => {
    setError(null);
    setTestState("idle");
    setTestError(null);
    setTestLatencyMs(undefined);

    const validationError = validateProfile(values, mode);
    if (validationError) {
      setError(validationError);
      return;
    }

    const profile = profileFromForm(values);

    try {
      await saveProfile(profile, values.password);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
      return;
    }

    // Refresh the profiles list unconditionally so the profile appears in the sheet
    const updated = await listProfiles();
    setProfiles(updated);

    setTestState("testing");
    const start = performance.now();
    try {
      await testConnection(profile.name);
      setTestLatencyMs(Math.round(performance.now() - start));
      setTestState("success");
      // Do NOT call setActiveProfile or setConnectionStatus — profile is saved but not activated
      // Do NOT close the sheet
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setTestState("error");
      setTestError(message);
      // Do NOT call setConnectionStatus — this is a non-activating test
      // Do NOT close the sheet
    }
  };

  const handleSave = async () => {
    setError(null);
    setTestState("idle");
    setTestError(null);
    setTestLatencyMs(undefined);

    const validationError = validateProfile(values, mode);
    if (validationError) {
      setError(validationError);
      return;
    }

    const profile = profileFromForm(values);

    try {
      // Step 1: persist profile + keychain password
      await saveProfile(profile, values.password);
      invalidateCatalog(profile.name); // host or credentials may have changed
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
      return;
    }

    // Step 2: test the connection inline (spinner → checkmark / red X)
    setTestState("testing");
    const start = performance.now();
    try {
      await testConnection(profile.name);
      setTestLatencyMs(Math.round(performance.now() - start));
      setTestState("success");
      // Step 3 on success: refresh profiles, activate, update status, close the sheet
      const updated = await listProfiles();
      setProfiles(updated);
      setActiveProfile(profile.name);
      setConnectionStatus("connected");
      onSaved(profile.name);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setTestState("error");
      setTestError(message);
      setConnectionStatus("error", message);
      // Do NOT close the sheet — user can correct and retry
    }
  };

  const handleDeleteConfirm = async () => {
    try {
      await deleteProfile(values.name);
      invalidateCatalog(values.name);
      const updated = await listProfiles();
      setProfiles(updated);
      onDeleted();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setDeleteOpen(false);
    }
  };

  const handleBrowseCaCert = async () => {
    const selected = await openFileDialog({
      multiple: false,
      filters: [{ name: "PEM certificate", extensions: ["pem", "crt", "cer"] }],
    });
    if (selected && typeof selected === "string") {
      setValues((v) => ({ ...v, caCertPath: selected }));
    }
  };

  const testing = testState === "testing";

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center gap-2.5 p-[18px_20px_12px]">
        <IconButton size={28} label="Back" onClick={onBack}>
          <ArrowLeft size={16} strokeWidth={1.5} />
        </IconButton>
        <div className="flex flex-1 flex-col gap-0.5">
          <span className="text-15 font-semibold">{mode === "edit" ? values.name : "New connection"}</span>
          <span className="text-12 text-ghost">Connection profile</span>
        </div>
        <EnvironmentPill environment={values.environment} size="md" />
        <IconButton size={28} label="Close" onClick={onClose}>
          <X size={16} strokeWidth={1.5} />
        </IconButton>
      </div>

      <div className="flex flex-1 flex-col gap-3 overflow-auto px-5 pt-1.5 pb-4">
        {/* BROKER */}
        <div className="flex flex-col rounded-lg border border-border bg-background">
          <SectionLabel className="p-[10px_14px_4px]">Broker</SectionLabel>
          <div className="grid grid-cols-[100px_1fr] items-center gap-x-2.5 gap-y-1.5 p-[6px_14px_12px]">
            <label htmlFor="profile-name" className="text-12 text-muted-foreground">
              Name
            </label>
            <Input
              id="profile-name"
              className={cn(
                "h-[30px] bg-card text-12",
                mode === "edit" && "opacity-60 cursor-not-allowed"
              )}
              placeholder="e.g. Local RabbitMQ"
              value={values.name}
              readOnly={mode === "edit"}
              onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
            />

            <label htmlFor="profile-host" className="text-12 text-muted-foreground">
              Host
            </label>
            <Input
              id="profile-host"
              className="h-[30px] bg-card font-mono text-12"
              placeholder="localhost"
              value={values.host}
              onChange={(e) => setValues((v) => withHost(v, e.target.value))}
            />

            <span className="text-12 text-muted-foreground">Ports</span>
            <div className="flex gap-1.5">
              <div className="flex flex-1 items-center rounded-md border border-border bg-card">
                <Input
                  aria-label="AMQP port"
                  className="h-[30px] flex-1 border-0 bg-transparent px-2.5 font-mono text-12 shadow-none focus-visible:ring-0"
                  value={values.port}
                  onChange={(e) => setValues((v) => withPort(v, e.target.value))}
                />
                <span className="pr-2.5 text-10 text-ghost">{values.amqpTls ? "amqps" : "amqp"}</span>
              </div>
              <div className="flex flex-1 items-center rounded-md border border-border bg-card">
                <Input
                  aria-label="Management API port"
                  className="h-[30px] flex-1 border-0 bg-transparent px-2.5 font-mono text-12 shadow-none focus-visible:ring-0"
                  value={values.managementPort}
                  onChange={(e) => setValues((v) => withManagementPort(v, e.target.value))}
                />
                <span className="pr-2.5 text-10 text-ghost">
                  {values.managementSsl ? "https" : "http"}
                </span>
              </div>
            </div>

            <label htmlFor="profile-vhost" className="text-12 text-muted-foreground">
              Virtual host
            </label>
            <Input
              id="profile-vhost"
              className="h-[30px] bg-card font-mono text-12"
              placeholder="/"
              value={values.vhost}
              onChange={(e) => setValues((v) => ({ ...v, vhost: e.target.value }))}
            />

            <span className="text-12 text-muted-foreground">Credentials</span>
            <div className="flex gap-1.5">
              <Input
                aria-label="Username"
                className="h-[30px] flex-1 bg-card text-12"
                placeholder="username"
                value={values.username}
                onChange={(e) => setValues((v) => ({ ...v, username: e.target.value }))}
              />
              <Input
                aria-label="Password"
                type="password"
                className="h-[30px] flex-1 bg-card text-12"
                placeholder={mode === "edit" ? "leave blank to keep" : "password"}
                value={values.password}
                onChange={(e) => setValues((v) => ({ ...v, password: e.target.value }))}
              />
            </div>
          </div>
        </div>

        {/* SAFETY */}
        <div className="flex flex-col rounded-lg border border-border bg-background">
          <SectionLabel className="p-[10px_14px_4px]">Safety</SectionLabel>
          <div className="flex flex-col p-[4px_14px_10px]">
            <SegmentedControl<ProfileEnvironment>
              aria-label="Environment"
              variant="choice"
              stretch
              value={values.environment}
              onChange={(value) => setValues((v) => ({ ...v, environment: value, environmentTouched: true }))}
              items={ENVIRONMENT_ITEMS}
              className="mb-2"
            />
            <p className="pb-1.5 text-11 text-ghost">
              Shared asks before Consume and Subscribe. Production also asks before Send.
            </p>
            <div className="flex h-[34px] items-center justify-between border-t border-hairline">
              <span className="text-12">Read-only profile</span>
              <Switch
                aria-label="Read-only profile"
                checked={values.readOnly}
                onCheckedChange={(checked) => setValues((v) => ({ ...v, readOnly: checked }))}
              />
            </div>
            <div className="flex h-[34px] items-center justify-between border-t border-hairline">
              <span className="text-12">Record sent messages in history</span>
              <Switch
                aria-label="Record sent messages in history"
                checked={values.recordHistory}
                onCheckedChange={(checked) => setValues((v) => ({ ...v, recordHistory: checked }))}
              />
            </div>
          </div>
        </div>

        {/* TLS */}
        <div className="flex flex-col rounded-lg border border-border bg-background">
          <div className="flex items-center justify-between p-[10px_14px]">
            <SectionLabel>TLS</SectionLabel>
            <span className={cn("flex items-center gap-1.5 text-12", tls.className)}>
              {tls.icon}
              {tls.text}
            </span>
          </div>
          <div className="flex flex-col p-[0px_14px_10px]">
            <div className="flex h-[34px] items-center justify-between border-t border-hairline">
              <span className="text-12">
                AMQP over TLS <span className="text-ghost">amqps</span>
              </span>
              <Switch
                aria-label="AMQP over TLS"
                checked={values.amqpTls}
                onCheckedChange={(checked) => setValues((v) => ({ ...v, amqpTls: checked }))}
              />
            </div>
            <div className="flex h-[34px] items-center justify-between border-t border-hairline">
              <span className="text-12">Management API over HTTPS</span>
              <Switch
                aria-label="Management API over HTTPS"
                checked={values.managementSsl}
                onCheckedChange={(checked) => setValues((v) => ({ ...v, managementSsl: checked }))}
              />
            </div>
            <div className="flex items-center gap-1.5 border-t border-hairline pt-2">
              <Input
                className="h-[30px] flex-1 bg-card text-12"
                placeholder="CA certificate (PEM), optional"
                value={values.caCertPath}
                onChange={(e) => setValues((v) => ({ ...v, caCertPath: e.target.value }))}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-[30px] shrink-0"
                onClick={() => void handleBrowseCaCert()}
                aria-label="Browse for CA certificate"
              >
                <FolderPlus size={14} strokeWidth={1.5} />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {error && <p className="px-5 pb-2 text-12 text-danger">{error}</p>}

      <div className="flex items-center gap-2 border-t border-border p-[12px_20px]">
        {mode === "edit" && (
          <button
            type="button"
            onClick={() => setDeleteOpen(true)}
            className="text-12 text-danger"
          >
            Delete
          </button>
        )}
        <div className="flex-1" />
        <ConnectionTestResult state={testState} errorMessage={testError} latencyMs={testLatencyMs} />
        <Button type="button" variant="outline" size="md" onClick={() => void handleTestOnly()} disabled={testing}>
          Test
        </Button>
        <Button type="button" size="md" onClick={() => void handleSave()} disabled={testing}>
          Save &amp; connect
        </Button>
      </div>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {values.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will also remove the saved password from your OS keychain. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep profile</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleDeleteConfirm()}>
              Delete profile
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
