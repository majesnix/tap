import { describe, beforeEach, test, expect } from "vitest";
import { useResponseStore } from "./useResponseStore";

// Reset store before each test to prevent state pollution
beforeEach(() => {
  useResponseStore.getState().reset();
});

// ── Initial state ─────────────────────────────────────────────────────────────

describe("initial state", () => {
  test("subscribeStatus is 'Idle' initially", () => {
    const s = useResponseStore.getState();
    expect(s.subscribeStatus).toBe("Idle");
  });

  test("subscribeError is null initially", () => {
    const s = useResponseStore.getState();
    expect(s.subscribeError).toBeNull();
  });
});

// ── setSubscribeStatus action ─────────────────────────────────────────────────

describe("setSubscribeStatus", () => {
  test("setSubscribeStatus('Running') sets status to Running and clears error to null", () => {
    const store = useResponseStore.getState();
    // Arrange: set an error state first
    store.setSubscribeStatus("Error", "previous error");

    // Act
    store.setSubscribeStatus("Running");

    // Assert
    const s = useResponseStore.getState();
    expect(s.subscribeStatus).toBe("Running");
    expect(s.subscribeError).toBeNull();
  });

  test("setSubscribeStatus('Error', 'connection failed') sets status and error message", () => {
    // Act
    useResponseStore.getState().setSubscribeStatus("Error", "connection failed");

    // Assert
    const s = useResponseStore.getState();
    expect(s.subscribeStatus).toBe("Error");
    expect(s.subscribeError).toBe("connection failed");
  });

  test("setSubscribeStatus('Stopping') without error arg sets subscribeError to null (not undefined)", () => {
    // Arrange: set an error first
    useResponseStore.getState().setSubscribeStatus("Error", "some error");

    // Act
    useResponseStore.getState().setSubscribeStatus("Stopping");

    // Assert
    const s = useResponseStore.getState();
    expect(s.subscribeStatus).toBe("Stopping");
    expect(s.subscribeError).toBeNull();
    expect(s.subscribeError).not.toBeUndefined();
  });
});

// ── reset action ──────────────────────────────────────────────────────────────

describe("reset", () => {
  test("reset() restores subscribeStatus to 'Idle' and subscribeError to null", () => {
    // Arrange: put store in non-initial state
    useResponseStore.getState().setSubscribeStatus("Error", "connection lost");

    // Act
    useResponseStore.getState().reset();

    // Assert
    const s = useResponseStore.getState();
    expect(s.subscribeStatus).toBe("Idle");
    expect(s.subscribeError).toBeNull();
  });
});
