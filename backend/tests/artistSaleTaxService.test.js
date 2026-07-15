const {
  CONFIGURED_ARTIST_MUSIC_TAX_POLICY,
  LEGACY_TAX_SNAPSHOT_POLICY,
  NO_TAX_SNAPSHOT_POLICY,
  PROVIDER_REPORTED_TAX_POLICY,
  buildArtistSaleTaxSnapshot,
  normalizeArtistMusicTaxConfig,
  resolveSettlementTaxSnapshot,
} = require("../services/artistSaleTaxService");

const EFFECTIVE_AT = new Date("2026-07-14T23:00:00.000Z");

const buildConfig = (overrides = {}) => ({
  enabled: true,
  rateBps: 750,
  priceMode: "inclusive",
  effectiveAt: EFFECTIVE_AT,
  currencies: ["NGN"],
  jurisdiction: "NG",
  ...overrides,
});

describe("artistSaleTaxService", () => {
  describe("checkout snapshots", () => {
    test("is disabled by default and never guesses a tax rate", () => {
      expect(
        buildArtistSaleTaxSnapshot({
          item: { itemType: "track", revenueCategory: "music" },
          listedPriceAmount: 10000,
          currency: "NGN",
          effectiveAt: EFFECTIVE_AT,
          taxConfig: buildConfig({ enabled: false, rateBps: 0 }),
        })
      ).toMatchObject({
        listedPriceAmount: 10000,
        chargeAmount: 10000,
        taxableBaseAmount: 10000,
        taxAmount: 0,
        taxRateBps: null,
        taxSource: "none",
        taxPolicy: NO_TAX_SNAPSHOT_POLICY,
        taxProviderReported: false,
      });
    });

    test("extracts inclusive tax without changing the displayed checkout total", () => {
      expect(
        buildArtistSaleTaxSnapshot({
          item: { itemType: "track", revenueCategory: "music" },
          listedPriceAmount: 10000,
          currency: "NGN",
          effectiveAt: EFFECTIVE_AT,
          taxConfig: buildConfig(),
        })
      ).toEqual({
        listedPriceAmount: 10000,
        chargeAmount: 10000,
        taxableBaseAmount: 9302.33,
        taxAmount: 697.67,
        taxRateBps: 750,
        taxPriceMode: "inclusive",
        taxSource: "configured",
        taxPolicy: CONFIGURED_ARTIST_MUSIC_TAX_POLICY,
        taxJurisdiction: "NG",
        taxProviderReported: false,
        taxEffectiveAt: EFFECTIVE_AT,
      });
    });

    test.each([
      [
        "non-music content",
        { itemType: "book", revenueCategory: "books" },
        "NGN",
        EFFECTIVE_AT,
      ],
      [
        "a currency outside the configured scope",
        { itemType: "track", revenueCategory: "music" },
        "USD",
        EFFECTIVE_AT,
      ],
      [
        "a purchase before the effective instant",
        { itemType: "track", revenueCategory: "music" },
        "NGN",
        new Date("2026-07-14T22:59:59.999Z"),
      ],
    ])("does not apply configured tax to %s", (_label, item, currency, effectiveAt) => {
      expect(
        buildArtistSaleTaxSnapshot({
          item,
          listedPriceAmount: 2500,
          currency,
          effectiveAt,
          taxConfig: buildConfig(),
        })
      ).toMatchObject({ taxAmount: 0, taxSource: "none" });
    });
  });

  describe("settlement resolution", () => {
    const persistedPurchase = {
      amount: 10000,
      listedPriceAmount: 10000,
      taxableBaseAmount: 9302.33,
      taxAmount: 697.67,
      taxRateBps: 750,
      taxPriceMode: "inclusive",
      taxSource: "configured",
      taxPolicy: CONFIGURED_ARTIST_MUSIC_TAX_POLICY,
      taxJurisdiction: "NG",
      taxProviderReported: false,
      taxEffectiveAt: EFFECTIVE_AT,
    };

    test("keeps the persisted checkout snapshot when the provider omits tax", () => {
      expect(
        resolveSettlementTaxSnapshot({
          purchase: persistedPurchase,
          providerTaxAmount: 0,
          providerTaxReported: false,
          settledAt: new Date("2026-07-16T00:00:00.000Z"),
        })
      ).toMatchObject({
        taxAmount: 697.67,
        taxableBaseAmount: 9302.33,
        taxSource: "configured",
        taxPolicy: CONFIGURED_ARTIST_MUSIC_TAX_POLICY,
        taxProviderReported: false,
        taxEffectiveAt: EFFECTIVE_AT,
      });
    });

    test("prefers an authoritative provider tax, including a reported zero", () => {
      expect(
        resolveSettlementTaxSnapshot({
          purchase: persistedPurchase,
          providerTaxAmount: 0,
          providerTaxReported: true,
          settledAt: new Date("2026-07-16T00:00:00.000Z"),
        })
      ).toMatchObject({
        taxableBaseAmount: 10000,
        taxAmount: 0,
        taxRateBps: null,
        taxPriceMode: null,
        taxSource: "provider",
        taxPolicy: PROVIDER_REPORTED_TAX_POLICY,
        taxJurisdiction: "",
        taxProviderReported: true,
      });
    });

    test("rejects a provider tax larger than the charged amount", () => {
      expect(() =>
        resolveSettlementTaxSnapshot({
          purchase: persistedPurchase,
          providerTaxAmount: 10000.01,
          providerTaxReported: true,
        })
      ).toThrow(/cannot exceed purchase\.amount/i);
    });

    test("requires a value when a provider marks tax as reported", () => {
      expect(() =>
        resolveSettlementTaxSnapshot({
          purchase: persistedPurchase,
          providerTaxAmount: null,
          providerTaxReported: true,
        })
      ).toThrow(/providerTaxAmount must be a non-negative number/i);
    });

    test("preserves a positive legacy tax without inventing provider provenance", () => {
      expect(
        resolveSettlementTaxSnapshot({
          purchase: {
            amount: 10000,
            taxAmount: 500,
            taxSource: "none",
          },
          providerTaxReported: false,
          settledAt: new Date("2026-07-16T00:00:00.000Z"),
        })
      ).toMatchObject({
        taxableBaseAmount: 9500,
        taxAmount: 500,
        taxSource: "legacy",
        taxPolicy: LEGACY_TAX_SNAPSHOT_POLICY,
        taxProviderReported: false,
      });
    });

    test("preserves an explicit stored provider marker, including reported zero", () => {
      expect(
        resolveSettlementTaxSnapshot({
          purchase: {
            amount: 10000,
            taxAmount: 0,
            taxSource: "none",
            taxProviderReported: true,
          },
          providerTaxReported: false,
          settledAt: new Date("2026-07-16T00:00:00.000Z"),
        })
      ).toMatchObject({
        taxableBaseAmount: 10000,
        taxAmount: 0,
        taxSource: "provider",
        taxPolicy: LEGACY_TAX_SNAPSHOT_POLICY,
        taxProviderReported: true,
      });
    });
  });

  describe("configuration validation", () => {
    test("normalizes configured currencies and dates", () => {
      expect(
        normalizeArtistMusicTaxConfig({
          enabled: "true",
          rateBps: 750,
          priceMode: "INCLUSIVE",
          effectiveAt: EFFECTIVE_AT.toISOString(),
          currencies: "ngn, usd",
          jurisdiction: "ng",
        })
      ).toEqual({
        enabled: true,
        rateBps: 750,
        priceMode: "inclusive",
        effectiveAt: EFFECTIVE_AT,
        currencies: ["NGN", "USD"],
        jurisdiction: "NG",
      });
    });

    test.each([
      [{ enabled: true, rateBps: 0 }, /greater than 0/i],
      [{ enabled: true, rateBps: 750, jurisdiction: "" }, /jurisdiction is required/i],
      [{ enabled: true, rateBps: 10001 }, /0 to 10000/i],
      [{ enabled: true, rateBps: 750, priceMode: "exclusive" }, /must be inclusive/i],
      [
        { enabled: true, rateBps: 750, currencies: ["naira"] },
        /supported checkout currencies/i,
      ],
      [
        { enabled: true, rateBps: 750, currencies: ["NGR"] },
        /supported checkout currencies/i,
      ],
    ])("rejects unsafe tax configuration %#", (overrides, expectedError) => {
      expect(() => normalizeArtistMusicTaxConfig(buildConfig(overrides))).toThrow(
        expectedError
      );
    });
  });
});
