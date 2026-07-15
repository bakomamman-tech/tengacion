describe("artist music tax environment configuration", () => {
  const originalEnv = { ...process.env };

  const configureTaxEnv = (overrides = {}) => {
    process.env = {
      ...originalEnv,
      NODE_ENV: "test",
      MONGO_URI:
        originalEnv.MONGO_URI || "mongodb://127.0.0.1:27017/tengacion-tax-env-test",
      JWT_SECRET:
        originalEnv.JWT_SECRET || "test_secret_1234567890123456789012",
      ARTIST_MUSIC_TAX_ENABLED: "true",
      ARTIST_MUSIC_TAX_RATE_BPS: "750",
      ARTIST_MUSIC_TAX_PRICE_MODE: "inclusive",
      ARTIST_MUSIC_TAX_EFFECTIVE_AT: "2026-07-14T23:00:00.000Z",
      ARTIST_MUSIC_TAX_CURRENCIES: "NGN",
      ARTIST_MUSIC_TAX_JURISDICTION: "NG",
      ...overrides,
    };
    jest.resetModules();
  };

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.resetModules();
  });

  test("accepts only the currencies exposed by checkout", () => {
    configureTaxEnv({ ARTIST_MUSIC_TAX_CURRENCIES: "NGN, USD" });

    const { config } = require("../config/env");

    expect(config.artistMusicTax.currencies).toEqual(["NGN", "USD"]);
  });

  test.each(["NGR", "EUR", "naira"])(
    "rejects unsupported checkout currency %s",
    (currency) => {
      configureTaxEnv({ ARTIST_MUSIC_TAX_CURRENCIES: currency });

      expect(() => require("../config/env")).toThrow(
        /supported checkout currencies: NGN or USD/i
      );
    }
  );
});
