import { CircleCheck, CircleAlert, LoaderCircle } from "lucide-react";

type TestState = "idle" | "testing" | "success" | "error";

interface ConnectionTestResultProps {
  state: TestState;
  errorMessage?: string | null;
  /** Round-trip time measured around the test_connection call, when known. */
  latencyMs?: number;
}

export function ConnectionTestResult({ state, errorMessage, latencyMs }: ConnectionTestResultProps) {
  if (state === "idle") return null;

  if (state === "testing") {
    return (
      <span className="flex items-center gap-1.5 text-12 text-muted-foreground">
        <LoaderCircle size={13} className="animate-spin" />
        Testing…
      </span>
    );
  }

  if (state === "success") {
    return (
      <span className="flex items-center gap-1.5 text-12 text-success">
        <CircleCheck size={13} />
        {typeof latencyMs === "number" ? `Reachable · ${latencyMs} ms` : "Reachable"}
      </span>
    );
  }

  return (
    <span className="flex items-center gap-1.5 text-12 text-danger">
      <CircleAlert size={13} />
      {errorMessage ?? "Connection failed"}
    </span>
  );
}
