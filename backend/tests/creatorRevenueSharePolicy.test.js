const {
  CREATOR_CONTENT_REVENUE_SHARE_POLICY,
  LEGACY_REVENUE_SHARE_POLICY,
  buildRevenueShareSnapshot,
  computePurchaseRevenueShare,
} = require("../services/creatorRevenueSharePolicy");

describe("creatorRevenueSharePolicy", () => {
  test.each([
    [{ itemType: "track", payload: { kind: "music" } }, "music"],
    [{ itemType: "track", payload: { kind: "podcast" } }, "podcasts"],
    [{ itemType: "book", payload: {} }, "books"],
    [{ itemType: "album", payload: {} }, "music"],
    [{ itemType: "video", payload: {} }, "music"],
  ])("applies the new 40% platform share to eligible creator content", (item, category) => {
    expect(buildRevenueShareSnapshot(item)).toEqual({
      revenueCategory: category,
      revenueSharePolicy: CREATOR_CONTENT_REVENUE_SHARE_POLICY,
      creatorShareRate: 0.6,
      platformShareRate: 0.4,
    });
  });

  test("keeps creator subscriptions on the existing split", () => {
    expect(buildRevenueShareSnapshot({ itemType: "subscription" })).toEqual({
      revenueCategory: "subscriptions",
      revenueSharePolicy: LEGACY_REVENUE_SHARE_POLICY,
      creatorShareRate: 0.4,
      platformShareRate: 0.6,
    });
  });

  test("does not apply the creator-content change to comedy tracks", () => {
    expect(
      buildRevenueShareSnapshot({
        itemType: "track",
        payload: { kind: "comedy", creatorCategory: "music" },
      })
    ).toEqual({
      revenueCategory: "other",
      revenueSharePolicy: LEGACY_REVENUE_SHARE_POLICY,
      creatorShareRate: 0.4,
      platformShareRate: 0.6,
    });
  });

  test("treats purchases without a stored snapshot as historical", () => {
    expect(computePurchaseRevenueShare({ amount: 2500 })).toMatchObject({
      grossAmount: 2500,
      creatorAmount: 1000,
      platformAmount: 1500,
      creatorShareRate: 0.4,
      platformShareRate: 0.6,
      isLegacyFallback: true,
    });
  });

  test("uses the stored split for settlement and later refunds", () => {
    expect(
      computePurchaseRevenueShare({
        amount: 2500,
        revenueCategory: "music",
        revenueSharePolicy: CREATOR_CONTENT_REVENUE_SHARE_POLICY,
        creatorShareRate: 0.6,
        platformShareRate: 0.4,
      })
    ).toMatchObject({
      grossAmount: 2500,
      creatorAmount: 1500,
      platformAmount: 1000,
      isLegacyFallback: false,
    });
  });
});
