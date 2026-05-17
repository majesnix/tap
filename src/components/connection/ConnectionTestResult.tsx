import { Loader2, CheckCircle2, XCircle } from "lucide-react";

type TestState = "idle" | "testing" | "success" | "error";

interface ConnectionTestResultProps {
  state: TestState;
  errorMessage?: string | null;
}

export function ConnectionTestResult({ state, errorMessage }: ConnectionTestResultProps) {
  if (state === "idle") return null;

  return (
    <div className="flex items-center gap-2 text-sm">
      {state === "testing" && (
        <>
          <Loader2 className="animate-spin w-4 h-4" />
          <span className="text-muted-foreground">Testing connection…</span>
        </>
      )}
      {state === "success" && (
        <>
          <CheckCircle2 className="text-emerald-500 w-4 h-4" />
          <span className="text-emerald-500">Connected</span>
        </>
      )}
      {state === "error" && (
        <>
          <XCircle className="text-destructive w-4 h-4" />
          <span className="text-destructive">{errorMessage ?? "Connection failed"}</span>
        </>
      )}
    </div>
  );
}
