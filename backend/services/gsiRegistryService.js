const GsiRegistryRecord = require("../models/GsiRegistryRecord");
const { fetchArchivedRecord } = require("./gsiArchiveService");

const JOURNAL_RECORD_TYPE = "GSI Journal Onboarding Record";
const CID_PATTERN = /^[a-zA-Z0-9]{46,100}$/;

class GsiRegistryError extends Error {
  constructor(message, {
    status = 500,
    code = "GSI_REGISTRY_ERROR",
    registryStatus = null,
    cause = null,
  } = {}) {
    super(message);
    this.name = "GsiRegistryError";
    this.status = status;
    this.code = code;
    this.registryStatus = registryStatus;
    this.cause = cause;
  }
}

const escapeRegex = (value) => String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const cleanText = (value, maxLength) => String(value || "").replace(/\s+/g, " ").trim().slice(0, maxLength);
const uniqueStrings = (values, maxItems = 50) => [...new Set(
  (Array.isArray(values) ? values : []).map((value) => cleanText(value, 220)).filter(Boolean)
)].slice(0, maxItems);
const normalizeIssn = (value) => {
  const match = cleanText(value, 24).toUpperCase().match(/^\d{4}-?\d{3}[\dX]$/);
  if (!match) return "";
  const compact = match[0].replace("-", "");
  return `${compact.slice(0, 4)}-${compact.slice(4)}`;
};
const normalizeStoredIssn = (value) =>
  normalizeIssn(value) || cleanText(value, 24).toUpperCase();
const normalizeIssns = (values) => [...new Set(
  (Array.isArray(values) ? values : []).map(normalizeStoredIssn).filter(Boolean)
)].slice(0, 8);
const normalizeOpenAlexSourceId = (value) => {
  const normalized = cleanText(value, 180);
  const match = normalized.match(/^(?:https?:\/\/(?:www\.)?openalex\.org\/)?(S\d+)\/?$/i);
  return match ? match[1].toUpperCase() : "";
};
const publicationAnchor = (workId) => {
  const normalized = cleanText(workId, 40).toUpperCase().replace(/[^A-Z0-9_-]/g, "");
  return normalized ? `publication-${normalized}` : "";
};
const countryName = (countryCode) => {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(countryCode) || "";
  } catch {
    return "";
  }
};

const buildRegistryEntry = (record, archive) => {
  const isPaper = record?.recordType === "GSI Paper Record";
  const source = isPaper ? record.paper : record.journal;
  return {
    archiveId: archive.id,
    recordKind: isPaper ? "paper" : "journal",
    parentArchiveId: "",
    openAlexSourceId: isPaper ? "" : normalizeOpenAlexSourceId(source.openAlexId),
    openAlexWorkId: "",
    doi: isPaper ? source.doi || "" : "",
    journalName: isPaper ? source.journalName || "" : source.displayName || source.title,
    authors: isPaper ? uniqueStrings(source.authors) : [],
    topics: isPaper ? uniqueStrings([source.field]) : [],
    institutions: [],
    countryCodes: source.countryCode ? [source.countryCode] : [],
    countryNames: source.countryCode ? uniqueStrings([countryName(source.countryCode)]) : [],
    title: source.displayName || source.title,
    subtitle: isPaper
      ? (source.authors || []).join(", ")
      : source.publisher || "",
    abstract: isPaper ? source.abstract : "",
    field: isPaper ? source.field : "",
    countryCode: source.countryCode || "",
    publicationYear: isPaper ? source.publicationYear : null,
    issnL: isPaper ? "" : normalizeStoredIssn(source.issnL),
    issns: isPaper ? [] : normalizeIssns(source.issns),
    indexedWorks: isPaper ? null : Math.max(0, Number(source.worksCount) || 0),
    queryMatchedWorks: isPaper ? null : Math.max(0, Number(record.provenance.totalWorks) || 0),
    reviewedWorks: isPaper ? null : Math.max(0, Number(record.provenance.reviewedWorks) || 0),
    scoredWorks: isPaper
      ? null
      : Math.max(0, Number(record.provenance.scoredPublications ?? record.gsiScore.sampleSize) || 0),
    retainedWorks: isPaper
      ? null
      : Math.max(0, Number(record.provenance.archivedPublications) || 0),
    gsiScore: record.gsiScore.total,
    scoreContext: "record",
    scoringVersion: record.gsiScore.version,
    publicRecordPath: archive.publicRecordPath,
    permanentUrl: archive.permanentUrl,
    sourceProvider: isPaper ? "Submitter" : record.provenance.provider,
    impactEvidenceStatus: record.impactEvidence?.verificationStatus || "not-provided",
    savedAt: archive.savedAt || record.createdAt,
  };
};

const buildJournalWorkRegistryEntries = (record, archive, { sourcePublications = [] } = {}) => {
  if (record?.recordType !== JOURNAL_RECORD_TYPE) return [];
  const sourceById = new Map(
    (Array.isArray(sourcePublications) ? sourcePublications : [])
      .filter((work) => work?.id)
      .map((work) => [cleanText(work.id, 40).toUpperCase(), work])
  );
  const entries = new Map();

  for (const archivedWork of Array.isArray(record.publications) ? record.publications : []) {
    const openAlexWorkId = cleanText(archivedWork?.id, 40).toUpperCase();
    const anchor = publicationAnchor(openAlexWorkId);
    if (!openAlexWorkId || !anchor) continue;
    const work = { ...(sourceById.get(openAlexWorkId) || {}), ...archivedWork };
    const authors = uniqueStrings((work.authors || []).map((author) => author?.displayName));
    const institutionRecords = (work.authors || []).flatMap((author) =>
      Array.isArray(author?.institutions) ? author.institutions : []
    );
    const institutions = uniqueStrings(institutionRecords.map((institution) => institution?.displayName));
    const countryCodes = uniqueStrings(
      institutionRecords
        .map((institution) => cleanText(institution?.countryCode, 2).toUpperCase())
        .filter((countryCode) => /^[A-Z]{2}$/.test(countryCode)),
      20
    );
    const topics = uniqueStrings(
      (work.topics || []).map((topic) => typeof topic === "string" ? topic : topic?.displayName),
      12
    );
    const archiveId = `${archive.id}:work:${openAlexWorkId}`;
    entries.set(archiveId, {
      archiveId,
      recordKind: "journal-work",
      parentArchiveId: archive.id,
      openAlexWorkId,
      doi: cleanText(work.doi, 300),
      journalName: cleanText(record.journal?.displayName, 320),
      authors,
      topics,
      institutions,
      countryCodes,
      countryNames: uniqueStrings(countryCodes.map(countryName), 20),
      title: cleanText(work.title, 320) || "Untitled publication",
      subtitle: authors.join(", ").slice(0, 320),
      abstract: cleanText(work.abstract, 5000),
      field: topics[0] || "",
      countryCode: countryCodes[0] || cleanText(record.journal?.countryCode, 2).toUpperCase(),
      publicationYear: Number(work.publicationYear) || null,
      issnL: cleanText(record.journal?.issnL, 24),
      indexedWorks: null,
      queryMatchedWorks: null,
      reviewedWorks: null,
      scoredWorks: null,
      retainedWorks: null,
      gsiScore: record.gsiScore.total,
      scoreContext: "parent-journal",
      publicRecordPath: `${archive.publicRecordPath}#${anchor}`,
      permanentUrl: archive.permanentUrl,
      sourceProvider: "OpenAlex",
      impactEvidenceStatus: "not-provided",
      savedAt: archive.savedAt || record.createdAt,
    });
  }

  return [...entries.values()];
};

const buildPaperRegistryEntry = (record) => ({
  archiveId: record.publicId,
  recordKind: "paper",
  parentArchiveId: "",
  openAlexSourceId: "",
  openAlexWorkId: "",
  doi: record.paper.doi || "",
  journalName: record.paper.journalName || "",
  authors: uniqueStrings(record.paper.authors),
  topics: uniqueStrings([record.paper.field]),
  institutions: [],
  countryCodes: record.paper.countryCode ? [record.paper.countryCode] : [],
  countryNames: record.paper.countryCode
    ? uniqueStrings([countryName(record.paper.countryCode)])
    : [],
  title: record.paper.title,
  subtitle: record.paper.authors.join(", "),
  abstract: record.paper.abstract,
  field: record.paper.field,
  countryCode: record.paper.countryCode,
  publicationYear: record.paper.publicationYear,
  issnL: "",
  issns: [],
  indexedWorks: null,
  queryMatchedWorks: null,
  reviewedWorks: null,
  scoredWorks: null,
  retainedWorks: null,
  gsiScore: record.gsiScore.total,
  scoreContext: "record",
  scoringVersion: record.gsiScore.version,
  publicRecordPath: `/gsi/papers/${record.publicId}`,
  permanentUrl: "",
  sourceProvider: "Submitter",
  impactEvidenceStatus: record.impactEvidence?.verificationStatus || "not-provided",
  savedAt: record.createdAt || record.confirmedAt,
});

const indexPublishedRecord = async (record, archive, options = {}) => {
  const entry = buildRegistryEntry(record, archive);
  const workEntries = buildJournalWorkRegistryEntries(record, archive, options);
  try {
    await GsiRegistryRecord.updateOne(
      { archiveId: entry.archiveId },
      { $set: entry },
      { upsert: true, runValidators: true }
    );
  } catch (error) {
    throw new GsiRegistryError("The permanent journal was saved, but its discovery entry is pending.", {
      code: "JOURNAL_REGISTRY_PENDING",
      registryStatus: {
        status: "pending",
        journalIndexed: false,
        worksIndexed: 0,
        expectedWorks: workEntries.length,
      },
      cause: error,
    });
  }

  if (workEntries.length) {
    try {
      await GsiRegistryRecord.bulkWrite(
        workEntries.map((workEntry) => ({
          updateOne: {
            filter: { archiveId: workEntry.archiveId },
            update: { $set: workEntry },
            upsert: true,
          },
        })),
        { ordered: false }
      );
    } catch (error) {
      throw new GsiRegistryError("The journal is discoverable, but its retained publications are still being indexed.", {
        code: "JOURNAL_WORKS_REGISTRY_PENDING",
        registryStatus: {
          status: "pending",
          journalIndexed: true,
          worksIndexed: null,
          expectedWorks: workEntries.length,
        },
        cause: error,
      });
    }
  }

  return {
    status: "indexed",
    journalIndexed: true,
    worksIndexed: workEntries.length,
    expectedWorks: workEntries.length,
    entriesIndexed: workEntries.length + 1,
  };
};

const indexPaperRecord = async (record) => {
  const entry = buildPaperRegistryEntry(record);
  await GsiRegistryRecord.updateOne(
    { archiveId: entry.archiveId },
    { $set: entry },
    { upsert: true, runValidators: true }
  );
  return entry;
};

const backfillPublishedJournal = async (recordId, {
  fetchRecord = fetchArchivedRecord,
  indexRecord = indexPublishedRecord,
} = {}) => {
  const id = cleanText(recordId, 120);
  if (!CID_PATTERN.test(id)) {
    throw new GsiRegistryError("That permanent record reference is not valid.", {
      status: 400,
      code: "INVALID_RECORD_ID",
    });
  }
  const archived = await fetchRecord(id);
  if (archived?.id && archived.id !== id) {
    throw new GsiRegistryError("The retrieved archive did not match the requested CID.", {
      status: 422,
      code: "ARCHIVE_ID_MISMATCH",
    });
  }
  if (archived?.record?.recordType !== JOURNAL_RECORD_TYPE) {
    throw new GsiRegistryError("This reference is not a GSI journal record.", {
      status: 422,
      code: "INVALID_RECORD",
    });
  }
  const archive = {
    id,
    contentHash: archived.contentHash || "",
    permanentUrl: archived.permanentUrl || `https://ipfs.io/ipfs/${id}`,
    publicRecordPath: `/gsi/records/${id}`,
    savedAt: archived.record.createdAt,
    archivedPublications: Array.isArray(archived.record.publications)
      ? archived.record.publications.length
      : 0,
  };
  const registry = await indexRecord(archived.record, archive);
  return { archive, record: archived.record, registry };
};

const listRegistryRecords = async (query = {}) => {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = Math.min(24, Math.max(1, Number.parseInt(query.limit, 10) || 12));
  const filter = {};
  const type = String(query.type || "").trim().toLowerCase();
  const hasExplicitType = ["journal", "paper", "journal-work"].includes(type);
  if (hasExplicitType) filter.recordKind = type;
  const country = String(query.country || "").trim().toUpperCase();
  if (/^[A-Z]{2}$/.test(country)) {
    filter.$and = [{ $or: [{ countryCode: country }, { countryCodes: country }] }];
  }
  const field = String(query.field || "").trim();
  if (field) {
    const fieldPattern = { $regex: escapeRegex(field.slice(0, 160)), $options: "i" };
    filter.$and = [...(filter.$and || []), { $or: [{ field: fieldPattern }, { topics: fieldPattern }] }];
  }
  const search = String(query.q || "").trim().slice(0, 180);
  if (search) {
    const exactIssn = normalizeIssn(search);
    const exactOpenAlexSourceId = normalizeOpenAlexSourceId(search);
    let searchFilter;

    if (exactIssn) {
      const compactIssn = exactIssn.replace("-", "");
      const issnPattern = {
        $regex: `^${compactIssn.slice(0, 4)}-?${compactIssn.slice(4)}$`,
        $options: "i",
      };
      searchFilter = { $or: [{ issnL: issnPattern }, { issns: issnPattern }] };
    } else if (exactOpenAlexSourceId) {
      searchFilter = { openAlexSourceId: exactOpenAlexSourceId };
    } else {
      const pattern = { $regex: escapeRegex(search), $options: "i" };
      searchFilter = {
        $or: [
          { title: pattern },
          { subtitle: pattern },
          { abstract: pattern },
          { field: pattern },
          { journalName: pattern },
          { doi: pattern },
          { authors: pattern },
          { topics: pattern },
          { institutions: pattern },
          { countryCode: pattern },
          { countryCodes: pattern },
          { countryNames: pattern },
          { openAlexSourceId: pattern },
          { openAlexWorkId: pattern },
          { issnL: pattern },
          { issns: pattern },
        ],
      };
    }

    if ((exactIssn || exactOpenAlexSourceId) && !hasExplicitType) {
      filter.recordKind = "journal";
    }
    filter.$and = [...(filter.$and || []), searchFilter];
  }

  const [results, total, countGroups] = await Promise.all([
    GsiRegistryRecord.find(filter)
      .sort({ savedAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select("-__v -updatedAt")
      .lean(),
    GsiRegistryRecord.countDocuments(filter),
    GsiRegistryRecord.aggregate([
      { $group: { _id: "$recordKind", count: { $sum: 1 } } },
    ]),
  ]);

  const countsByKind = Object.fromEntries(countGroups.map((group) => [group._id, group.count]));
  const journals = countsByKind.journal || 0;
  const papers = countsByKind.paper || 0;
  const journalWorks = countsByKind["journal-work"] || 0;

  return {
    results,
    pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) },
    counts: {
      totalPublicRecords: journals + papers + journalWorks,
      journals,
      papers,
      journalWorks,
      researchOutputs: papers + journalWorks,
    },
  };
};

module.exports = {
  GsiRegistryError,
  backfillPublishedJournal,
  buildJournalWorkRegistryEntries,
  buildPaperRegistryEntry,
  buildRegistryEntry,
  indexPaperRecord,
  indexPublishedRecord,
  listRegistryRecords,
};
