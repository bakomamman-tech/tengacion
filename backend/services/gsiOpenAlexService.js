const OPENALEX_BASE_URL = "https://api.openalex.org";
const CROSSREF_BASE_URL = "https://api.crossref.org";
const DEFAULT_TIMEOUT_MS = 15000;
const CROSSREF_TIMEOUT_MS = 8000;
const MAX_IMPORTED_WORKS = 100;
const MAX_SEARCH_RESULTS = 8;

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

const normalizeHttpUrl = (value) => {
  const candidate = cleanText(value, 700);
  if (!candidate) return "";
  try {
    const url = new URL(candidate);
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : "";
  } catch {
    return "";
  }
};

const normalizedWords = (value) =>
  cleanText(value, 300)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const normalizedHostname = (value) => {
  const candidate = cleanText(value, 700);
  if (!candidate) return "";
  try {
    const url = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(candidate) ? candidate : `https://${candidate}`);
    if (!["http:", "https:"].includes(url.protocol)) return "";
    return url.hostname.toLowerCase().replace(/^www\./, "").replace(/\.$/, "");
  } catch {
    return "";
  }
};

const expandWebsiteToken = (value) =>
  value
    .replace(/^the(?=[a-z]{4,}$)/, "the ")
    .replace(/^pan(?=african|american|asian|european)/, "pan ")
    .replace(/(journal|review|science|health|medical|medicine|research)$/g, " $1")
    .trim();

const parseWebsiteQuery = (value) => {
  const candidate = cleanText(value, 700);
  const hasScheme = /^[a-z][a-z\d+.-]*:\/\//i.test(candidate);
  const looksLikeDomain = /^(?:www\.)?(?:[a-z\d-]+\.)+[a-z]{2,}(?::\d+)?(?:[/?#]|$)/i.test(candidate);
  if (!hasScheme && !looksLikeDomain) return null;

  try {
    const url = new URL(hasScheme ? candidate : `https://${candidate}`);
    const domain = normalizedHostname(url.toString());
    if (!domain || !domain.includes(".")) return null;

    const hostnameParts = domain.split(".");
    const pathParts = url.pathname.split("/").filter(Boolean);
    const ignoredParts = new Set([
      "ac", "co", "com", "edu", "gov", "net", "online", "org", "www",
    ]);
    const searchText = [...hostnameParts.slice(0, -1), ...pathParts]
      .flatMap((part) => part.split(/[-_.]+/))
      .map((part) => expandWebsiteToken(part.toLowerCase()))
      .filter((part) => part.length > 1 && !ignoredParts.has(part))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    return { domain, searchText: searchText || hostnameParts[0] };
  } catch {
    return null;
  }
};

const domainsMatch = (homepageUrl, searchedDomain) => {
  const homepageDomain = normalizedHostname(homepageUrl);
  if (!homepageDomain || !searchedDomain) return false;
  return homepageDomain === searchedDomain ||
    homepageDomain.endsWith(`.${searchedDomain}`) ||
    searchedDomain.endsWith(`.${homepageDomain}`);
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

const reconstructAbstract = (invertedIndex) => {
  if (!invertedIndex || typeof invertedIndex !== "object" || Array.isArray(invertedIndex)) return "";
  const wordsByPosition = [];
  for (const [word, positions] of Object.entries(invertedIndex)) {
    for (const position of Array.isArray(positions) ? positions : []) {
      if (Number.isInteger(position) && position >= 0 && position < 1200) {
        wordsByPosition[position] = cleanText(word, 120);
      }
    }
  }
  return cleanText(wordsByPosition.filter(Boolean).join(" "), 5000);
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

const normalizeCrossrefJournal = (journal = {}) => {
  const issns = uniqueBy(
    (Array.isArray(journal.ISSN) ? journal.ISSN : [])
      .map(normalizeIssn)
      .filter(Boolean),
    (issn) => issn
  ).slice(0, 8);
  const title = Array.isArray(journal.title) ? journal.title[0] : journal.title;

  return {
    displayName: cleanText(title, 300) || "Untitled journal",
    publisher: cleanText(journal.publisher, 260),
    issnL: normalizeIssn(journal["ISSN-L"]) || issns[0] || "",
    issns,
    homepageUrl: normalizeHttpUrl(journal.URL),
    sourceProvider: "Crossref",
  };
};

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
    abstract: reconstructAbstract(work.abstract_inverted_index),
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

const fetchCrossref = async (pathname, query = {}) => {
  const url = new URL(pathname, CROSSREF_BASE_URL);
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });
  url.searchParams.set("mailto", "stephen@tengacion.com");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CROSSREF_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "Tengacion-Team-Archive/1.0 (mailto:stephen@tengacion.com)",
      },
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
};

const annotateSource = (source, matchedBy, matchLabel) => ({
  ...source,
  matchedBy,
  matchLabel,
});

const publisherMatchesQuery = (publisher, query) => {
  const queryWords = normalizedWords(query).split(" ").filter(Boolean);
  if (!queryWords.length) return false;
  const names = [publisher?.display_name, ...(Array.isArray(publisher?.alternate_titles)
    ? publisher.alternate_titles
    : [])]
    .map(normalizedWords)
    .filter(Boolean);

  return names.some((name) => {
    if (name === queryWords.join(" ")) return true;
    const nameWords = name.split(" ");
    return queryWords.every((queryWord) => nameWords.some((nameWord) =>
      nameWord === queryWord ||
      (queryWord.length >= 4 && nameWord.startsWith(queryWord)) ||
      (nameWord.length >= 4 && queryWord.startsWith(nameWord))
    ));
  });
};

const crossrefFallback = async (query) => {
  const payload = await fetchCrossref("/journals", { query, rows: MAX_SEARCH_RESULTS });
  const candidates = uniqueBy(
    (Array.isArray(payload?.message?.items) ? payload.message.items : [])
      .map(normalizeCrossrefJournal)
      .filter((journal) => journal.issns.length),
    (journal) => journal.issnL || journal.issns.join("|")
  ).slice(0, MAX_SEARCH_RESULTS);
  if (!candidates.length) return { results: [], externalCandidates: [] };

  const issns = uniqueBy(candidates.flatMap((journal) => journal.issns), (issn) => issn).slice(0, 40);
  try {
    const openAlexPayload = await fetchOpenAlex("/sources", {
      filter: `type:journal,issn:${issns.join("|")}`,
      per_page: Math.min(50, Math.max(MAX_SEARCH_RESULTS, issns.length)),
    });
    const results = uniqueBy(
      (Array.isArray(openAlexPayload?.results) ? openAlexPayload.results : [])
        .map(normalizeSource)
        .filter((source) => source.id)
        .map((source) => annotateSource(source, "crossref", "ISSN resolved through Crossref")),
      (source) => source.id
    ).slice(0, MAX_SEARCH_RESULTS);
    const matchedIssns = new Set(results.flatMap((source) => [source.issnL, ...source.issns]));
    const externalCandidates = candidates
      .filter((journal) => !journal.issns.some((issn) => matchedIssns.has(issn)))
      .slice(0, 3);
    return { results, externalCandidates };
  } catch {
    return { results: [], externalCandidates: candidates.slice(0, 3) };
  }
};

const searchByWebsite = async (cleanedQuery, website) => {
  const payload = await fetchOpenAlex("/sources", {
    search: website.searchText,
    filter: "type:journal",
    per_page: 25,
  });
  const normalized = uniqueBy(
    (Array.isArray(payload?.results) ? payload.results : [])
      .map(normalizeSource)
      .filter((source) => source.id),
    (source) => source.id
  );
  const exact = normalized
    .filter((source) => domainsMatch(source.homepageUrl, website.domain))
    .map((source) => annotateSource(source, "website", `Website: ${website.domain}`));
  const approximate = normalized
    .filter((source) => !domainsMatch(source.homepageUrl, website.domain))
    .map((source) => annotateSource(source, "website-derived", "Possible match from website name"));
  const fallback = exact.length
    ? { results: [], externalCandidates: [] }
    : await crossrefFallback(website.searchText);
  const results = uniqueBy([...exact, ...fallback.results, ...approximate], (source) => source.id)
    .slice(0, MAX_SEARCH_RESULTS);

  return {
    query: cleanedQuery,
    matchType: exact.length ? "website" : fallback.results.length ? "crossref" : "website-derived",
    results,
    totalMatches: results.length,
    externalCandidates: results.length ? [] : fallback.externalCandidates,
    fallbackUsed: Boolean(fallback.results.length),
  };
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
      return {
        query: cleanedQuery,
        matchType: "issn",
        results: [annotateSource(normalizeSource(exact), "issn", `Exact ISSN: ${issn}`)],
        totalMatches: 1,
        externalCandidates: [],
        fallbackUsed: false,
      };
    } catch (error) {
      if (error.code !== "JOURNAL_NOT_FOUND") throw error;
    }
  }

  const website = parseWebsiteQuery(cleanedQuery);
  if (website) return searchByWebsite(cleanedQuery, website);

  const [sourcePayload, publisherPayload] = await Promise.all([
    fetchOpenAlex("/sources", {
      search: cleanedQuery,
      filter: "type:journal",
      per_page: MAX_SEARCH_RESULTS,
    }),
    fetchOpenAlex("/publishers", {
      search: cleanedQuery,
      per_page: 3,
    }).catch(() => null),
  ]);
  const titleResults = (Array.isArray(sourcePayload?.results) ? sourcePayload.results : [])
    .map(normalizeSource)
    .filter((source) => source.id)
    .map((source) => annotateSource(source, "title", "Journal title or alternate title"));
  const publishers = (Array.isArray(publisherPayload?.results) ? publisherPayload.results : [])
    .filter((publisher) => entityId(publisher?.id, "P") && publisherMatchesQuery(publisher, cleanedQuery))
    .slice(0, 3);
  let publisherResults = [];
  if (publishers.length) {
    const publisherIds = publishers.map((publisher) => entityId(publisher.id, "P"));
    try {
      const payload = await fetchOpenAlex("/sources", {
        filter: `type:journal,host_organization_lineage:${publisherIds.join("|")}`,
        sort: "works_count:desc",
        per_page: MAX_SEARCH_RESULTS,
      });
      publisherResults = (Array.isArray(payload?.results) ? payload.results : [])
        .map(normalizeSource)
        .filter((source) => source.id)
        .map((source) => annotateSource(
          source,
          "publisher",
          `Publisher: ${source.publisher || cleanText(publishers[0]?.display_name, 260)}`
        ));
    } catch {
      publisherResults = [];
    }
  }

  const exactPublisher = publishers.some((publisher) =>
    normalizedWords(publisher?.display_name) === normalizedWords(cleanedQuery)
  );
  let results = uniqueBy(
    exactPublisher ? [...publisherResults, ...titleResults] : [...titleResults, ...publisherResults],
    (source) => source.id
  ).slice(0, MAX_SEARCH_RESULTS);
  const fallback = results.length
    ? { results: [], externalCandidates: [] }
    : await crossrefFallback(cleanedQuery);
  if (!results.length) results = fallback.results;

  return {
    query: cleanedQuery,
    matchType: exactPublisher && publisherResults.length
      ? "publisher"
      : results.some((source) => source.matchedBy === "crossref")
        ? "crossref"
        : "search",
    results,
    totalMatches: Math.max(0, Number(sourcePayload?.meta?.count) || results.length),
    externalCandidates: results.length ? [] : fallback.externalCandidates,
    fallbackUsed: Boolean(fallback.results.length || fallback.externalCandidates.length),
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
  parseWebsiteQuery,
  normalizeSource,
  normalizeWork,
  reconstructAbstract,
  searchJournals,
};
