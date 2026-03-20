const { NEWS_RIGHTS_MODES } = require("../models/newsSubschemas");

const MODE_DEFAULTS = {
  FULL_IN_APP: {
    allowBodyHtml: true,
    allowSummary: true,
    allowThumbnail: true,
    allowEmbed: true,
  },
  SUMMARY_PLUS_LINKOUT: {
    allowBodyHtml: false,
    allowSummary: true,
    allowThumbnail: true,
    allowEmbed: false,
  },
  THUMBNAIL_LINKOUT: {
    allowBodyHtml: false,
    allowSummary: true,
    allowThumbnail: true,
    allowEmbed: false,
  },
  EMBED_ONLY: {
    allowBodyHtml: false,
    allowSummary: true,
    allowThumbnail: false,
    allowEmbed: true,
  },
};

const MODE_RESTRICTIVENESS = {
  FULL_IN_APP: 4,
  SUMMARY_PLUS_LINKOUT: 3,
  THUMBNAIL_LINKOUT: 2,
  EMBED_ONLY: 1,
};

const clonePlain = (value = {}) =>
  value?.toObject ? value.toObject() : JSON.parse(JSON.stringify(value || {}));

const normalizeMode = (value = "") => {
  const mode = String(value || "").trim().toUpperCase();
  return NEWS_RIGHTS_MODES.includes(mode) ? mode : "SUMMARY_PLUS_LINKOUT";
};

const isRightsExpired = (rights = {}, now = new Date()) =>
  Boolean(rights?.expiresAt && new Date(rights.expiresAt).getTime() <= now.getTime());

const getModeDefaults = (mode = "SUMMARY_PLUS_LINKOUT") =>
  MODE_DEFAULTS[normalizeMode(mode)] || MODE_DEFAULTS.SUMMARY_PLUS_LINKOUT;

const normalizeRights = (input = {}, context = {}) => {
  const contractRights =
    context?.contract?.rights && typeof context.contract.rights === "object"
      ? context.contract.rights
      : {};
  const sourceAttribution =
    context?.source?.attribution && typeof context.source.attribution === "object"
      ? context.source.attribution
      : {};
  const contractAttribution =
    context?.contract?.attribution && typeof context.contract.attribution === "object"
      ? context.contract.attribution
      : {};

  const mode = normalizeMode(
    input.mode ||
      context?.contract?.rightsModeDefault ||
      contractRights.mode ||
      "SUMMARY_PLUS_LINKOUT"
  );
  const defaults = getModeDefaults(mode);
  const expiresAt =
    input.expiresAt || contractRights.expiresAt || context?.contract?.expiresAt || null;

  return {
    mode,
    attributionRequired:
      input.attributionRequired ??
      contractRights.attributionRequired ??
      sourceAttribution.attributionRequired ??
      contractAttribution.attributionRequired ??
      true,
    canonicalLinkRequired:
      input.canonicalLinkRequired ??
      contractRights.canonicalLinkRequired ??
      sourceAttribution.canonicalLinkRequired ??
      contractAttribution.canonicalLinkRequired ??
      true,
    allowBodyHtml: Boolean(
      input.allowBodyHtml ?? contractRights.allowBodyHtml ?? defaults.allowBodyHtml
    ),
    allowSummary: Boolean(
      input.allowSummary ?? contractRights.allowSummary ?? defaults.allowSummary
    ),
    allowThumbnail: Boolean(
      input.allowThumbnail ?? contractRights.allowThumbnail ?? defaults.allowThumbnail
    ),
    allowEmbed: Boolean(
      input.allowEmbed ?? contractRights.allowEmbed ?? defaults.allowEmbed
    ),
    expiresAt: expiresAt ? new Date(expiresAt) : null,
    isExpired: isRightsExpired({ expiresAt }),
    contractVersion:
      input.contractVersion || contractRights.contractVersion || context?.contract?.contractVersion || "",
    notes: String(input.notes || contractRights.notes || "").trim(),
  };
};

const getMostRestrictiveMode = (modes = []) => {
  const normalized = (Array.isArray(modes) ? modes : [])
    .map((entry) => normalizeMode(entry))
    .filter(Boolean);
  if (!normalized.length) {
    return "SUMMARY_PLUS_LINKOUT";
  }

  return normalized.sort(
    (left, right) =>
      (MODE_RESTRICTIVENESS[left] || 0) - (MODE_RESTRICTIVENESS[right] || 0)
  )[0];
};

const applyRightsToStoryPayload = (payload = {}, context = {}) => {
  const next = clonePlain(payload);
  next.rights = normalizeRights(next.rights || {}, context);

  if (!next.rights.allowBodyHtml || next.rights.isExpired || next.rights.mode !== "FULL_IN_APP") {
    next.bodyHtml = "";
  }

  if (!next.rights.allowThumbnail && Array.isArray(next.assets)) {
    next.assets = next.assets.filter((asset) => asset?.assetType === "embed");
  }

  return next;
};

const enforceStoryRights = (story = {}, context = {}) => {
  const next = clonePlain(story);
  const rights = normalizeRights(next.rights || {}, context);
  const canRenderFullText = rights.mode === "FULL_IN_APP" && rights.allowBodyHtml && !rights.isExpired;

  next.rights = rights;
  next.bodyHtml = canRenderFullText ? String(next.bodyHtml || "") : "";
  next.summaryText = String(next.summaryText || "");
  next.canonicalUrl = String(next.canonicalUrl || "");
  next.display = {
    bodyHtml: next.bodyHtml,
    summaryText: next.summaryText,
    canonicalUrl: next.canonicalUrl,
    canRenderFullText,
    linkOutOnly: !canRenderFullText,
    attributionRequired: rights.attributionRequired,
    canonicalLinkRequired: rights.canonicalLinkRequired,
  };
  return next;
};

module.exports = {
  NEWS_RIGHTS_MODES,
  MODE_DEFAULTS,
  normalizeMode,
  getModeDefaults,
  normalizeRights,
  isRightsExpired,
  applyRightsToStoryPayload,
  enforceStoryRights,
  getMostRestrictiveMode,
};
