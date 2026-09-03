import { describe, expect, test } from "vitest";
import { isLocalHost } from "@/lib/hosts";

describe("isLocalHost", () => {
  test.each(["localhost", "LOCALHOST", " localhost ", "127.0.0.1", "127.1.2.3", "::1", "[::1]"])(
    "treats %j as local",
    (host) => {
      expect(isLocalHost(host)).toBe(true);
    }
  );

  test.each(["rabbit.example.com", "10.0.0.5", "192.168.1.10", "localhost.example.com", "", "   "])(
    "treats %j as remote",
    (host) => {
      expect(isLocalHost(host)).toBe(false);
    }
  );

  test("treats an unknown host as remote so the caller asks before acting", () => {
    expect(isLocalHost(undefined)).toBe(false);
    expect(isLocalHost(null)).toBe(false);
  });
});
