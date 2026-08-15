const GsiRegistryRecord = require("../models/GsiRegistryRecord");

const escapeRegex = (value) => String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const buildRegistryEntry = (record, archive) => {
  const isPaper = record?.recordType === "GSI Paper Record";
  const source = isPaper ? record.paper : record.journal;
  return {
    archiveId: archive.id,
    recordKind: isPaper ? "paper" : "journal",
    title: source.displayName || source.title,
    subtitle: isPaper
      ? (source.authors || []).join(", ")
      : source.publisher || "",
    abstract: isPaper ? source.abstract : "",
    field: isPaper ? source.field : "",
    countryCode: source.countryCode || "",
    publicationYear: isPaper ? source.publicationYear : null,
    gsiScore: record.gsiScore.total,
    scoringVersion: record.gsiScore.version,
    publicRecordPath: archive.publicRecordPath,
    permanentUrl: archive.permanentUrl,
    sourceProvider: isPaper ? "Submitter" : record.provenance.provider,
    impactEvidenceStatus: record.impactEvidence?.verificationStatus || "not-provided",
    savedAt: archive.savedAt || record.createdAt,
  };
};

const buildPaperRegistryEntry = (record) => ({
  archiveId: record.publicId,
  recordKind: "paper",
  title: record.paper.title,
  subtitle: record.paper.authors.join(", "),
  abstract: record.paper.abstract,
  field: record.paper.field,
  countryCode: record.paper.countryCode,
  publicationYear: record.paper.publicationYear,
  gsiScore: record.gsiScore.total,
  scoringVersion: record.gsiScore.version,
  publicRecordPath: `/gsi/papers/${record.publicId}`,
  permanentUrl: "",
  sourceProvider: "Submitter",
  impactEvidenceStatus: record.impactEvidence?.verificationStatus || "not-provided",
  savedAt: record.createdAt || record.confirmedAt,
});

const indexPublishedRecord = async (record, archive) => {
  const entry = buildRegistryEntry(record, archive);
  await GsiRegistryRecord.updateOne(
    { archiveId: entry.archiveId },
    { $set: entry },
    { upsert: true, runValidators: true }
  );
  return entry;
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

const listRegistryRecords = async (query = {}) => {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = Math.min(24, Math.max(1, Number.parseInt(query.limit, 10) || 12));
  const filter = {};
  const type = String(query.type || "").trim().toLowerCase();
  if (["journal", "paper"].includes(type)) filter.recordKind = type;
  const country = String(query.country || "").trim().toUpperCase();
  if (/^[A-Z]{2}$/.test(country)) filter.countryCode = country;
  const field = String(query.field || "").trim();
  if (field) filter.field = { $regex: escapeRegex(field.slice(0, 160)), $options: "i" };
  const search = String(query.q || "").trim().slice(0, 180);
  if (search) {
    const pattern = { $regex: escapeRegex(search), $options: "i" };
    filter.$or = [{ title: pattern }, { subtitle: pattern }, { abstract: pattern }, { field: pattern }];
  }

  const [results, total] = await Promise.all([
    GsiRegistryRecord.find(filter)
      .sort({ savedAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select("-__v -updatedAt")
      .lean(),
    GsiRegistryRecord.countDocuments(filter),
  ]);

  return {
    results,
    pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) },
  };
};

module.exports = {
  buildPaperRegistryEntry,
  buildRegistryEntry,
  indexPaperRecord,
  indexPublishedRecord,
  listRegistryRecords,
};
