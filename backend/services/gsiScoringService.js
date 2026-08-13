const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const ratio = (numerator, denominator) =>
  denominator > 0 ? clamp(Number(numerator) / Number(denominator)) : 0;
const round = (value, digits = 0) => {
  const factor = 10 ** digits;
  return Math.round((Number(value) + Number.EPSILON) * factor) / factor;
};
const percent = (value) => round(clamp(value) * 100);

const SCORABLE_WORK_TYPES = new Set([
  "article",
  "review",
  "book-chapter",
  "proceedings-article",
]);

const normalizedWorkType = (work) => String(work?.type || "article").trim().toLowerCase();
const isScorableWork = (work) => SCORABLE_WORK_TYPES.has(normalizedWorkType(work));

const scoreJournal = ({ source = {}, publications = [], now = new Date() } = {}) => {
  const reviewedWorks = Array.isArray(publications) ? publications : [];
  const works = reviewedWorks.filter(isScorableWork);
  const excludedWorks = reviewedWorks.filter((work) => !isScorableWork(work));
  const workCount = works.length;
  const allAuthors = works.flatMap((work) => (Array.isArray(work.authors) ? work.authors : []));
  const allInstitutions = allAuthors.flatMap((author) =>
    Array.isArray(author.institutions) ? author.institutions : []
  );

  const metadataFields = [
    { key: "title", label: "Publication title", covered: works.filter((work) => work.title).length },
    {
      key: "date",
      label: "Publication date",
      covered: works.filter((work) => work.publicationDate || work.publicationYear).length,
    },
    {
      key: "authors",
      label: "Named authors",
      covered: works.filter((work) => work.authors?.length > 0).length,
    },
    {
      key: "affiliations",
      label: "Institutional affiliations",
      covered: works.filter((work) =>
        work.authors?.some((author) => author.institutions?.length > 0)
      ).length,
    },
    {
      key: "abstracts",
      label: "Abstract availability",
      covered: works.filter((work) => work.hasAbstract).length,
    },
  ];
  const metadataCoverage = metadataFields.length
    ? metadataFields.reduce((sum, field) => sum + ratio(field.covered, workCount), 0) /
      metadataFields.length
    : 0;

  const currentYear = now.getUTCFullYear();
  const sourceYears = Array.isArray(source.countsByYear) ? source.countsByYear : [];
  const fallbackYears = works.map((work) => Number(work.publicationYear) || 0);
  const knownYears = [...sourceYears.map((entry) => Number(entry.year) || 0), ...fallbackYears]
    .filter((year) => year > 0 && year <= currentYear);
  const earliestYear = knownYears.length ? Math.min(...knownYears) : currentYear;
  const latestYear = knownYears.length ? Math.max(...knownYears) : 0;
  const completedWindow = Array.from({ length: 5 }, (_, index) => currentYear - 1 - index)
    .filter((year) => year >= earliestYear);
  const activeYears = new Set(
    sourceYears
      .filter((entry) => Number(entry.worksCount) > 0)
      .map((entry) => Number(entry.year))
      .concat(fallbackYears)
  );
  const continuityCoverage = completedWindow.length
    ? ratio(completedWindow.filter((year) => activeYears.has(year)).length, completedWindow.length)
    : latestYear === currentYear
      ? 1
      : 0;
  const recency = latestYear >= currentYear - 1
    ? 1
    : latestYear === currentYear - 2
      ? 0.75
      : latestYear === currentYear - 3
        ? 0.5
        : latestYear > 0
          ? 0.2
          : 0;

  const oaCount = works.filter((work) => work.isOpenAccess).length;
  const oaCoverage = ratio(oaCount, workCount);

  const identifiedAuthors = allAuthors.filter((author) => author.id).length;
  const affiliatedAuthors = allAuthors.filter((author) => author.institutions?.length > 0).length;
  const geocodedInstitutions = allInstitutions.filter((institution) => institution.countryCode).length;
  const authorIdentityCoverage = ratio(identifiedAuthors, allAuthors.length);
  const affiliationCoverage = ratio(affiliatedAuthors, allAuthors.length);
  const geographicContextCoverage = ratio(geocodedInstitutions, allInstitutions.length);
  const countries = [
    ...new Set(allInstitutions.map((institution) => institution.countryCode).filter(Boolean)),
  ];

  const doiCount = works.filter((work) => work.doi).length;
  const doiCoverage = ratio(doiCount, workCount);
  const hasIssn = Boolean(source.issnL || source.issns?.length);

  const topicCount = works.filter((work) => work.topics?.length > 0).length;
  const topicCoverage = ratio(topicCount, workCount);
  const averageCitations = workCount
    ? works.reduce((sum, work) => sum + Math.max(0, Number(work.citedByCount) || 0), 0) / workCount
    : 0;
  const citationSignal = clamp(Math.log1p(averageCitations) / Math.log(11));
  const indexedVolume = clamp(Math.log1p(Math.max(source.worksCount || 0, workCount)) / Math.log(101));

  const components = [
    {
      key: "metadata",
      label: "Metadata completeness",
      weight: 25,
      score: round(metadataCoverage * 25),
      explanation: `${percent(metadataCoverage)}% average coverage across titles, dates, authors, affiliations, and abstracts.`,
      metrics: metadataFields.map((field) => ({
        label: field.label,
        value: `${field.covered} of ${workCount}`,
        percent: percent(ratio(field.covered, workCount)),
      })),
    },
    {
      key: "continuity",
      label: "Publishing continuity",
      weight: 20,
      score: round(continuityCoverage * 15 + recency * 5),
      explanation: `${completedWindow.filter((year) => activeYears.has(year)).length} of ${completedWindow.length || 1} applicable recent years contain indexed work; the latest record is from ${latestYear || "an unknown year"}.`,
      metrics: [
        {
          label: "Recent active years",
          value: `${completedWindow.filter((year) => activeYears.has(year)).length} of ${completedWindow.length || 1}`,
          percent: percent(continuityCoverage),
        },
        { label: "Latest indexed year", value: latestYear || "Not available", percent: percent(recency) },
      ],
    },
    {
      key: "openAccess",
      label: "Open-access availability",
      weight: 20,
      score: round(oaCoverage * 20),
      explanation: `${oaCount} of ${workCount} reviewed publications are identified as openly accessible.`,
      metrics: [{ label: "Open publications", value: `${oaCount} of ${workCount}`, percent: percent(oaCoverage) }],
    },
    {
      key: "researchIdentity",
      label: "Author & institution context",
      weight: 15,
      score: round(authorIdentityCoverage * 6 + affiliationCoverage * 5 + geographicContextCoverage * 4),
      explanation: `Measures whether people and institutions are identifiable—not prestige, citation rank, or country wealth.`,
      metrics: [
        { label: "Identified authors", value: `${identifiedAuthors} of ${allAuthors.length}`, percent: percent(authorIdentityCoverage) },
        { label: "Authors with affiliations", value: `${affiliatedAuthors} of ${allAuthors.length}`, percent: percent(affiliationCoverage) },
        { label: "Institutions with country data", value: `${geocodedInstitutions} of ${allInstitutions.length}`, percent: percent(geographicContextCoverage) },
      ],
    },
    {
      key: "identifiers",
      label: "Persistent identifiers",
      weight: 10,
      score: round(doiCoverage * 8 + (hasIssn ? 2 : 0)),
      explanation: `${doiCount} of ${workCount} reviewed publications have a DOI; ${hasIssn ? "the journal has an ISSN" : "no ISSN was returned"}.`,
      metrics: [
        { label: "DOI coverage", value: `${doiCount} of ${workCount}`, percent: percent(doiCoverage) },
        { label: "Journal ISSN", value: hasIssn ? "Present" : "Not returned", percent: hasIssn ? 100 : 0 },
      ],
    },
    {
      key: "discoverability",
      label: "Discoverability signals",
      weight: 10,
      score: round(topicCoverage * 4 + citationSignal * 4 + indexedVolume * 2),
      explanation: `Combines topic labeling, citation visibility, and indexed publication volume without comparing journal prestige.`,
      metrics: [
        { label: "Topic coverage", value: `${topicCount} of ${workCount}`, percent: percent(topicCoverage) },
        { label: "Average citations", value: round(averageCitations, 1), percent: percent(citationSignal) },
        { label: "Works indexed", value: Math.max(source.worksCount || 0, workCount), percent: percent(indexedVolume) },
      ],
    },
  ];

  const total = Math.min(100, components.reduce((sum, component) => sum + component.score, 0));
  const ranked = [...components].sort(
    (first, second) => second.score / second.weight - first.score / first.weight
  );
  const strongest = ranked[0];
  const opportunity = [...ranked].reverse()[0];

  return {
    version: "GSI-Archive-1.1",
    total,
    maximum: 100,
    sampleSize: workCount,
    methodologyNote:
      "The score uses research publication types (articles, reviews, book chapters, and proceedings articles). Other OpenAlex records remain archived as evidence but do not affect the score.",
    components,
    summary: workCount
      ? `The journal is strongest in ${strongest.label.toLowerCase()}. The clearest opportunity is ${opportunity.label.toLowerCase()}, based only on the metadata currently available from OpenAlex.`
      : reviewedWorks.length
        ? "OpenAlex returned records, but none were eligible research publication types, so they were retained as evidence without affecting the score."
        : "No publications were returned, so the score reflects missing indexed evidence rather than journal quality.",
    fairnessNote:
      "This score evaluates record visibility and metadata coverage. It does not use impact factor, publisher prestige, language, or country income, and it should not be read as a judgment of research quality.",
    context: {
      countries,
      reviewedPublications: reviewedWorks.length,
      scoredPublications: workCount,
      excludedPublications: excludedWorks.length,
      excludedWorkTypes: [...new Set(excludedWorks.map(normalizedWorkType))].sort(),
      totalIndexedPublications: Math.max(Number(source.worksCount) || 0, workCount),
      latestPublicationYear: latestYear || null,
    },
  };
};

module.exports = { SCORABLE_WORK_TYPES, isScorableWork, scoreJournal };
