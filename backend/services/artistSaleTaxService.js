const { config } = require("../config/env");
const { isArtistMusicItem } = require("./creatorRevenueSharePolicy");

const CONFIGURED_ARTIST_MUSIC_TAX_POLICY = "artist_music_configured_tax_v1";
const NO_TAX_SNAPSHOT_POLICY = "artist_music_no_tax_v1";
const PROVIDER_REPORTED_TAX_POLICY = "provider_reported_tax_v1";
const LEGACY_TAX_SNAPSHOT_POLICY = "legacy_tax_snapshot_v1";

const PRICE_MODES = new Set(["inclusive", "exclusive"]);
const TAX_SOURCES = new Set(["none", "configured", "provider", "legacy"]);
const SUPPORTED_ARTIST_MUSIC_TAX_CURRENCIES = new Set(["NGN", "USD"]);

const roundMoney = (value) =>
  Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

const normalizeText = (value = "") => String(value || "").trim();

const normalizeBoolean = (value) => {
  if (typeof value === "boolean") return value;
  return ["1", "true", "yes", "on"].includes(normalizeText(value).toLowerCase());
};

const normalizeDate = (value, label) => {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (!Number.isFinite(date.getTime())) {
    throw new TypeError(`${label} must be a valid date-time`);
  }
  return date;
};

const normalizeAmount = (value, label, { allowNull = false } = {}) => {
  if (value == null || value === "") {
    if (allowNull) return null;
    throw new TypeError(`${label} must be a non-negative number`);
  }

  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) {
    throw new TypeError(`${label} must be a non-negative number`);
  }
  return roundMoney(amount);
};

const normalizeCurrencies = (value) => {
  const raw = Array.isArray(value) ? value : normalizeText(value).split(",");
  const currencies = Array.from(
    new Set(raw.map((entry) => normalizeText(entry).toUpperCase()).filter(Boolean))
  );

  if (currencies.length === 0) {
    throw new TypeError("artist music tax currencies must not be empty");
  }
  if (
    currencies.some(
      (currency) => !SUPPORTED_ARTIST_MUSIC_TAX_CURRENCIES.has(currency)
    )
  ) {
    throw new TypeError(
      "artist music tax currencies must use supported checkout currencies: NGN or USD"
    );
  }
  return currencies;
};

const normalizeArtistMusicTaxConfig = (input = config.artistMusicTax || {}) => {
  const enabled = normalizeBoolean(input.enabled);
  const rateBps = Number(input.rateBps ?? 0);
  const priceMode = normalizeText(input.priceMode || "inclusive").toLowerCase();
  const effectiveAt = normalizeDate(
    input.effectiveAt || "2026-07-14T23:00:00.000Z",
    "artist music tax effectiveAt"
  );
  const currencies = normalizeCurrencies(input.currencies || ["NGN"]);
  const jurisdiction = normalizeText(input.jurisdiction).toUpperCase();

  if (!Number.isInteger(rateBps) || rateBps < 0 || rateBps > 10000) {
    throw new TypeError("artist music tax rateBps must be an integer from 0 to 10000");
  }
  if (enabled && rateBps === 0) {
    throw new TypeError("artist music tax rateBps must be greater than 0 when enabled");
  }
  if (enabled && !jurisdiction) {
    throw new TypeError("artist music tax jurisdiction is required when enabled");
  }
  if (priceMode !== "inclusive") {
    throw new TypeError(
      "artist music tax priceMode must be inclusive until checkout tax disclosure is enabled"
    );
  }

  return {
    enabled,
    rateBps,
    priceMode,
    effectiveAt,
    currencies,
    jurisdiction,
  };
};

const buildNoTaxSnapshot = ({ listedPriceAmount, effectiveAt }) => ({
  listedPriceAmount,
  chargeAmount: listedPriceAmount,
  taxableBaseAmount: listedPriceAmount,
  taxAmount: 0,
  taxRateBps: null,
  taxPriceMode: null,
  taxSource: "none",
  taxPolicy: NO_TAX_SNAPSHOT_POLICY,
  taxJurisdiction: "",
  taxProviderReported: false,
  taxEffectiveAt: effectiveAt,
});

/**
 * Builds the immutable tax snapshot that should be stored with a pending purchase.
 * `listedPriceAmount` is the catalog/display price. Tax is currently inclusive,
 * so the returned `chargeAmount` remains unchanged.
 */
const buildArtistSaleTaxSnapshot = ({
  item = {},
  listedPriceAmount,
  grossAmount,
  currency = "NGN",
  effectiveAt = new Date(),
  taxConfig = config.artistMusicTax,
} = {}) => {
  const displayPrice = normalizeAmount(
    listedPriceAmount ?? grossAmount,
    "listedPriceAmount"
  );
  const normalizedCurrency = normalizeText(currency).toUpperCase();
  if (!/^[A-Z]{3}$/.test(normalizedCurrency)) {
    throw new TypeError("currency must be an ISO 4217 currency code");
  }

  const calculatedAt = normalizeDate(effectiveAt, "effectiveAt");
  const policy = normalizeArtistMusicTaxConfig(taxConfig);
  const applies =
    policy.enabled &&
    isArtistMusicItem(item) &&
    calculatedAt.getTime() >= policy.effectiveAt.getTime() &&
    policy.currencies.includes(normalizedCurrency);

  if (!applies) {
    return buildNoTaxSnapshot({
      listedPriceAmount: displayPrice,
      effectiveAt: calculatedAt,
    });
  }

  const rate = policy.rateBps / 10000;
  const taxAmount =
    policy.priceMode === "inclusive"
      ? roundMoney((displayPrice * rate) / (1 + rate))
      : roundMoney(displayPrice * rate);
  const taxableBaseAmount =
    policy.priceMode === "inclusive"
      ? roundMoney(displayPrice - taxAmount)
      : displayPrice;
  const chargeAmount =
    policy.priceMode === "inclusive"
      ? displayPrice
      : roundMoney(displayPrice + taxAmount);

  return {
    listedPriceAmount: displayPrice,
    chargeAmount,
    taxableBaseAmount,
    taxAmount,
    taxRateBps: policy.rateBps,
    taxPriceMode: policy.priceMode,
    taxSource: "configured",
    taxPolicy: CONFIGURED_ARTIST_MUSIC_TAX_POLICY,
    taxJurisdiction: policy.jurisdiction,
    taxProviderReported: false,
    taxEffectiveAt: policy.effectiveAt,
  };
};

const hasPersistedTaxSnapshot = (purchase = {}) =>
  purchase.listedPriceAmount != null || Boolean(normalizeText(purchase.taxPolicy));

const normalizeStoredTaxSource = (
  value,
  taxAmount,
  { providerReported = false } = {}
) => {
  const source = normalizeText(value).toLowerCase();
  if (source === "provider") {
    return "provider";
  }
  if (providerReported && taxAmount >= 0) {
    return "provider";
  }
  if (source === "configured" || source === "legacy") {
    return source;
  }
  if (source === "none" && taxAmount <= 0) {
    return "none";
  }
  if (taxAmount > 0) {
    return "legacy";
  }
  return TAX_SOURCES.has(source) ? source : "none";
};

const buildStoredTaxSnapshot = (purchase = {}, { settledAt = new Date() } = {}) => {
  const grossAmount = normalizeAmount(purchase.amount, "purchase.amount");
  const taxAmount = normalizeAmount(purchase.taxAmount ?? 0, "purchase.taxAmount");
  if (taxAmount > grossAmount) {
    throw new RangeError("purchase.taxAmount cannot exceed purchase.amount");
  }

  const listedPriceAmount = normalizeAmount(
    purchase.listedPriceAmount ?? grossAmount,
    "purchase.listedPriceAmount"
  );
  const storedTaxableBase = normalizeAmount(
    purchase.taxableBaseAmount,
    "purchase.taxableBaseAmount",
    { allowNull: true }
  );
  const taxRateBps =
    purchase.taxRateBps == null ? null : Number(purchase.taxRateBps);
  if (
    taxRateBps != null &&
    (!Number.isInteger(taxRateBps) || taxRateBps < 0 || taxRateBps > 10000)
  ) {
    throw new TypeError("purchase.taxRateBps must be an integer from 0 to 10000");
  }

  const taxPriceMode = normalizeText(purchase.taxPriceMode).toLowerCase();
  if (taxPriceMode && !PRICE_MODES.has(taxPriceMode)) {
    throw new TypeError("purchase.taxPriceMode must be inclusive or exclusive");
  }

  const taxSource = normalizeStoredTaxSource(purchase.taxSource, taxAmount, {
    providerReported: purchase.taxProviderReported === true,
  });
  const effectiveAt = purchase.taxEffectiveAt
    ? normalizeDate(purchase.taxEffectiveAt, "purchase.taxEffectiveAt")
    : normalizeDate(settledAt, "settledAt");

  return {
    listedPriceAmount,
    chargeAmount: grossAmount,
    taxableBaseAmount:
      storedTaxableBase == null ? roundMoney(grossAmount - taxAmount) : storedTaxableBase,
    taxAmount,
    taxRateBps,
    taxPriceMode: taxPriceMode || null,
    taxSource,
    taxPolicy:
      normalizeText(purchase.taxPolicy) ||
      (taxSource === "none"
        ? NO_TAX_SNAPSHOT_POLICY
        : LEGACY_TAX_SNAPSHOT_POLICY),
    taxJurisdiction: normalizeText(purchase.taxJurisdiction).toUpperCase(),
    taxProviderReported: taxSource === "provider",
    taxEffectiveAt: effectiveAt,
  };
};

/**
 * Resolves final settlement tax without consulting the current configured rate.
 * A gateway value is authoritative only when `providerTaxReported` is true;
 * otherwise the checkout snapshot is preserved so configuration changes cannot
 * rewrite an existing purchase's economics.
 */
const resolveSettlementTaxSnapshot = ({
  purchase = {},
  providerTaxAmount = null,
  providerTaxReported = false,
  settledAt = new Date(),
} = {}) => {
  const grossAmount = normalizeAmount(purchase.amount, "purchase.amount");
  const settlementDate = normalizeDate(settledAt, "settledAt");

  if (providerTaxReported) {
    const taxAmount = normalizeAmount(providerTaxAmount, "providerTaxAmount");
    if (taxAmount > grossAmount) {
      throw new RangeError("providerTaxAmount cannot exceed purchase.amount");
    }

    const listedPriceAmount = normalizeAmount(
      purchase.listedPriceAmount ?? grossAmount,
      "purchase.listedPriceAmount"
    );
    return {
      listedPriceAmount,
      chargeAmount: grossAmount,
      taxableBaseAmount: roundMoney(grossAmount - taxAmount),
      taxAmount,
      // Paystack/Stripe do not currently return a tax rate or jurisdiction
      // alongside this amount. Do not retain the configured rate/mode and
      // mislabel them as provider provenance.
      taxRateBps: null,
      taxPriceMode: null,
      taxSource: "provider",
      taxPolicy: PROVIDER_REPORTED_TAX_POLICY,
      taxJurisdiction: "",
      taxProviderReported: true,
      taxEffectiveAt: settlementDate,
    };
  }

  if (hasPersistedTaxSnapshot(purchase)) {
    return buildStoredTaxSnapshot(purchase, { settledAt: settlementDate });
  }

  // Preserve legacy tax deductions when present, but never invent a rate or
  // recalculate them from today's environment configuration at settlement time.
  return buildStoredTaxSnapshot(purchase, { settledAt: settlementDate });
};

module.exports = {
  CONFIGURED_ARTIST_MUSIC_TAX_POLICY,
  NO_TAX_SNAPSHOT_POLICY,
  PROVIDER_REPORTED_TAX_POLICY,
  LEGACY_TAX_SNAPSHOT_POLICY,
  SUPPORTED_ARTIST_MUSIC_TAX_CURRENCIES,
  buildArtistSaleTaxSnapshot,
  hasPersistedTaxSnapshot,
  normalizeArtistMusicTaxConfig,
  resolveSettlementTaxSnapshot,
};
