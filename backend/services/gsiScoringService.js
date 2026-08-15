const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const ratio = (numerator, denominator) =>
  denominator > 0 ? clamp(Number(numerator) / Number(denominator)) : 0;
const round = (value, digits = 0) => {
  const factor = 10 ** digits;
  return Math.round((Number(value) + Number.EPSILON) * factor) / factor;
};
const percent = (value) => round(clamp(value) * 100);

const GSI_SCORING_VERSION = "GSI-Archive-1.2";
const GSI_PAPER_SCORING_VERSION = "GSI-Paper-1.0";

const SCORABLE_WORK_TYPES = new Set([
  "article",
  "review",
  "book-chapter",
  "proceedings-article",
]);

const normalizedWorkType = (work) => String(work?.type || "article").trim().toLowerCase();
const isScorableWork = (work) => SCORABLE_WORK_TYPES.has(normalizedWorkType(work));

const scoreJournal = ({
  source = {},
  publications = [],
  impactEvidence = {},
  now = new Date(),
} = {}) => {
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

  const hasImpactSource = Boolean(
    impactEvidence.sourceUrl && impactEvidence.verificationStatus === "self-reported"
  );
  const policyMentions = hasImpactSource
    ? Math.max(0, Number(impactEvidence.policyMentions) || 0)
    : 0;
  const ngoAdoptions = hasImpactSource
    ? Math.max(0, Number(impactEvidence.ngoAdoptions) || 0)
    : 0;
  const localCitations = hasImpactSource
    ? Math.max(0, Number(impactEvidence.localCitations) || 0)
    : 0;
  const policySignal = clamp(Math.log1p(policyMentions) / Math.log(6));
  const adoptionSignal = clamp(Math.log1p(ngoAdoptions) / Math.log(4));
  const localCitationSignal = clamp(Math.log1p(localCitations) / Math.log(11));

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
      key: "localImpact",
      label: "Documented local impact",
      weight: 10,
      score: round(policySignal * 4 + adoptionSignal * 4 + localCitationSignal * 2),
      explanation: hasImpactSource
        ? "Uses self-reported counts linked to a public evidence source; the claims remain clearly labeled until independently verified."
        : "No public local-impact evidence was submitted, so this category contributes zero points rather than inferring impact from global citations.",
      metrics: [
        { label: "Policy mentions", value: policyMentions, percent: percent(policySignal) },
        { label: "NGO / programme adoptions", value: ngoAdoptions, percent: percent(adoptionSignal) },
        { label: "Local citations", value: localCitations, percent: percent(localCitationSignal) },
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
    version: GSI_SCORING_VERSION,
    total,
    maximum: 100,
    sampleSize: workCount,
    methodologyNote:
      "The score uses research publication types (articles, reviews, book chapters, and proceedings articles). Other OpenAlex records remain archived as evidence but do not affect the score.",
    components,
    summary: workCount
      ? `The journal is strongest in ${strongest.label.toLowerCase()}. The clearest opportunity is ${opportunity.label.toLowerCase()}, based on OpenAlex metadata and any disclosed local-impact evidence.`
      : reviewedWorks.length
        ? "OpenAlex returned records, but none were eligible research publication types, so they were retained as evidence without affecting the score."
        : "No publications were returned, so the score reflects missing indexed evidence rather than journal quality.",
    fairnessNote:
      "This score evaluates record visibility, metadata coverage, and disclosed local-impact evidence. It does not use impact factor, aggregate global citation rank, publisher prestige, language, or country income, and it should not be read as a judgment of research quality.",
    context: {
      countries,
      reviewedPublications: reviewedWorks.length,
      scoredPublications: workCount,
      excludedPublications: excludedWorks.length,
      excludedWorkTypes: [...new Set(excludedWorks.map(normalizedWorkType))].sort(),
      totalIndexedPublications: Math.max(Number(source.worksCount) || 0, workCount),
      latestPublicationYear: latestYear || null,
      impactEvidenceStatus: hasImpactSource ? "self-reported" : "not-provided",
    },
  };
};

const scorePaper = ({ paper = {}, impactEvidence = {} } = {}) => {
  const metadataFields = [
    { label: "Title", present: Boolean(paper.title) },
    { label: "Abstract", present: Boolean(paper.abstract) },
    { label: "Research field", present: Boolean(paper.field) },
    { label: "Publication year", present: Boolean(paper.publicationYear) },
    { label: "Journal or venue", present: Boolean(paper.journalName) },
  ];
  const metadataCoverage = ratio(metadataFields.filter((field) => field.present).length, metadataFields.length);
  const authorSignal = paper.authors?.length ? 1 : 0;
  const institutionSignal = paper.institution ? 1 : 0;
  const countrySignal = paper.countryCode ? 1 : 0;
  const hasImpactSource = Boolean(
    impactEvidence.sourceUrl && impactEvidence.verificationStatus === "self-reported"
  );
  const policyMentions = hasImpactSource ? Math.max(0, Number(impactEvidence.policyMentions) || 0) : 0;
  const ngoAdoptions = hasImpactSource ? Math.max(0, Number(impactEvidence.ngoAdoptions) || 0) : 0;
  const localCitations = hasImpactSource ? Math.max(0, Number(impactEvidence.localCitations) || 0) : 0;
  const policySignal = clamp(Math.log1p(policyMentions) / Math.log(6));
  const adoptionSignal = clamp(Math.log1p(ngoAdoptions) / Math.log(4));
  const localCitationSignal = clamp(Math.log1p(localCitations) / Math.log(11));

  const components = [
    {
      key: "metadata",
      label: "Metadata completeness",
      weight: 25,
      score: round(metadataCoverage * 25),
      explanation: `${metadataFields.filter((field) => field.present).length} of ${metadataFields.length} core discovery fields are present.`,
      metrics: metadataFields.map((field) => ({
        label: field.label,
        value: field.present ? "Present" : "Not provided",
        percent: field.present ? 100 : 0,
      })),
    },
    {
      key: "openAccess",
      label: "Open-access availability",
      weight: 20,
      score: paper.openAccessUrl ? 20 : 0,
      explanation: paper.openAccessUrl
        ? "A public link lets readers reach the research without a subscription barrier."
        : "No public full-text link was provided, so this category contributes zero points.",
      metrics: [{ label: "Public full text", value: paper.openAccessUrl ? "Linked" : "Not linked", percent: paper.openAccessUrl ? 100 : 0 }],
    },
    {
      key: "researchIdentity",
      label: "Author & institution context",
      weight: 15,
      score: authorSignal * 8 + institutionSignal * 4 + countrySignal * 3,
      explanation: "Measures whether the people and research context are identifiable, not institutional prestige or country wealth.",
      metrics: [
        { label: "Named authors", value: paper.authors?.length || 0, percent: authorSignal * 100 },
        { label: "Institution", value: institutionSignal ? "Present" : "Not provided", percent: institutionSignal * 100 },
        { label: "Research country", value: countrySignal ? paper.countryCode : "Not provided", percent: countrySignal * 100 },
      ],
    },
    {
      key: "identifiers",
      label: "Persistent identifier",
      weight: 10,
      score: paper.doi ? 10 : 0,
      explanation: paper.doi
        ? "A DOI provides a durable scholarly identifier for this paper."
        : "No DOI was provided; the public GSI record still supplies a stable discovery reference.",
      metrics: [{ label: "DOI", value: paper.doi || "Not provided", percent: paper.doi ? 100 : 0 }],
    },
    {
      key: "localImpact",
      label: "Documented local impact",
      weight: 30,
      score: round(policySignal * 12 + adoptionSignal * 10 + localCitationSignal * 8),
      explanation: hasImpactSource
        ? "Uses self-reported counts linked to a public evidence source; claims remain clearly labeled until independently verified."
        : "No public local-impact evidence was submitted, so this category contributes zero points rather than inferring impact from global citations.",
      metrics: [
        { label: "Policy mentions", value: policyMentions, percent: percent(policySignal) },
        { label: "NGO / programme adoptions", value: ngoAdoptions, percent: percent(adoptionSignal) },
        { label: "Local citations", value: localCitations, percent: percent(localCitationSignal) },
      ],
    },
  ];
  const total = Math.min(100, components.reduce((sum, component) => sum + component.score, 0));
  const ranked = [...components].sort(
    (first, second) => second.score / second.weight - first.score / first.weight
  );

  return {
    version: GSI_PAPER_SCORING_VERSION,
    total,
    maximum: 100,
    sampleSize: 1,
    methodologyNote:
      "This paper-level score uses only submitted metadata, public availability, durable identifiers, and disclosed local-impact evidence.",
    components,
    summary: `This paper is strongest in ${ranked[0].label.toLowerCase()}. The clearest opportunity is ${ranked[ranked.length - 1].label.toLowerCase()}.`,
    fairnessNote:
      "This score evaluates discoverability and disclosed evidence. It does not use journal impact factor, citation rank, publisher prestige, language, institution ranking, or country income, and it is not a judgment of research quality.",
    context: {
      countries: paper.countryCode ? [paper.countryCode] : [],
      impactEvidenceStatus: hasImpactSource ? "self-reported" : "not-provided",
    },
  };
};

module.exports = {
  GSI_PAPER_SCORING_VERSION,
  GSI_SCORING_VERSION,
  SCORABLE_WORK_TYPES,
  isScorableWork,
  scoreJournal,
  scorePaper,
};
