const LEGACY_CREATOR_SHARE_RATE = 0.4;
const LEGACY_PLATFORM_SHARE_RATE = 0.6;
const CREATOR_CONTENT_CREATOR_SHARE_RATE = 0.6;
const CREATOR_CONTENT_PLATFORM_SHARE_RATE = 0.4;
const ARTIST_MUSIC_CREATOR_SHARE_RATE = 0.75;
const ARTIST_MUSIC_PLATFORM_SHARE_RATE = 0.25;

const LEGACY_REVENUE_SHARE_POLICY = "legacy_creator_40_v1";
const CREATOR_CONTENT_REVENUE_SHARE_POLICY = "creator_content_platform_40_v1";
const ARTIST_MUSIC_REVENUE_SHARE_POLICY = "artist_music_net_75_v1";

// Africa/Lagos is UTC+1 throughout the year. This instant is midnight at the
// start of 15 July 2026 in Lagos.
const ARTIST_MUSIC_SPLIT_EFFECTIVE_AT = new Date("2026-07-14T23:00:00.000Z");

const CREATOR_CONTENT_CATEGORIES = new Set(["music", "books", "podcasts"]);
const REVENUE_CATEGORIES = new Set([
  "music",
  "books",
  "podcasts",
  "subscriptions",
  "other",
]);
const ARTIST_MUSIC_ITEM_TYPES = new Set([
  "track",
  "tracks",
  "song",
  "songs",
  "album",
  "albums",
]);

const roundMoney = (value) =>
  Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

const normalizeText = (value = "") => String(value || "").trim().toLowerCase();

const toValidDate = (value, fallback = new Date()) => {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  return Number.isFinite(date.getTime()) ? date : fallback;
};

const resolveRevenueCategory = (item = {}) => {
  const explicitCategory = normalizeText(item?.revenueCategory);
  if (REVENUE_CATEGORIES.has(explicitCategory)) {
    return explicitCategory;
  }

  const itemType = normalizeText(item?.itemType);
  const payload = item?.payload || {};
  const creatorCategory = normalizeText(payload?.creatorCategory);
  const kind = normalizeText(payload?.kind);

  if (itemType === "subscription") {
    return "subscriptions";
  }
  if (["book", "books"].includes(itemType) || creatorCategory === "books") {
    return "books";
  }
  if (kind === "podcast" || creatorCategory === "podcasts") {
    return "podcasts";
  }
  if (kind === "comedy") {
    return "other";
  }
  if (
    ["track", "tracks", "song", "songs", "album", "albums", "video", "videos"].includes(
      itemType
    ) ||
    creatorCategory === "music"
  ) {
    return "music";
  }
  return "other";
};

const isArtistMusicItem = (item = {}, revenueCategory = resolveRevenueCategory(item)) =>
  revenueCategory === "music" && ARTIST_MUSIC_ITEM_TYPES.has(normalizeText(item?.itemType));

const isArtistMusicPolicyEffective = (effectiveAt = new Date()) =>
  toValidDate(effectiveAt).getTime() >= ARTIST_MUSIC_SPLIT_EFFECTIVE_AT.getTime();

const resolveSnapshotEffectiveAt = (options = {}) => {
  if (options instanceof Date || typeof options === "string" || typeof options === "number") {
    return toValidDate(options);
  }
  return toValidDate(options?.effectiveAt ?? options?.settledAt ?? new Date());
};

const buildRevenueShareSnapshot = (item = {}, options = {}) => {
  const revenueCategory = resolveRevenueCategory(item);
  const effectiveAt = resolveSnapshotEffectiveAt(options);

  if (isArtistMusicItem(item, revenueCategory) && isArtistMusicPolicyEffective(effectiveAt)) {
    return {
      revenueCategory,
      revenueSharePolicy: ARTIST_MUSIC_REVENUE_SHARE_POLICY,
      creatorShareRate: ARTIST_MUSIC_CREATOR_SHARE_RATE,
      platformShareRate: ARTIST_MUSIC_PLATFORM_SHARE_RATE,
    };
  }

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

const buildSettlementRevenueShareSnapshot = (
  purchase = {},
  { settledAt = new Date() } = {}
) => {
  if (normalizeText(purchase?.status) === "paid") {
    const storedShare = resolvePurchaseRevenueShare(purchase);
    return {
      revenueCategory: storedShare.revenueCategory,
      revenueSharePolicy: storedShare.revenueSharePolicy,
      creatorShareRate: storedShare.creatorShareRate,
      platformShareRate: storedShare.platformShareRate,
    };
  }

  return buildRevenueShareSnapshot(purchase, { effectiveAt: settledAt });
};

const computePurchaseRevenueShare = (purchase = {}) => {
  const grossAmount = Math.max(0, roundMoney(purchase?.amount));
  const processingFeeAmount = Math.max(0, roundMoney(purchase?.processingFeeAmount));
  const taxAmount = Math.max(0, roundMoney(purchase?.taxAmount));
  const netRevenueAmount = Math.max(
    0,
    roundMoney(grossAmount - processingFeeAmount - taxAmount)
  );
  const share = resolvePurchaseRevenueShare(purchase);
  const shareBaseAmount =
    share.revenueSharePolicy === ARTIST_MUSIC_REVENUE_SHARE_POLICY
      ? netRevenueAmount
      : grossAmount;
  const isArtistMusicPolicy =
    share.revenueSharePolicy === ARTIST_MUSIC_REVENUE_SHARE_POLICY;
  const creatorAmount = isArtistMusicPolicy
    ? Math.max(0, roundMoney(shareBaseAmount * share.creatorShareRate))
    : Math.max(
        0,
        roundMoney(
          shareBaseAmount - roundMoney(shareBaseAmount * share.platformShareRate)
        )
      );
  const platformAmount = isArtistMusicPolicy
    ? Math.max(0, roundMoney(shareBaseAmount - creatorAmount))
    : Math.max(0, roundMoney(shareBaseAmount * share.platformShareRate));

  return {
    ...share,
    grossAmount,
    processingFeeAmount,
    taxAmount,
    netRevenueAmount,
    shareBaseAmount,
    creatorAmount,
    platformAmount,
  };
};

module.exports = {
  LEGACY_CREATOR_SHARE_RATE,
  LEGACY_PLATFORM_SHARE_RATE,
  CREATOR_CONTENT_CREATOR_SHARE_RATE,
  CREATOR_CONTENT_PLATFORM_SHARE_RATE,
  ARTIST_MUSIC_CREATOR_SHARE_RATE,
  ARTIST_MUSIC_PLATFORM_SHARE_RATE,
  LEGACY_REVENUE_SHARE_POLICY,
  CREATOR_CONTENT_REVENUE_SHARE_POLICY,
  ARTIST_MUSIC_REVENUE_SHARE_POLICY,
  ARTIST_MUSIC_SPLIT_EFFECTIVE_AT,
  buildRevenueShareSnapshot,
  buildSettlementRevenueShareSnapshot,
  computePurchaseRevenueShare,
  isArtistMusicItem,
  isArtistMusicPolicyEffective,
  resolvePurchaseRevenueShare,
  resolveRevenueCategory,
};
