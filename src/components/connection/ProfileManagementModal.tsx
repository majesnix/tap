import { useState } from "react";
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
import { saveProfile, listProfiles, deleteProfile, testConnection } from "@/lib/ipc";
import { useConnectionStore } from "@/stores/useConnectionStore";
import { ConnectionTestResult } from "@/components/connection/ConnectionTestResult";
import type { ConnectionProfile } from "@/lib/types";

interface ProfileFormValues {
  name: string;
  host: string;
  port: string;
  vhost: string;
  username: string;
  password: string;
  managementPort: string;
}

const DEFAULT_FORM_VALUES: ProfileFormValues = {
  name: "",
  host: "",
  port: "5672",
  vhost: "/",
  username: "",
  password: "",
  managementPort: "15672",
};

interface ProfileManagementModalProps {
  open: boolean;
  onClose: () => void;
}

type TestState = "idle" | "testing" | "success" | "error";

export function ProfileManagementModal({ open, onClose }: ProfileManagementModalProps) {
  const { profiles, setProfiles, setActiveProfile, setConnectionStatus } = useConnectionStore();
  const [formMode, setFormMode] = useState<"list" | "create">("list");
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

  const handleCancel = () => {
    setFormMode("list");
    setError(null);
    setTestState("idle");
    setTestError(null);
  };

  const handleFieldChange = (field: keyof ProfileFormValues, value: string) => {
    setFormValues((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setError(null);
    setTestState("idle");
    setTestError(null);

    const profile: ConnectionProfile = {
      name: formValues.name.trim(),
      host: formValues.host.trim(),
      port: Number(formValues.port) || 5672,
      vhost: formValues.vhost.trim() || "/",
      username: formValues.username.trim(),
      managementPort: Number(formValues.managementPort) || 15672,
    };

    if (!profile.name) {
      setError("Profile name is required.");
      return;
    }
    if (!profile.host) {
      setError("Host is required.");
      return;
    }

    try {
      // Step 1: persist profile + keychain password
      await saveProfile(profile, formValues.password);
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
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Connection Profiles</DialogTitle>
          </DialogHeader>

          {/* Profile list */}
          {profiles.length > 0 && (
            <div className="flex flex-col gap-2">
              {profiles.map((profile) => (
                <div
                  key={profile.name}
                  className="flex items-center justify-between rounded-md border px-3 py-2"
                >
                  <span className="text-sm font-medium">{profile.name}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeleteTarget(profile.name)}
                    aria-label={`Delete profile ${profile.name}`}
                  >
                    Delete
                  </Button>
                </div>
              ))}
            </div>
          )}

          {profiles.length === 0 && formMode === "list" && (
            <p className="text-sm text-muted-foreground">No profiles saved yet.</p>
          )}

          {/* New profile button */}
          {formMode === "list" && (
            <Button variant="outline" onClick={handleShowNewForm} className="w-full">
              + New Profile
            </Button>
          )}

          {/* Inline new profile form */}
          {formMode === "create" && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-semibold">Profile Name</label>
                <Input
                  placeholder="e.g. Local RabbitMQ"
                  value={formValues.name}
                  onChange={(e) => handleFieldChange("name", e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-semibold">Host</label>
                <Input
                  placeholder="localhost"
                  value={formValues.host}
                  onChange={(e) => handleFieldChange("host", e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-semibold">Port</label>
                <Input
                  type="number"
                  value={formValues.port}
                  onChange={(e) => handleFieldChange("port", e.target.value)}
                />
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
                  placeholder="••••••••"
                  value={formValues.password}
                  onChange={(e) => handleFieldChange("password", e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-semibold">Management API Port</label>
                <Input
                  type="number"
                  value={formValues.managementPort}
                  onChange={(e) => handleFieldChange("managementPort", e.target.value)}
                />
              </div>

              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}

              <ConnectionTestResult state={testState} errorMessage={testError} />

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={handleCancel}>
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={testState === "testing"}>
                  Save &amp; Connect
                </Button>
              </div>
            </div>
          )}
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
