import { describe, expect, test, vi, beforeEach, afterEach } from "vitest";

const { mockFetchQueues, mockFetchExchanges } = vi.hoisted(() => ({
  mockFetchQueues: vi.fn(),
  mockFetchExchanges: vi.fn(),
}));
vi.mock("@/lib/ipc", () => ({
  fetchQueues: mockFetchQueues,
  fetchExchanges: mockFetchExchanges,
}));

import { getQueues, getExchanges, invalidateCatalog, CATALOG_TTL_MS } from "@/lib/brokerCatalog";

beforeEach(() => {
  vi.clearAllMocks();
  invalidateCatalog();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("brokerCatalog", () => {
  test("serves concurrent and repeated requests for a profile from one fetch", async () => {
    mockFetchQueues.mockResolvedValue(["a", "b"]);
    const [first, second] = await Promise.all([getQueues("dev"), getQueues("dev")]);
    expect(first).toEqual(["a", "b"]);
    expect(second).toEqual(["a", "b"]);
    await getQueues("dev");
    expect(mockFetchQueues).toHaveBeenCalledTimes(1);
  });

  test("keeps profiles apart", async () => {
    mockFetchQueues.mockResolvedValueOnce(["dev-q"]).mockResolvedValueOnce(["prod-q"]);
    expect(await getQueues("dev")).toEqual(["dev-q"]);
    expect(await getQueues("prod")).toEqual(["prod-q"]);
    expect(mockFetchQueues).toHaveBeenCalledTimes(2);
  });

  test("refetches once the entry is older than the TTL", async () => {
    mockFetchQueues.mockResolvedValue(["a"]);
    await getQueues("dev");
    vi.advanceTimersByTime(CATALOG_TTL_MS + 1);
    await getQueues("dev");
    expect(mockFetchQueues).toHaveBeenCalledTimes(2);
  });

  test("does not cache failures, so the next call retries", async () => {
    mockFetchQueues.mockRejectedValueOnce(new Error("Management API unavailable (HTTP 0)"));
    await expect(getQueues("dev")).rejects.toThrow("unavailable");
    mockFetchQueues.mockResolvedValueOnce(["a"]);
    expect(await getQueues("dev")).toEqual(["a"]);
    expect(mockFetchQueues).toHaveBeenCalledTimes(2);
  });

  test("fresh: true bypasses the cache and replaces the entry", async () => {
    mockFetchQueues.mockResolvedValueOnce(["old"]).mockResolvedValueOnce(["new"]);
    await getQueues("dev");
    expect(await getQueues("dev", { fresh: true })).toEqual(["new"]);
    expect(await getQueues("dev")).toEqual(["new"]);
    expect(mockFetchQueues).toHaveBeenCalledTimes(2);
  });

  test("invalidateCatalog drops one profile or everything", async () => {
    mockFetchQueues.mockResolvedValue(["a"]);
    mockFetchExchanges.mockResolvedValue([{ name: "ex", exchange_type: "direct" }]);
    await getQueues("dev");
    await getExchanges("dev");
    await getQueues("prod");
    invalidateCatalog("dev");
    await getQueues("dev");
    await getExchanges("dev");
    await getQueues("prod");
    expect(mockFetchQueues).toHaveBeenCalledTimes(3);
    expect(mockFetchExchanges).toHaveBeenCalledTimes(2);
    invalidateCatalog();
    await getQueues("prod");
    expect(mockFetchQueues).toHaveBeenCalledTimes(4);
  });
});
