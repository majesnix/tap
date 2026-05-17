import { useState } from "react";
import { Pencil } from "lucide-react";
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
  managementSsl: boolean;
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
};

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

  const handleTestOnly = async () => {
    setError(null);
    setTestState("idle");
    setTestError(null);

    const profile: ConnectionProfile = {
      name: formValues.name.trim(),
      host: formValues.host.trim(),
      port: Number(formValues.port) || 5672,
      vhost: formValues.vhost.trim() || "/",
      username: formValues.username.trim(),
      management_port: Number(formValues.managementPort) || 15672,
      management_ssl: formValues.managementSsl,
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

    const profile: ConnectionProfile = {
      name: formValues.name.trim(),
      host: formValues.host.trim(),
      port: Number(formValues.port) || 5672,
      vhost: formValues.vhost.trim() || "/",
      username: formValues.username.trim(),
      management_port: Number(formValues.managementPort) || 15672,
      management_ssl: formValues.managementSsl,
    };

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
                    onChange={(e) => handleFieldChange("managementPort", e.target.value)}
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
