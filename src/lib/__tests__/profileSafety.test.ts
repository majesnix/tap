import { describe, expect, test } from "vitest";
import {
  profileEnvironment,
  requiresConfirmation,
  isReadOnly,
  ENVIRONMENT_LABELS,
} from "@/lib/profileSafety";
import type { ConnectionProfile } from "@/lib/types";

const base: ConnectionProfile = {
  name: "p",
  host: "rabbit.example.internal",
  port: 5672,
  vhost: "/",
  username: "dev",
  management_port: 15672,
  management_ssl: false,
};

describe("profileEnvironment", () => {
  test("uses the explicit tag when present", () => {
    expect(profileEnvironment({ ...base, environment: "production" })).toBe("production");
    expect(profileEnvironment({ ...base, host: "localhost", environment: "shared" })).toBe("shared");
  });

  test("infers local from the host when untagged", () => {
    expect(profileEnvironment({ ...base, host: "localhost" })).toBe("local");
    expect(profileEnvironment({ ...base, host: "127.0.0.1" })).toBe("local");
  });

  test("treats untagged remote hosts and unknown profiles as shared", () => {
    expect(profileEnvironment(base)).toBe("shared");
    expect(profileEnvironment(undefined)).toBe("shared");
  });
});

describe("requiresConfirmation", () => {
  test("consume and subscribe are confirmed on anything that is not local", () => {
    expect(requiresConfirmation({ ...base, host: "localhost" }, "consume")).toBe(false);
    expect(requiresConfirmation(base, "consume")).toBe(true);
    expect(requiresConfirmation({ ...base, environment: "shared" }, "subscribe")).toBe(true);
    expect(requiresConfirmation({ ...base, host: "localhost", environment: "production" }, "subscribe")).toBe(true);
    expect(requiresConfirmation(undefined, "consume")).toBe(true);
  });

  test("publish is confirmed only on production", () => {
    expect(requiresConfirmation(base, "publish")).toBe(false);
    expect(requiresConfirmation({ ...base, environment: "shared" }, "publish")).toBe(false);
    expect(requiresConfirmation({ ...base, environment: "production" }, "publish")).toBe(true);
    expect(requiresConfirmation(undefined, "publish")).toBe(false);
  });
});

describe("isReadOnly", () => {
  test("is true only for profiles flagged read_only", () => {
    expect(isReadOnly(base)).toBe(false);
    expect(isReadOnly({ ...base, read_only: true })).toBe(true);
    expect(isReadOnly(undefined)).toBe(false);
  });
});

describe("ENVIRONMENT_LABELS", () => {
  test("has a label for every environment", () => {
    expect(ENVIRONMENT_LABELS.local).toBe("Local");
    expect(ENVIRONMENT_LABELS.shared).toBe("Shared");
    expect(ENVIRONMENT_LABELS.production).toBe("Production");
  });
});
