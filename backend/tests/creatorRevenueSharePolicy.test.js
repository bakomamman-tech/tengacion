const {
  ARTIST_MUSIC_CREATOR_SHARE_RATE,
  ARTIST_MUSIC_PLATFORM_SHARE_RATE,
  ARTIST_MUSIC_REVENUE_SHARE_POLICY,
  ARTIST_MUSIC_SPLIT_EFFECTIVE_AT,
  CREATOR_CONTENT_REVENUE_SHARE_POLICY,
  LEGACY_REVENUE_SHARE_POLICY,
  buildRevenueShareSnapshot,
  buildSettlementRevenueShareSnapshot,
  computePurchaseRevenueShare,
} = require("../services/creatorRevenueSharePolicy");
const {
  estimatePaystackProcessingFee,
  normalizePaystackResponse,
  resolvePaystackTransactionPaidAt,
  resolvePaystackTransactionDeductions,
} = require("../services/paystackService");

const BEFORE_ARTIST_POLICY = new Date("2026-07-14T22:59:59.999Z");
const AT_ARTIST_POLICY = new Date("2026-07-15T00:00:00+01:00");

describe("creatorRevenueSharePolicy", () => {
  describe("effective date and eligible music", () => {
    test("uses midnight on 15 July 2026 in Africa/Lagos as the exact cutoff", () => {
      expect(ARTIST_MUSIC_SPLIT_EFFECTIVE_AT.toISOString()).toBe(
        "2026-07-14T23:00:00.000Z"
      );

      expect(
        buildRevenueShareSnapshot(
          { itemType: "track", payload: { kind: "music" } },
          { effectiveAt: BEFORE_ARTIST_POLICY }
        )
      ).toEqual({
        revenueCategory: "music",
        revenueSharePolicy: CREATOR_CONTENT_REVENUE_SHARE_POLICY,
        creatorShareRate: 0.6,
        platformShareRate: 0.4,
      });

      expect(
        buildRevenueShareSnapshot(
          { itemType: "track", payload: { kind: "music" } },
          { effectiveAt: AT_ARTIST_POLICY }
        )
      ).toEqual({
        revenueCategory: "music",
        revenueSharePolicy: ARTIST_MUSIC_REVENUE_SHARE_POLICY,
        creatorShareRate: ARTIST_MUSIC_CREATOR_SHARE_RATE,
        platformShareRate: ARTIST_MUSIC_PLATFORM_SHARE_RATE,
      });
    });

    test.each(["track", "song", "songs", "album", "albums"])(
      "applies 75/25 to eligible %s sales on or after the cutoff",
      (itemType) => {
        expect(
          buildRevenueShareSnapshot(
            { itemType, payload: { creatorCategory: "music" } },
            { effectiveAt: AT_ARTIST_POLICY }
          )
        ).toEqual({
          revenueCategory: "music",
          revenueSharePolicy: ARTIST_MUSIC_REVENUE_SHARE_POLICY,
          creatorShareRate: 0.75,
          platformShareRate: 0.25,
        });
      }
    );

    test.each([
      [{ itemType: "book", payload: {} }, "books", CREATOR_CONTENT_REVENUE_SHARE_POLICY, 0.6, 0.4],
      [
        { itemType: "track", payload: { kind: "podcast" } },
        "podcasts",
        CREATOR_CONTENT_REVENUE_SHARE_POLICY,
        0.6,
        0.4,
      ],
      [{ itemType: "video", payload: {} }, "music", CREATOR_CONTENT_REVENUE_SHARE_POLICY, 0.6, 0.4],
      [{ itemType: "subscription" }, "subscriptions", LEGACY_REVENUE_SHARE_POLICY, 0.4, 0.6],
      [
        { itemType: "track", payload: { kind: "comedy", creatorCategory: "music" } },
        "other",
        LEGACY_REVENUE_SHARE_POLICY,
        0.4,
        0.6,
      ],
    ])(
      "keeps the existing policy for excluded content %#",
      (item, revenueCategory, revenueSharePolicy, creatorShareRate, platformShareRate) => {
        expect(buildRevenueShareSnapshot(item, { effectiveAt: AT_ARTIST_POLICY })).toEqual({
          revenueCategory,
          revenueSharePolicy,
          creatorShareRate,
          platformShareRate,
        });
      }
    );
  });

  describe("settlement snapshots", () => {
    test("refreshes a pre-cutoff pending music snapshot when settlement occurs after cutoff", () => {
      const preCutoffSnapshot = buildRevenueShareSnapshot(
        { itemType: "track", payload: { kind: "music" } },
        { effectiveAt: BEFORE_ARTIST_POLICY }
      );

      expect(
        buildSettlementRevenueShareSnapshot(
          {
            itemType: "track",
            status: "pending",
            ...preCutoffSnapshot,
          },
          { settledAt: AT_ARTIST_POLICY }
        )
      ).toEqual({
        revenueCategory: "music",
        revenueSharePolicy: ARTIST_MUSIC_REVENUE_SHARE_POLICY,
        creatorShareRate: 0.75,
        platformShareRate: 0.25,
      });
    });

    test("uses the stored category when refreshing a pending podcast track", () => {
      expect(
        buildSettlementRevenueShareSnapshot(
          {
            itemType: "track",
            status: "pending",
            revenueCategory: "podcasts",
            revenueSharePolicy: CREATOR_CONTENT_REVENUE_SHARE_POLICY,
            creatorShareRate: 0.6,
            platformShareRate: 0.4,
          },
          { settledAt: AT_ARTIST_POLICY }
        )
      ).toEqual({
        revenueCategory: "podcasts",
        revenueSharePolicy: CREATOR_CONTENT_REVENUE_SHARE_POLICY,
        creatorShareRate: 0.6,
        platformShareRate: 0.4,
      });
    });

    test("keeps a paid purchase's stored snapshot valid after the cutoff", () => {
      const paidPurchase = {
        itemType: "track",
        status: "paid",
        paidAt: BEFORE_ARTIST_POLICY,
        amount: 2500,
        revenueCategory: "music",
        revenueSharePolicy: CREATOR_CONTENT_REVENUE_SHARE_POLICY,
        creatorShareRate: 0.6,
        platformShareRate: 0.4,
      };

      expect(
        buildSettlementRevenueShareSnapshot(paidPurchase, {
          settledAt: AT_ARTIST_POLICY,
        })
      ).toEqual({
        revenueCategory: "music",
        revenueSharePolicy: CREATOR_CONTENT_REVENUE_SHARE_POLICY,
        creatorShareRate: 0.6,
        platformShareRate: 0.4,
      });
      expect(computePurchaseRevenueShare(paidPurchase)).toMatchObject({
        creatorAmount: 1500,
        platformAmount: 1000,
        isLegacyFallback: false,
      });
    });

    test("treats purchases without a stored snapshot as historical", () => {
      expect(computePurchaseRevenueShare({ amount: 2500 })).toMatchObject({
        grossAmount: 2500,
        netRevenueAmount: 2500,
        creatorAmount: 1000,
        platformAmount: 1500,
        creatorShareRate: 0.4,
        platformShareRate: 0.6,
        isLegacyFallback: true,
      });
    });
  });

  describe("net-revenue allocation", () => {
    test("deducts processing fees and tax before applying the artist 75/25 split", () => {
      expect(
        computePurchaseRevenueShare({
          amount: 10000,
          processingFeeAmount: 250,
          taxAmount: 500,
          revenueCategory: "music",
          revenueSharePolicy: ARTIST_MUSIC_REVENUE_SHARE_POLICY,
          creatorShareRate: 0.75,
          platformShareRate: 0.25,
        })
      ).toMatchObject({
        grossAmount: 10000,
        processingFeeAmount: 250,
        taxAmount: 500,
        netRevenueAmount: 9250,
        shareBaseAmount: 9250,
        creatorAmount: 6937.5,
        platformAmount: 2312.5,
      });
    });

    test("rounds the artist share first for a NGN 2,500 local Paystack sale", () => {
      expect(
        computePurchaseRevenueShare({
          amount: 2500,
          processingFeeAmount: 137.5,
          taxAmount: 0,
          revenueCategory: "music",
          revenueSharePolicy: ARTIST_MUSIC_REVENUE_SHARE_POLICY,
          creatorShareRate: 0.75,
          platformShareRate: 0.25,
        })
      ).toMatchObject({
        grossAmount: 2500,
        processingFeeAmount: 137.5,
        netRevenueAmount: 2362.5,
        creatorAmount: 1771.88,
        platformAmount: 590.62,
      });
    });

    test("clamps net revenue at zero when deductions exceed the sale price", () => {
      expect(
        computePurchaseRevenueShare({
          amount: 100,
          processingFeeAmount: 80,
          taxAmount: 30,
          revenueCategory: "music",
          revenueSharePolicy: ARTIST_MUSIC_REVENUE_SHARE_POLICY,
          creatorShareRate: 0.75,
          platformShareRate: 0.25,
        })
      ).toMatchObject({
        grossAmount: 100,
        netRevenueAmount: 0,
        creatorAmount: 0,
        platformAmount: 0,
      });
    });

    test("reports deductions but preserves gross-based allocation for existing policies", () => {
      expect(
        computePurchaseRevenueShare({
          amount: 10000,
          processingFeeAmount: 250,
          taxAmount: 500,
          revenueCategory: "books",
          revenueSharePolicy: CREATOR_CONTENT_REVENUE_SHARE_POLICY,
          creatorShareRate: 0.6,
          platformShareRate: 0.4,
        })
      ).toMatchObject({
        grossAmount: 10000,
        processingFeeAmount: 250,
        taxAmount: 500,
        netRevenueAmount: 9250,
        shareBaseAmount: 10000,
        creatorAmount: 6000,
        platformAmount: 4000,
      });
    });

    test("rounds money while keeping creator and platform allocations equal to net revenue", () => {
      const result = computePurchaseRevenueShare({
        amount: 99.99,
        processingFeeAmount: 1.23,
        taxAmount: 0.45,
        revenueCategory: "music",
        revenueSharePolicy: ARTIST_MUSIC_REVENUE_SHARE_POLICY,
        creatorShareRate: 0.75,
        platformShareRate: 0.25,
      });

      expect(result.netRevenueAmount).toBe(98.31);
      expect(result.creatorAmount).toBe(73.73);
      expect(result.platformAmount).toBe(24.58);
      expect(result.creatorAmount + result.platformAmount).toBe(result.netRevenueAmount);
    });
  });
});

describe("Paystack processing-fee deductions", () => {
  test.each([
    [1000, 15],
    [2499, 37.49],
    [2500, 137.5],
    [10000, 250],
    [200000, 2000],
  ])("estimates the Nigerian local fee for NGN %s", (grossAmount, expectedFee) => {
    expect(estimatePaystackProcessingFee({ grossAmount, cardCountry: "NG" })).toBe(
      expectedFee
    );
  });

  test("uses the international card rate when provider card country is outside Nigeria", () => {
    expect(estimatePaystackProcessingFee({ grossAmount: 10000, cardCountry: "US" })).toBe(490);
  });

  test("prefers the verified provider fee and provider tax over estimates", () => {
    expect(
      resolvePaystackTransactionDeductions({
        transaction: {
          fees: 32500,
          tax_amount: 12550,
          authorization: { country_code: "US" },
        },
        grossAmount: 10000,
        taxAmount: 50,
      })
    ).toEqual({
      processingFeeAmount: 325,
      taxAmount: 125.5,
      taxProviderReported: true,
      processingFeeEstimated: false,
      cardCountry: "US",
    });
  });

  test("respects a verified zero provider fee", () => {
    expect(
      resolvePaystackTransactionDeductions({
        transaction: {
          fees: 0,
          authorization: { country_code: "NG" },
        },
        grossAmount: 10000,
      })
    ).toMatchObject({
      processingFeeAmount: 0,
      processingFeeEstimated: false,
    });
  });

  test("falls back to the official estimate and the Purchase tax field", () => {
    expect(
      resolvePaystackTransactionDeductions({
        transaction: { authorization: { country_code: "NG" } },
        grossAmount: 2500,
        taxAmount: 75,
      })
    ).toEqual({
      processingFeeAmount: 137.5,
      taxAmount: 75,
      taxProviderReported: false,
      processingFeeEstimated: true,
      cardCountry: "NG",
    });
  });

  test("normalizes verified Paystack minor-unit fields and card country", () => {
    const paidAt = "2026-07-14T22:45:00.000Z";
    expect(
      normalizePaystackResponse({
        status: true,
        data: {
          status: "success",
          amount: 1000000,
          fees: 25000,
          tax_amount: 5000,
          paid_at: paidAt,
          currency: "NGN",
          authorization: { country_code: "ng" },
        },
      })
    ).toMatchObject({
      status: "success",
      amount: 10000,
      amountKobo: 1000000,
      feesKobo: 25000,
      processingFeeAmount: 250,
      taxAmount: 50,
      cardCountry: "NG",
      paidAt: new Date(paidAt),
    });
  });

  test("uses Paystack's verified payment time for effective-date decisions", () => {
    expect(
      resolvePaystackTransactionPaidAt(
        { raw: { paid_at: "2026-07-14T22:59:59.000Z" } },
        new Date("2026-07-15T01:00:00.000Z")
      )
    ).toEqual(new Date("2026-07-14T22:59:59.000Z"));
  });
});
