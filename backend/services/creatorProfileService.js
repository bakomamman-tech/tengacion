const VALID_CREATOR_TYPES = ["music", "bookPublishing", "podcast"];

const trimCreatorText = (value = "", maxLength = 200) =>
  String(value || "").trim().slice(0, maxLength);

const normalizeCreatorType = (value = "") => {
  const normalized = String(value || "").trim();
  const compact = normalized.toLowerCase().replace(/[\s_-]+/g, "");

  if (compact === "book" || compact === "books" || compact === "bookpublishing" || compact === "publishing") {
    return "bookPublishing";
  }
  if (compact === "podcast" || compact === "podcasts") {
    return "podcast";
  }
  if (compact === "music" || compact === "songs" || compact === "audio") {
    return "music";
  }
  return "";
};

const normalizeCreatorTypes = (values = []) => {
  const list = Array.isArray(values) ? values : [values];
  return [...new Set(
    list
      .map((entry) => normalizeCreatorType(entry))
      .filter((entry) => VALID_CREATOR_TYPES.includes(entry))
  )];
};

const normalizeSocialHandleValue = (value = "") =>
  String(value || "")
    .trim()
    .replace(/^@+/, "")
    .replace(/\s+/g, "")
    .slice(0, 120);

const normalizeSocialHandles = (handles = {}) => ({
  facebook: normalizeSocialHandleValue(handles?.facebook),
  instagram: normalizeSocialHandleValue(handles?.instagram),
  linkedin: normalizeSocialHandleValue(handles?.linkedin),
  x: normalizeSocialHandleValue(handles?.x),
  threads: normalizeSocialHandleValue(handles?.threads),
  spotify: normalizeSocialHandleValue(handles?.spotify),
  youtube: normalizeSocialHandleValue(handles?.youtube),
});

const normalizeGenres = (values = []) => {
  const list = Array.isArray(values) ? values : String(values || "").split(",");
  return [...new Set(
    list
      .map((entry) => trimCreatorText(entry, 60))
      .filter(Boolean)
  )].slice(0, 12);
};

const normalizeMusicProfile = (profile = {}) => ({
  primaryGenre: trimCreatorText(profile?.primaryGenre, 80),
  recordLabel: trimCreatorText(profile?.recordLabel, 120),
  artistBio: trimCreatorText(profile?.artistBio, 2000),
});

const normalizeBooksProfile = (profile = {}) => ({
  penName: trimCreatorText(profile?.penName, 120),
  primaryGenre: trimCreatorText(profile?.primaryGenre, 80),
  publisherName: trimCreatorText(profile?.publisherName, 120),
  authorBio: trimCreatorText(profile?.authorBio, 2000),
});

const normalizePodcastsProfile = (profile = {}) => ({
  podcastName: trimCreatorText(profile?.podcastName, 120),
  hostName: trimCreatorText(profile?.hostName, 120),
  themeOrTopic: trimCreatorText(profile?.themeOrTopic, 160),
  seriesTitle: trimCreatorText(profile?.seriesTitle, 120),
  description: trimCreatorText(profile?.description, 2000),
});

const isCreatorRegistrationCompleted = (profile) =>
  Boolean(profile?.onboardingCompleted || profile?.onboardingComplete);

const calculateCreatorProfileCompletionScore = (profile = {}) => {
  const checks = [
    Boolean(String(profile?.fullName || profile?.displayName || "").trim()),
    Boolean(String(profile?.phoneNumber || "").trim()),
    Boolean(String(profile?.accountNumber || "").trim()),
    Boolean(String(profile?.country || "").trim()),
    Boolean(String(profile?.countryOfResidence || "").trim()),
    normalizeCreatorTypes(profile?.creatorTypes).length > 0,
    Boolean(profile?.acceptedTerms),
    Boolean(profile?.acceptedCopyrightDeclaration),
  ];

  const passedChecks = checks.filter(Boolean).length;
  return Math.round((passedChecks / checks.length) * 100);
};

const creatorHasCategory = (profile, category, { allowLegacyFallback = true } = {}) => {
  const normalizedCategory = normalizeCreatorType(category);
  if (!normalizedCategory) {
    return false;
  }

  const storedTypes = normalizeCreatorTypes(profile?.creatorTypes);
  if (storedTypes.length) {
    return storedTypes.includes(normalizedCategory);
  }

  return allowLegacyFallback ? isCreatorRegistrationCompleted(profile) : false;
};

module.exports = {
  VALID_CREATOR_TYPES,
  trimCreatorText,
  normalizeCreatorType,
  normalizeCreatorTypes,
  normalizeSocialHandles,
  normalizeSocialHandleValue,
  normalizeGenres,
  normalizeMusicProfile,
  normalizeBooksProfile,
  normalizePodcastsProfile,
  isCreatorRegistrationCompleted,
  calculateCreatorProfileCompletionScore,
  creatorHasCategory,
};
