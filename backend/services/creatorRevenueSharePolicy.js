const LEGACY_CREATOR_SHARE_RATE = 0.4;
const LEGACY_PLATFORM_SHARE_RATE = 0.6;
const CREATOR_CONTENT_CREATOR_SHARE_RATE = 0.6;
const CREATOR_CONTENT_PLATFORM_SHARE_RATE = 0.4;

const LEGACY_REVENUE_SHARE_POLICY = "legacy_creator_40_v1";
const CREATOR_CONTENT_REVENUE_SHARE_POLICY = "creator_content_platform_40_v1";

const CREATOR_CONTENT_CATEGORIES = new Set(["music", "books", "podcasts"]);

const roundMoney = (value) =>
  Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

const normalizeText = (value = "") => String(value || "").trim().toLowerCase();

const resolveRevenueCategory = (item = {}) => {
  const itemType = normalizeText(item?.itemType);
  const payload = item?.payload || {};
  const creatorCategory = normalizeText(payload?.creatorCategory);
  const kind = normalizeText(payload?.kind);

  if (itemType === "book" || creatorCategory === "books") {
    return "books";
  }
  if (kind === "podcast" || creatorCategory === "podcasts") {
    return "podcasts";
  }
  if (kind === "comedy") {
    return "other";
  }
  if (
    ["track", "album", "video"].includes(itemType) ||
    creatorCategory === "music"
  ) {
    return "music";
  }
  if (itemType === "subscription") {
    return "subscriptions";
  }
  return "other";
};

const buildRevenueShareSnapshot = (item = {}) => {
  const revenueCategory = resolveRevenueCategory(item);
  const isCreatorContent = CREATOR_CONTENT_CATEGORIES.has(revenueCategory);

  return {
    revenueCategory,
    revenueSharePolicy: isCreatorContent
      ? CREATOR_CONTENT_REVENUE_SHARE_POLICY
      : LEGACY_REVENUE_SHARE_POLICY,
    creatorShareRate: isCreatorContent
      ? CREATOR_CONTENT_CREATOR_SHARE_RATE
      : LEGACY_CREATOR_SHARE_RATE,
    platformShareRate: isCreatorContent
      ? CREATOR_CONTENT_PLATFORM_SHARE_RATE
      : LEGACY_PLATFORM_SHARE_RATE,
  };
};

const hasValidStoredRates = (purchase = {}) => {
  const creatorShareRate = Number(purchase?.creatorShareRate);
  const platformShareRate = Number(purchase?.platformShareRate);

  return (
    purchase?.creatorShareRate != null &&
    purchase?.platformShareRate != null &&
    Number.isFinite(creatorShareRate) &&
    Number.isFinite(platformShareRate) &&
    creatorShareRate >= 0 &&
    platformShareRate >= 0 &&
    Math.abs(creatorShareRate + platformShareRate - 1) < 0.000001
  );
};

const resolvePurchaseRevenueShare = (purchase = {}) => {
  if (hasValidStoredRates(purchase)) {
    return {
      revenueCategory: normalizeText(purchase?.revenueCategory) || "other",
      revenueSharePolicy:
        String(purchase?.revenueSharePolicy || "").trim() ||
        LEGACY_REVENUE_SHARE_POLICY,
      creatorShareRate: Number(purchase.creatorShareRate),
      platformShareRate: Number(purchase.platformShareRate),
      isLegacyFallback: false,
    };
  }

  return {
    revenueCategory: normalizeText(purchase?.revenueCategory) || "legacy",
    revenueSharePolicy: LEGACY_REVENUE_SHARE_POLICY,
    creatorShareRate: LEGACY_CREATOR_SHARE_RATE,
    platformShareRate: LEGACY_PLATFORM_SHARE_RATE,
    isLegacyFallback: true,
  };
};

const computePurchaseRevenueShare = (purchase = {}) => {
  const grossAmount = Math.max(0, roundMoney(purchase?.amount));
  const share = resolvePurchaseRevenueShare(purchase);
  const platformAmount = Math.max(
    0,
    roundMoney(grossAmount * share.platformShareRate)
  );
  const creatorAmount = Math.max(0, roundMoney(grossAmount - platformAmount));

  return {
    ...share,
    grossAmount,
    creatorAmount,
    platformAmount,
  };
};

module.exports = {
  LEGACY_CREATOR_SHARE_RATE,
  LEGACY_PLATFORM_SHARE_RATE,
  CREATOR_CONTENT_CREATOR_SHARE_RATE,
  CREATOR_CONTENT_PLATFORM_SHARE_RATE,
  LEGACY_REVENUE_SHARE_POLICY,
  CREATOR_CONTENT_REVENUE_SHARE_POLICY,
  buildRevenueShareSnapshot,
  computePurchaseRevenueShare,
  resolvePurchaseRevenueShare,
  resolveRevenueCategory,
};
