const crypto = require("crypto");

const PINATA_PIN_JSON_URL = "https://api.pinata.cloud/pinning/pinJSONToIPFS";
const IPFS_GATEWAYS = ["https://ipfs.io/ipfs", "https://gateway.pinata.cloud/ipfs"];
const MAX_RECORD_BYTES = 95000;

class GsiArchiveError extends Error {
  constructor(message, { status = 502, code = "ARCHIVE_UNAVAILABLE" } = {}) {
    super(message);
    this.name = "GsiArchiveError";
    this.status = status;
    this.code = code;
  }
}

const canonicalize = (value) => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.keys(value)
      .sort()
      .reduce((output, key) => {
        if (value[key] !== undefined) output[key] = canonicalize(value[key]);
        return output;
      }, {});
  }
  return value;
};

const serializeRecord = (record) => JSON.stringify(canonicalize(record));

const buildArchivalRecord = ({ source, publications, importSummary, score, editorialReview }) => {
  const compactPublications = (Array.isArray(publications) ? publications : []).map((work) => ({
    id: work.id,
    doi: work.doi || null,
    title: work.title,
    publicationDate: work.publicationDate || null,
    publicationYear: work.publicationYear || null,
    type: work.type,
    language: work.language || null,
    citedByCount: work.citedByCount,
    isOpenAccess: work.isOpenAccess,
    hasAbstract: work.hasAbstract,
    authors: (work.authors || []).map((author) => ({
      id: author.id || null,
      displayName: author.displayName,
      institutions: (author.institutions || []).map((institution) => ({
        id: institution.id || null,
        displayName: institution.displayName,
        countryCode: institution.countryCode || null,
      })),
    })),
    topics: (work.topics || []).map((topic) => topic.displayName).filter(Boolean),
  }));

  const record = {
    schema: "https://tengacion.com/schemas/gsi-journal-record/v1",
    recordType: "GSI Journal Onboarding Record",
    createdAt: new Date().toISOString(),
    createdBy: "TEAM ARCHIVE — GSI Buildathon 2026",
    journal: {
      openAlexId: source.id,
      openAlexUrl: source.openAlexUrl,
      displayName: editorialReview.displayName || source.displayName,
      publisher: editorialReview.publisher || source.publisher || null,
      homepageUrl: editorialReview.homepageUrl || source.homepageUrl || null,
      countryCode: editorialReview.countryCode || source.countryCode || null,
      issnL: editorialReview.issnL || source.issnL || null,
      issns: source.issns || [],
      worksCount: source.worksCount,
      citedByCount: source.citedByCount,
      isOpenAccess: source.isOpenAccess,
      isInDoaj: source.isInDoaj,
    },
    provenance: {
      provider: "OpenAlex",
      importedAt: importSummary.importedAt,
      totalWorks: importSummary.totalWorks,
      reviewedWorks: importSummary.reviewedWorks,
      isSample: importSummary.isSample,
      editorConfirmedAt: new Date().toISOString(),
    },
    gsiScore: score,
    publications: compactPublications,
  };

  while (Buffer.byteLength(serializeRecord(record), "utf8") > MAX_RECORD_BYTES) {
    if (record.publications.length <= 1) {
      throw new GsiArchiveError(
        "This record is too large to save safely. Please contact the indexing team.",
        { status: 413, code: "RECORD_TOO_LARGE" }
      );
    }
    record.publications.pop();
  }

  record.provenance.archivedPublications = record.publications.length;
  return canonicalize(record);
};

const publishRecord = async (record) => {
  const json = serializeRecord(record);
  const digest = crypto.createHash("sha256").update(json).digest("hex");
  const jwt = String(process.env.PINATA_JWT || "").trim();
  if (!jwt) {
    throw new GsiArchiveError(
      "Permanent record storage is being configured. Please try again shortly.",
      { status: 503, code: "ARCHIVE_NOT_CONFIGURED" }
    );
  }

  try {
    const response = await fetch(PINATA_PIN_JSON_URL, {
      method: "POST",
      signal: AbortSignal.timeout(45000),
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${jwt}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        pinataOptions: { cidVersion: 1 },
        pinataMetadata: {
          name: `gsi-journal-${record.journal.openAlexId}-${digest.slice(0, 12)}.json`,
          keyvalues: {
            app: "Tengacion-GSI-Team-Archive",
            recordType: "GSI-Journal-Onboarding",
            openAlexSource: record.journal.openAlexId,
            contentSha256: digest,
          },
        },
        pinataContent: record,
      }),
    });
    if (response.status === 401 || response.status === 403) {
      throw new GsiArchiveError("Permanent record storage is temporarily unavailable.", {
        status: 503,
        code: "ARCHIVE_ACCESS_DENIED",
      });
    }
    if (!response.ok) throw new Error(`Archive service returned ${response.status}`);
    const result = await response.json();
    const cid = String(result?.IpfsHash || "").trim();
    if (!cid) throw new Error("Archive service returned no record identifier");
    return {
      id: cid,
      contentHash: `sha256:${digest}`,
      permanentUrl: `${IPFS_GATEWAYS[0]}/${cid}`,
      publicRecordPath: `/gsi/records/${cid}`,
      savedAt: result.Timestamp || record.createdAt,
      archivedPublications: record.provenance.archivedPublications,
    };
  } catch (error) {
    if (error instanceof GsiArchiveError) throw error;
    const isTimeout = error?.name === "TimeoutError" || error?.name === "AbortError";
    throw new GsiArchiveError(
      isTimeout
        ? "The permanent archive took too long to confirm. Please try once more."
        : "The permanent archive could not confirm this record. Nothing was published; please try again.",
      { status: isTimeout ? 504 : 502, code: isTimeout ? "ARCHIVE_TIMEOUT" : "ARCHIVE_UNAVAILABLE" }
    );
  }
};

const fetchArchivedRecord = async (recordId) => {
  const id = String(recordId || "").trim();
  if (!/^[a-zA-Z0-9]{46,100}$/.test(id)) {
    throw new GsiArchiveError("That permanent record reference is not valid.", {
      status: 400,
      code: "INVALID_RECORD_ID",
    });
  }

  for (const gateway of IPFS_GATEWAYS) {
    try {
      const response = await fetch(`${gateway}/${id}`, {
        signal: AbortSignal.timeout(15000),
        headers: { Accept: "application/json" },
      });
      if (!response.ok) continue;
      const raw = await response.text();
      if (Buffer.byteLength(raw, "utf8") > 200000) throw new Error("Archived record exceeded size limit");
      const record = JSON.parse(raw);
      if (record?.recordType !== "GSI Journal Onboarding Record") {
        throw new GsiArchiveError("This reference is not a GSI journal record.", {
          status: 422,
          code: "INVALID_RECORD",
        });
      }
      const contentHash = `sha256:${crypto.createHash("sha256").update(raw).digest("hex")}`;
      return { id, contentHash, permanentUrl: `${gateway}/${id}`, record };
    } catch (error) {
      if (error instanceof GsiArchiveError) throw error;
    }
  }
  throw new GsiArchiveError(
    "This record is still being confirmed or its public gateways are temporarily unavailable. Please try again shortly.",
    { status: 404, code: "RECORD_PENDING" }
  );
};

module.exports = {
  GsiArchiveError,
  buildArchivalRecord,
  canonicalize,
  fetchArchivedRecord,
  publishRecord,
  serializeRecord,
};
