import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchRecommendations } from "./recommendation";

const mockFetch = (payload: unknown, ok = true) => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok,
      text: async () => JSON.stringify(payload)
    }))
  );
};

describe("recommendation api", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("normalizes backend recommendation envelopes", async () => {
    mockFetch({
      code: 0,
      data: [
        {
          id: "11",
          rec_type: "course",
          ref_id: "42",
          reason: "Balance heavy lower-body days with recovery work."
        }
      ]
    });

    await expect(fetchRecommendations(7)).resolves.toEqual([
      {
        id: 11,
        recType: "course",
        refId: 42,
        reason: "Balance heavy lower-body days with recovery work."
      }
    ]);

    expect(fetch).toHaveBeenCalledWith(
      "/api/v1/recommendation?user_id=7",
      expect.objectContaining({ method: "GET" })
    );
  });

  it("throws backend error messages for failed recommendation requests", async () => {
    mockFetch({ message: "database unavailable" }, false);

    await expect(fetchRecommendations(7)).rejects.toThrow("database unavailable");
  });
});
