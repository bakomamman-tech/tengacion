import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("route page-view analytics", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
    window.gtag = vi.fn();
    const analyticsScript = document.createElement("script");
    analyticsScript.setAttribute("data-analytics", "google-tag-manager");
    document.head.appendChild(analyticsScript);
  });

  afterEach(() => {
    document.head
      .querySelectorAll('script[data-analytics="google-tag-manager"]')
      .forEach((script) => script.remove());
    delete window.gtag;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("sends the registered route pattern without URL details", async () => {
    const { setSessionAccessToken } = await import("../authSession");
    setSessionAccessToken("session-access-token");
    const { trackPageView } = await import("./analytics");

    await expect(
      trackPageView({
        path: "/creator/creator.example/books?token=secret#private",
        navigationKey: "navigation-1",
      })
    ).resolves.toBe(true);

    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, options] = fetch.mock.calls[0];
    expect(url).toBe("/api/analytics/route-views");
    expect(options).toEqual(
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        keepalive: true,
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer session-access-token",
        },
      })
    );
    expect(JSON.parse(options.body)).toEqual({
      contractVersion: 1,
      featureId: "public_creator_profiles",
      routePattern: "/creator/:username/books",
    });
    expect(options.body).not.toMatch(/creator\.example|secret|private|token/i);
  });

  it("does not emit unclassified or duplicate router locations", async () => {
    const { trackPageView } = await import("./analytics");

    await expect(
      trackPageView({ path: "/not-a-tengacion-route", navigationKey: "missing" })
    ).resolves.toBe(false);
    await expect(
      trackPageView({ path: "/home?source=first", navigationKey: "navigation-2" })
    ).resolves.toBe(true);
    await expect(
      trackPageView({ path: "/home?source=second", navigationKey: "navigation-2" })
    ).resolves.toBe(false);

    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
