import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { apiRequest } from "../api";
import { clearSessionAccessToken, setSessionAccessToken } from "../authSession";

const jsonResponse = (payload, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });

describe("apiRequest auth handling", () => {
  beforeEach(() => {
    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      value: true,
    });
  });

  afterEach(() => {
    clearSessionAccessToken();
    vi.restoreAllMocks();
  });

  it("adds the current bearer token to direct apiRequest calls", async () => {
    setSessionAccessToken("token-123");
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse({ ok: true }));

    await apiRequest("/api/posts/post-1/like", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, requestInit] = fetchMock.mock.calls[0];
    expect(requestInit.headers.get("Authorization")).toBe("Bearer token-123");
    expect(requestInit.headers.get("Content-Type")).toBe("application/json");
  });

  it("retries with the refreshed bearer token after a 401", async () => {
    setSessionAccessToken("stale-token");
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse({ error: "Invalid token" }, 401))
      .mockResolvedValueOnce(jsonResponse({ token: "fresh-token" }))
      .mockResolvedValueOnce(jsonResponse({ liked: true, likesCount: 3 }));

    const result = await apiRequest("/api/posts/post-1/like", {
      method: "POST",
    });

    expect(result).toMatchObject({ liked: true, likesCount: 3 });
    expect(fetchMock).toHaveBeenCalledTimes(3);

    const [, firstRequestInit] = fetchMock.mock.calls[0];
    expect(firstRequestInit.headers.get("Authorization")).toBe("Bearer stale-token");

    const [, retryRequestInit] = fetchMock.mock.calls[2];
    expect(retryRequestInit.headers.get("Authorization")).toBe("Bearer fresh-token");
  });
});
