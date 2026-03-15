const VALID_CREATOR_TYPES = ["music", "books", "podcasts"];

const normalizeCreatorType = (value = "") => {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "book" || normalized === "book publishing" || normalized === "publishing") {
    return "books";
  }
  if (normalized === "podcast" || normalized === "podcasts") {
    return "podcasts";
  }
  if (normalized === "music" || normalized === "songs" || normalized === "audio") {
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
  youtube: normalizeSocialHandleValue(handles?.youtube),
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
  normalizeCreatorType,
  normalizeCreatorTypes,
  normalizeSocialHandles,
  normalizeSocialHandleValue,
  isCreatorRegistrationCompleted,
  calculateCreatorProfileCompletionScore,
  creatorHasCategory,
};
