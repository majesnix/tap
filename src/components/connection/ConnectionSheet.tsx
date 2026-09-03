import type { ReactNode } from "react";
import { X, Plus, ChevronRight } from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { IconButton } from "@/components/common/IconButton";
import { StatusDot } from "@/components/common/StatusDot";
import { EnvironmentPill } from "@/components/common/EnvironmentPill";
import { ProfileForm } from "@/components/connection/ProfileForm";
import { useConnectionStore } from "@/stores/useConnectionStore";
import { profileEnvironment, findProfile } from "@/lib/profileSafety";
import { DEFAULT_FORM_VALUES, formFromProfile } from "@/components/connection/profileFormValues";
import type { SheetState } from "@/lib/workbench";
import type { ConnectionProfile } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ConnectionSheetProps {
  state: SheetState;
  onStateChange: (state: SheetState) => void;
}

/** `amqps://user@host:port/vhost` — the vhost segment is dropped for the default "/". */
function profileUrl(profile: ConnectionProfile): string {
  const scheme = profile.amqp_tls ? "amqps" : "amqp";
  const vhost = profile.vhost === "/" ? "" : profile.vhost;
  return `${scheme}://${profile.username}@${profile.host}:${profile.port}/${vhost}`;
}

export function ConnectionSheet({ state, onStateChange }: ConnectionSheetProps) {
  const { profiles, activeProfileName, keychainError } = useConnectionStore();

  if (state === null) return null;

  const handleClose = () => onStateChange(null);
  const handleBackToList = () => onStateChange({ mode: "list" });

  let content: ReactNode;

  if (state.mode === "list") {
    content = (
      <>
        <div className="flex items-center gap-2.5 p-[18px_20px_12px]">
          <div className="flex flex-1 flex-col gap-0.5">
            <span className="text-15 font-semibold">Connections</span>
            <span className="text-12 text-ghost">
              {keychainError
                ? `Keychain unavailable — passwords stay in memory this session (${keychainError})`
                : "Passwords live in the OS keychain"}
            </span>
          </div>
          <IconButton size={28} label="Close" onClick={handleClose}>
            <X size={16} strokeWidth={1.5} />
          </IconButton>
        </div>
        <div className="flex flex-col gap-1.5 px-5 py-1.5">
          {profiles.map((p) => (
            <button
              key={p.name}
              type="button"
              onClick={() => onStateChange({ mode: "edit", profile: p.name })}
              className={cn(
                "flex items-center gap-3 rounded-lg border bg-background p-[12px_14px] text-left transition-colors hover:border-border-strong",
                p.name === activeProfileName ? "border-border-strong" : "border-border"
              )}
            >
              <StatusDot tone={p.name === activeProfileName ? "success" : "ghost"} />
              <div className="flex flex-1 flex-col gap-0.5">
                <span className="text-13 font-medium">{p.name}</span>
                <span className="font-mono text-11 text-ghost whitespace-nowrap">{profileUrl(p)}</span>
              </div>
              <EnvironmentPill environment={profileEnvironment(p)} />
              <ChevronRight size={14} className="text-ghost" strokeWidth={1.5} />
            </button>
          ))}
          <button
            type="button"
            onClick={() => onStateChange({ mode: "new" })}
            className="mt-1 flex h-11 items-center justify-center gap-2 rounded-lg border border-dashed border-border-strong text-13 font-medium text-violet-bright hover:bg-primary/8"
          >
            <Plus size={14} strokeWidth={1.5} />
            New connection
          </button>
        </div>
      </>
    );
  } else if (state.mode === "new") {
    content = (
      <ProfileForm
        key="new"
        mode="new"
        initial={DEFAULT_FORM_VALUES}
        onBack={handleBackToList}
        onClose={handleClose}
        onSaved={handleClose}
        onDeleted={handleBackToList}
      />
    );
  } else {
    const profile = findProfile(profiles, state.profile);
    content = (
      <ProfileForm
        key={state.profile}
        mode="edit"
        initial={profile ? formFromProfile(profile) : DEFAULT_FORM_VALUES}
        onBack={handleBackToList}
        onClose={handleClose}
        onSaved={handleClose}
        onDeleted={handleBackToList}
      />
    );
  }

  return (
    <Sheet
      open
      onOpenChange={(isOpen) => {
        if (!isOpen) handleClose();
      }}
    >
      <SheetContent side="right" showCloseButton={false}>
        {content}
      </SheetContent>
    </Sheet>
  );
}
