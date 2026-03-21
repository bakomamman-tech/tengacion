const { normalizeWhitespace } = require("./newsNormalizeService");

const NIGERIA_STATES = [
  "Abia",
  "Adamawa",
  "Akwa Ibom",
  "Anambra",
  "Bauchi",
  "Bayelsa",
  "Benue",
  "Borno",
  "Cross River",
  "Delta",
  "Ebonyi",
  "Edo",
  "Ekiti",
  "Enugu",
  "FCT",
  "Gombe",
  "Imo",
  "Jigawa",
  "Kaduna",
  "Kano",
  "Katsina",
  "Kebbi",
  "Kogi",
  "Kwara",
  "Lagos",
  "Nasarawa",
  "Niger",
  "Ogun",
  "Ondo",
  "Osun",
  "Oyo",
  "Plateau",
  "Rivers",
  "Sokoto",
  "Taraba",
  "Yobe",
  "Zamfara",
];

const COUNTRY_KEYWORDS = [
  "Nigeria",
  "Ghana",
  "Kenya",
  "South Africa",
  "United States",
  "United Kingdom",
  "France",
  "Germany",
  "China",
  "India",
  "Russia",
  "Ukraine",
];

const CITY_KEYWORDS = [
  "Lagos",
  "Abuja",
  "Port Harcourt",
  "Kano",
  "Ibadan",
  "Kaduna",
  "Jos",
  "Benin",
];

const uniq = (values = []) =>
  [...new Set((Array.isArray(values) ? values : []).map((entry) => normalizeWhitespace(entry)).filter(Boolean))];

const detectMatches = (text = "", candidates = []) =>
  candidates.filter((entry) => text.includes(String(entry).toLowerCase()));

const inferGeography = (payload = {}) => {
  const explicitCountries = uniq(payload?.geography?.countries || payload?.countries || []);
  const explicitStates = uniq(payload?.geography?.states || payload?.states || []);
  const explicitCities = uniq(payload?.geography?.cities || payload?.cities || []);

  const haystack = normalizeWhitespace(
    `${payload.title || ""} ${payload.subtitle || ""} ${payload.summaryText || ""} ${
      (payload.tags || []).join(" ")
    } ${(payload.raw?.location || "")}`
  ).toLowerCase();

  const detectedCountries = uniq([
    ...explicitCountries,
    ...detectMatches(haystack, COUNTRY_KEYWORDS),
  ]);
  const detectedStates = uniq([
    ...explicitStates,
    ...detectMatches(haystack, NIGERIA_STATES),
  ]);
  const detectedCities = uniq([
    ...explicitCities,
    ...detectMatches(haystack, CITY_KEYWORDS),
  ]);

  let scope = "unknown";
  let primaryCountry = detectedCountries[0] || "";
  if (detectedStates.length || detectedCities.length) {
    scope = "local";
    primaryCountry = primaryCountry || "Nigeria";
  } else if (detectedCountries.length > 1) {
    scope = "international";
  } else if (detectedCountries[0] && detectedCountries[0].toLowerCase() === "nigeria") {
    scope = "national";
  } else if (detectedCountries.length === 1) {
    scope = "international";
  }

  return {
    scope,
    countries: detectedCountries,
    states: detectedStates,
    cities: detectedCities,
    primaryCountry,
    primaryState: detectedStates[0] || "",
    primaryCity: detectedCities[0] || "",
    relevanceScore: scope === "local" ? 1 : scope === "national" ? 0.78 : scope === "international" ? 0.45 : 0.2,
  };
};

const buildUserGeoProfile = (user = {}, preferences = {}) => ({
  country:
    preferences?.preferredCountries?.[0] ||
    normalizeWhitespace(user?.country || "") ||
    "Nigeria",
  state:
    preferences?.preferredStates?.[0] ||
    normalizeWhitespace(user?.state || user?.hometown || ""),
  city:
    preferences?.preferredCities?.[0] ||
    normalizeWhitespace(user?.currentCity || ""),
});

const computeLocalRelevanceScore = (geography = {}, userGeo = {}) => {
  const primaryCountry = normalizeWhitespace(geography?.primaryCountry || "").toLowerCase();
  const primaryState = normalizeWhitespace(geography?.primaryState || "").toLowerCase();
  const primaryCity = normalizeWhitespace(geography?.primaryCity || "").toLowerCase();
  const userCountry = normalizeWhitespace(userGeo?.country || "Nigeria").toLowerCase();
  const userState = normalizeWhitespace(userGeo?.state || "").toLowerCase();
  const userCity = normalizeWhitespace(userGeo?.city || "").toLowerCase();

  if (primaryCity && userCity && primaryCity === userCity) {
    return 1;
  }
  if (primaryState && userState && primaryState === userState) {
    return 0.92;
  }
  if (primaryCountry && userCountry && primaryCountry === userCountry) {
    return geography?.scope === "local" ? 0.84 : 0.76;
  }
  if (geography?.scope === "international") {
    return 0.28;
  }
  return Number(geography?.relevanceScore || 0.2);
};

module.exports = {
  NIGERIA_STATES,
  COUNTRY_KEYWORDS,
  CITY_KEYWORDS,
  inferGeography,
  buildUserGeoProfile,
  computeLocalRelevanceScore,
};
