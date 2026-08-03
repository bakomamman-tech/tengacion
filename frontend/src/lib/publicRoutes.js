export const PRIVATE_CREATOR_ALIAS_SEGMENTS = new Set([
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

const PUBLIC_CREATOR_TABS = new Set([
  "home",
  "music",
  "albums",
  "podcasts",
  "books",
  "posts",
  "store",
]);

export const CREATOR_PUBLIC_ROUTE_CONTRACT = Object.freeze({
  canonicalPath: "/creator/:username",
  idCompatibilityPath: "/creators/:creatorId",
  artistCompatibilityPath: "/artist/:username",
  readAccess: "public",
  authenticatedActionPaths: Object.freeze(["/creators/:creatorId/subscribe"]),
});

export const normalizeCreatorUsername = (value = "") =>
  String(value || "")
    .trim()
    .replace(/^@+/, "")
    .toLowerCase();

export const normalizePublicCreatorTab = (value = "home") => {
  const normalized = String(value || "home").trim().toLowerCase();
  return PUBLIC_CREATOR_TABS.has(normalized) ? normalized : "home";
};

export const isReservedCreatorAliasSegment = (value = "") =>
  PRIVATE_CREATOR_ALIAS_SEGMENTS.has(normalizeCreatorUsername(value));

export const buildCreatorIdPath = ({ creatorId = "", tab = "home" } = {}) => {
  const normalizedTab = normalizePublicCreatorTab(tab);
  const suffix = normalizedTab === "home" ? "" : `/${normalizedTab}`;
  return `/creators/${encodeURIComponent(String(creatorId || "").trim())}${suffix}`;
};

export const buildCreatorPublicPath = ({ creatorId = "", username = "", tab = "home" } = {}) => {
  const normalizedTab = normalizePublicCreatorTab(tab);
  const suffix = normalizedTab === "home" ? "" : `/${normalizedTab}`;
  const normalizedUsername = normalizeCreatorUsername(username);

  if (normalizedUsername && !isReservedCreatorAliasSegment(normalizedUsername)) {
    return `/creator/${encodeURIComponent(normalizedUsername)}${suffix}`;
  }

  return buildCreatorIdPath({ creatorId, tab: normalizedTab });
};

export const buildCreatorLegacyPath = buildCreatorIdPath;

export const buildArtistCompatibilityTarget = ({ username = "", tab = "home" } = {}) =>
  buildCreatorPublicPath({ creatorId: normalizeCreatorUsername(username), username, tab });

export const buildCreatorSubscribePath = (creatorId = "") =>
  `/creators/${encodeURIComponent(String(creatorId || "").trim())}/subscribe`;

export const buildTrackPath = (trackId = "") => `/tracks/${encodeURIComponent(String(trackId || "").trim())}`;
export const buildBookPath = (bookId = "") => `/books/${encodeURIComponent(String(bookId || "").trim())}`;
export const buildAlbumPath = (albumId = "") => `/albums/${encodeURIComponent(String(albumId || "").trim())}`;
