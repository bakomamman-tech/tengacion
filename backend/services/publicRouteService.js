const mongoose = require("mongoose");

const PUBLIC_CREATOR_TABS = new Set(["home", "music", "albums", "podcasts", "books"]);

const PRIVATE_CREATOR_ALIAS_SEGMENTS = new Set([
  "register",
  "dashboard",
  "categories",
  "fan-page-view",
  "music",
  "books",
  "podcasts",
  "earnings",
  "payouts",
  "settings",
  "verification",
  "support",
]);

const normalizeCreatorUsername = (value = "") =>
  String(value || "")
    .trim()
    .replace(/^@+/, "")
    .toLowerCase();

const normalizePublicCreatorTab = (value = "home") => {
  const normalized = String(value || "home").trim().toLowerCase();
  return PUBLIC_CREATOR_TABS.has(normalized) ? normalized : "home";
};

const isReservedCreatorAliasSegment = (value = "") =>
  PRIVATE_CREATOR_ALIAS_SEGMENTS.has(normalizeCreatorUsername(value));

const isObjectIdLike = (value = "") => mongoose.Types.ObjectId.isValid(String(value || "").trim());

const buildCreatorIdPath = ({ creatorId = "", tab = "home" } = {}) => {
  const normalizedTab = normalizePublicCreatorTab(tab);
  const suffix = normalizedTab === "home" ? "" : `/${normalizedTab}`;
  return `/creators/${encodeURIComponent(String(creatorId || "").trim())}${suffix}`;
};

const buildCreatorPublicPath = ({ creatorId = "", username = "", tab = "home" } = {}) => {
  const normalizedTab = normalizePublicCreatorTab(tab);
  const suffix = normalizedTab === "home" ? "" : `/${normalizedTab}`;
  const normalizedUsername = normalizeCreatorUsername(username);

  if (normalizedUsername && !isReservedCreatorAliasSegment(normalizedUsername)) {
    return `/creator/${encodeURIComponent(normalizedUsername)}${suffix}`;
  }

  return buildCreatorIdPath({ creatorId, tab: normalizedTab });
};

const buildCreatorSubscribePath = (creatorId = "") =>
  `/creators/${encodeURIComponent(String(creatorId || "").trim())}/subscribe`;

module.exports = {
  PRIVATE_CREATOR_ALIAS_SEGMENTS,
  buildCreatorIdPath,
  buildCreatorPublicPath,
  buildCreatorSubscribePath,
  isObjectIdLike,
  isReservedCreatorAliasSegment,
  normalizeCreatorUsername,
  normalizePublicCreatorTab,
};
