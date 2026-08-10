const OPENALEX_BASE_URL = "https://api.openalex.org";
const DEFAULT_TIMEOUT_MS = 15000;
const MAX_IMPORTED_WORKS = 100;

class GsiOpenAlexError extends Error {
  constructor(message, { status = 502, code = "OPENALEX_UNAVAILABLE" } = {}) {
    super(message);
    this.name = "GsiOpenAlexError";
    this.status = status;
    this.code = code;
  }
}

const cleanText = (value, maxLength = 500) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);

const entityId = (value, prefix) => {
  const match = cleanText(value, 120).match(new RegExp(`${prefix}\\d+`, "i"));
  return match ? match[0].toUpperCase() : "";
};

const normalizeIssn = (value) => {
  const match = cleanText(value, 80).toUpperCase().match(/\b\d{4}-?\d{3}[\dX]\b/);
  if (!match) return "";
  const compact = match[0].replace("-", "");
  return `${compact.slice(0, 4)}-${compact.slice(4)}`;
};

const uniqueBy = (items, keyFn) => {
  const seen = new Set();
  return items.filter((item) => {
    const key = keyFn(item);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const normalizeSource = (source = {}) => ({
  id: entityId(source.id, "S"),
  openAlexUrl: cleanText(source.id, 180),
  displayName: cleanText(source.display_name, 300) || "Untitled journal",
  alternateTitles: Array.isArray(source.alternate_titles)
    ? source.alternate_titles.map((title) => cleanText(title, 220)).filter(Boolean).slice(0, 6)
    : [],
  type: cleanText(source.type, 50) || "journal",
  issnL: cleanText(source.issn_l, 24),
  issns: Array.isArray(source.issn)
    ? source.issn.map((issn) => cleanText(issn, 24)).filter(Boolean).slice(0, 8)
    : [],
  publisher: cleanText(source.host_organization_name, 260),
  homepageUrl: cleanText(source.homepage_url, 700),
  countryCode: cleanText(source.country_code, 4).toUpperCase(),
  worksCount: Math.max(0, Number(source.works_count) || 0),
  citedByCount: Math.max(0, Number(source.cited_by_count) || 0),
  isOpenAccess: Boolean(source.is_oa),
  isInDoaj: Boolean(source.is_in_doaj),
  countsByYear: Array.isArray(source.counts_by_year)
    ? source.counts_by_year
        .map((entry) => ({
          year: Number(entry?.year) || 0,
          worksCount: Math.max(0, Number(entry?.works_count) || 0),
          citedByCount: Math.max(0, Number(entry?.cited_by_count) || 0),
        }))
        .filter((entry) => entry.year > 0)
        .slice(0, 20)
    : [],
});

const normalizeWork = (work = {}) => {
  const authorships = Array.isArray(work.authorships) ? work.authorships : [];
  const authors = authorships
    .map((authorship) => {
      const institutions = uniqueBy(
        (Array.isArray(authorship?.institutions) ? authorship.institutions : [])
          .map((institution) => ({
            id: entityId(institution?.id, "I"),
            displayName: cleanText(institution?.display_name, 220),
            countryCode: cleanText(institution?.country_code, 4).toUpperCase(),
            isGlobalSouth: Boolean(institution?.is_global_south),
          }))
          .filter((institution) => institution.id || institution.displayName),
        (institution) => institution.id || `${institution.displayName}:${institution.countryCode}`
      );

      return {
        id: entityId(authorship?.author?.id, "A"),
        displayName: cleanText(authorship?.author?.display_name, 220) || "Unidentified author",
        orcid: cleanText(authorship?.author?.orcid, 180),
        position: cleanText(authorship?.author_position, 30),
        institutions,
      };
    })
    .slice(0, 50);

  const topics = uniqueBy(
    [work.primary_topic, ...(Array.isArray(work.topics) ? work.topics : [])]
      .filter(Boolean)
      .map((topic) => ({
        id: entityId(topic?.id, "T"),
        displayName: cleanText(topic?.display_name, 220),
      }))
      .filter((topic) => topic.id || topic.displayName),
    (topic) => topic.id || topic.displayName
  ).slice(0, 6);

  const openAccess = work.open_access || {};
  const primaryLocation = work.primary_location || {};

  return {
    id: entityId(work.id, "W"),
    openAlexUrl: cleanText(work.id, 180),
    doi: cleanText(work.doi, 300),
    title: cleanText(work.title || work.display_name, 700) || "Untitled publication",
    publicationYear: Number(work.publication_year) || null,
    publicationDate: cleanText(work.publication_date, 20),
    type: cleanText(work.type, 60) || "article",
    language: cleanText(work.language, 12),
    citedByCount: Math.max(0, Number(work.cited_by_count) || 0),
    isOpenAccess: Boolean(openAccess.is_oa || primaryLocation.is_oa),
    openAccessStatus: cleanText(openAccess.oa_status, 40),
    hasAbstract: Boolean(work.abstract_inverted_index),
    landingPageUrl: cleanText(primaryLocation.landing_page_url, 700),
    authors,
    topics,
  };
};

const getApiKey = () => cleanText(process.env.OPENALEX_API_KEY, 500);

const fetchOpenAlex = async (pathname, query = {}) => {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new GsiOpenAlexError(
      "Journal discovery is being configured. Please try again shortly.",
      { status: 503, code: "OPENALEX_NOT_CONFIGURED" }
    );
  }

  const url = new URL(pathname, OPENALEX_BASE_URL);
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });
  url.searchParams.set("api_key", apiKey);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "Tengacion-Team-Archive/1.0 (journal-indexing; stephen@tengacion.com)",
      },
    });

    if (response.status === 404) {
      throw new GsiOpenAlexError("We could not find that journal in OpenAlex.", {
        status: 404,
        code: "JOURNAL_NOT_FOUND",
      });
    }
    if (response.status === 401 || response.status === 403) {
      throw new GsiOpenAlexError(
        "Journal discovery is temporarily unavailable while access is restored.",
        { status: 503, code: "OPENALEX_ACCESS_DENIED" }
      );
    }
    if (response.status === 429) {
      throw new GsiOpenAlexError(
        "OpenAlex is receiving many requests. Please wait a moment and try again.",
        { status: 429, code: "OPENALEX_RATE_LIMITED" }
      );
    }
    if (!response.ok) {
      throw new GsiOpenAlexError(
        "OpenAlex could not complete the request. Your work has not been lost; please try again.",
        { status: 502, code: "OPENALEX_UNAVAILABLE" }
      );
    }

    return await response.json();
  } catch (error) {
    if (error instanceof GsiOpenAlexError) throw error;
    if (error?.name === "AbortError") {
      throw new GsiOpenAlexError(
        "OpenAlex took too long to respond. Please check your connection and try again.",
        { status: 504, code: "OPENALEX_TIMEOUT" }
      );
    }
    throw new GsiOpenAlexError(
      "We could not reach OpenAlex. Please check your connection and try again.",
      { status: 502, code: "OPENALEX_UNAVAILABLE" }
    );
  } finally {
    clearTimeout(timeout);
  }
};

const searchJournals = async (query) => {
  const cleanedQuery = cleanText(query, 160);
  if (cleanedQuery.length < 2) {
    throw new GsiOpenAlexError(
      "Enter at least two characters from the journal name, ISSN, publisher, or website.",
      { status: 400, code: "INVALID_SEARCH" }
    );
  }

  const issn = normalizeIssn(cleanedQuery);
  if (issn) {
    try {
      const exact = await fetchOpenAlex(`/sources/issn:${issn}`);
      return { query: cleanedQuery, matchType: "issn", results: [normalizeSource(exact)] };
    } catch (error) {
      if (error.code !== "JOURNAL_NOT_FOUND") throw error;
    }
  }

  const payload = await fetchOpenAlex("/sources", {
    search: cleanedQuery,
    filter: "type:journal",
    per_page: 8,
  });
  const results = (Array.isArray(payload?.results) ? payload.results : [])
    .map(normalizeSource)
    .filter((source) => source.id);

  return {
    query: cleanedQuery,
    matchType: "search",
    results,
    totalMatches: Math.max(0, Number(payload?.meta?.count) || results.length),
  };
};

const importJournal = async (sourceIdValue) => {
  const sourceId = entityId(sourceIdValue, "S");
  if (!sourceId) {
    throw new GsiOpenAlexError("Select a valid journal before continuing.", {
      status: 400,
      code: "INVALID_SOURCE_ID",
    });
  }

  const [sourcePayload, worksPayload] = await Promise.all([
    fetchOpenAlex(`/sources/${sourceId}`),
    fetchOpenAlex("/works", {
      filter: `primary_location.source.id:${sourceId}`,
      sort: "publication_date:desc",
      per_page: MAX_IMPORTED_WORKS,
    }),
  ]);

  const source = normalizeSource(sourcePayload);
  const publications = (Array.isArray(worksPayload?.results) ? worksPayload.results : [])
    .map(normalizeWork)
    .filter((work) => work.id);

  return {
    source,
    publications,
    importSummary: {
      totalWorks: Math.max(0, Number(worksPayload?.meta?.count) || source.worksCount),
      reviewedWorks: publications.length,
      isSample: (Number(worksPayload?.meta?.count) || 0) > publications.length,
      importedAt: new Date().toISOString(),
      provider: "OpenAlex",
    },
  };
};

module.exports = {
  GsiOpenAlexError,
  importJournal,
  normalizeIssn,
  normalizeSource,
  normalizeWork,
  searchJournals,
};
