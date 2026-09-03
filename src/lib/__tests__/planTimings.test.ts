import { describe, expect, test } from "vitest";
import {
  STEP_DELAY_MAX_MS,
  REPLY_TIMEOUT_MAX_MS,
  clampStepDelay,
  clampReplyTimeout,
} from "@/lib/planTimings";

describe("plan step timing bounds", () => {
  test("delay is clamped into [0, max] and falls back to the default when unparsable", () => {
    expect(clampStepDelay("200")).toBe(200);
    expect(clampStepDelay("-5")).toBe(0);
    expect(clampStepDelay(String(STEP_DELAY_MAX_MS + 1))).toBe(STEP_DELAY_MAX_MS);
    expect(clampStepDelay("abc")).toBe(200);
  });

  test("reply timeout is clamped into [1, max] and falls back to the default when unparsable", () => {
    expect(clampReplyTimeout("10000")).toBe(10000);
    expect(clampReplyTimeout("0")).toBe(1);
    expect(clampReplyTimeout(String(REPLY_TIMEOUT_MAX_MS * 10))).toBe(REPLY_TIMEOUT_MAX_MS);
    expect(clampReplyTimeout("")).toBe(10000);
  });
});
