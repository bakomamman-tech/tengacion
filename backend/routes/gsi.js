const express = require("express");
const rateLimit = require("express-rate-limit");
const crypto = require("crypto");
const GsiPaperRecord = require("../models/GsiPaperRecord");
const {
  GsiOpenAlexError,
  importJournal,
  searchJournals,
} = require("../services/gsiOpenAlexService");
const {
  GSI_PAPER_SCORING_VERSION,
  GSI_SCORING_VERSION,
  scoreJournal,
  scorePaper,
} = require("../services/gsiScoringService");
const {
  GsiArchiveError,
  buildArchivalRecord,
  fetchArchivedRecord,
  publishRecord,
} = require("../services/gsiArchiveService");
const { GsiPaperError, normalizePaper } = require("../services/gsiPaperService");
const {
  indexPaperRecord,
  indexPublishedRecord,
  listRegistryRecords,
} = require("../services/gsiRegistryService");

const router = express.Router();
const publishLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 12,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    code: "PUBLISH_LIMIT_REACHED",
    message: "Several records were recently saved from this connection. Please try again later.",
  },
});

const cleanText = (value, maxLength) =>
  String(value || "")
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);

const normalizeEditorialReview = (value = {}) => ({
  displayName: cleanText(value.displayName, 300),
  publisher: cleanText(value.publisher, 260),
  homepageUrl: cleanText(value.homepageUrl, 700),
  countryCode: cleanText(value.countryCode, 4).toUpperCase(),
  issnL: cleanText(value.issnL, 24).toUpperCase(),
});

const normalizeCount = (value) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? Math.min(100000, Math.max(0, parsed)) : 0;
};

const normalizeEvidenceUrl = (value) => {
  const candidate = cleanText(value, 900);
  if (!candidate) return "";
  try {
    const url = new URL(candidate);
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : "";
  } catch {
    return "";
  }
};

const normalizeImpactEvidence = (value = {}) => {
  const policyMentions = normalizeCount(value.policyMentions);
  const ngoAdoptions = normalizeCount(value.ngoAdoptions);
  const localCitations = normalizeCount(value.localCitations);
  const summary = cleanText(value.summary, 700);
  const sourceUrl = normalizeEvidenceUrl(value.sourceUrl);
  const suppliedSource = cleanText(value.sourceUrl, 900);
  const hasEvidence = Boolean(
    policyMentions || ngoAdoptions || localCitations || summary || suppliedSource
  );

  if (suppliedSource && !sourceUrl) {
    throw new GsiArchiveError("Enter a valid public http or https link for the impact evidence.", {
      status: 400,
      code: "INVALID_IMPACT_EVIDENCE_URL",
    });
  }
  if (hasEvidence && !sourceUrl) {
    throw new GsiArchiveError("Add a public source before local-impact claims can affect the score.", {
      status: 400,
      code: "IMPACT_EVIDENCE_SOURCE_REQUIRED",
    });
  }
  if (hasEvidence && value.attested !== true) {
    throw new GsiArchiveError("Confirm that the local-impact evidence is accurate and publicly verifiable.", {
      status: 400,
      code: "IMPACT_EVIDENCE_ATTESTATION_REQUIRED",
    });
  }

  return {
    policyMentions,
    ngoAdoptions,
    localCitations,
    summary: summary || null,
    sourceUrl: sourceUrl || null,
    attested: hasEvidence,
    verificationStatus: hasEvidence ? "self-reported" : "not-provided",
  };
};

const sendServiceError = (res, error) => {
  if (
    error instanceof GsiOpenAlexError ||
    error instanceof GsiArchiveError ||
    error instanceof GsiPaperError
  ) {
    return res.status(error.status).json({
      success: false,
      code: error.code,
      message: error.message,
    });
  }
  console.error("[gsi] Unexpected error", error);
  return res.status(500).json({
    success: false,
    code: "GSI_UNEXPECTED_ERROR",
    message: "We could not complete that step. Please try again.",
  });
};

router.get("/status", (_req, res) => {
  res.set("Cache-Control", "no-store").json({
    success: true,
    openAlexReady: Boolean(String(process.env.OPENALEX_API_KEY || "").trim()),
    permanentArchiveReady: Boolean(String(process.env.PINATA_JWT || "").trim()),
    scoringVersion: GSI_SCORING_VERSION,
    paperScoringVersion: GSI_PAPER_SCORING_VERSION,
  });
});

router.get("/journals/search", async (req, res) => {
  try {
    const result = await searchJournals(req.query.q);
    return res.set("Cache-Control", "no-store").json({ success: true, ...result });
  } catch (error) {
    return sendServiceError(res, error);
  }
});

router.get("/journals/:sourceId/import", async (req, res) => {
  try {
    const imported = await importJournal(req.params.sourceId);
    const score = scoreJournal(imported);
    return res.set("Cache-Control", "no-store").json({
      success: true,
      ...imported,
      score,
    });
  } catch (error) {
    return sendServiceError(res, error);
  }
});

router.post("/journals/:sourceId/score", async (req, res) => {
  try {
    const imported = await importJournal(req.params.sourceId);
    const impactEvidence = normalizeImpactEvidence(req.body?.impactEvidence);
    const score = scoreJournal({ ...imported, impactEvidence });
    return res.set("Cache-Control", "no-store").json({
      success: true,
      score,
      impactEvidence,
    });
  } catch (error) {
    return sendServiceError(res, error);
  }
});

router.post("/journals/:sourceId/publish", publishLimiter, async (req, res) => {
  try {
    if (req.body?.confirmed !== true) {
      return res.status(400).json({
        success: false,
        code: "CONFIRMATION_REQUIRED",
        message: "Confirm that you reviewed the journal information before saving.",
      });
    }

    const imported = await importJournal(req.params.sourceId);
    const impactEvidence = normalizeImpactEvidence(req.body?.impactEvidence);
    const score = scoreJournal({ ...imported, impactEvidence });
    const editorialReview = normalizeEditorialReview(req.body?.editorialReview);
    const record = buildArchivalRecord({
      ...imported,
      score,
      editorialReview,
      impactEvidence,
    });
    const archive = await publishRecord(record);
    let registry;
    try {
      registry = await indexPublishedRecord(record, archive, {
        sourcePublications: imported.publications,
      });
    } catch (registryError) {
      registry = registryError?.registryStatus || {
        status: "pending",
        journalIndexed: false,
        worksIndexed: 0,
        expectedWorks: record.publications.length,
      };
      registry.message = registryError?.message
        || "The permanent record is safe, but discovery indexing is pending.";
      console.error("[gsi] Journal saved permanently but registry indexing failed", registryError);
    }
    const registryIndexed = registry.status === "indexed";
    return res.status(201).set("Cache-Control", "no-store").json({
      success: true,
      message: registryIndexed
        ? "Journal permanently published and added to Browse Research."
        : "Journal permanently published; Browse Research indexing is pending.",
      archive,
      record,
      registry,
      registryIndexed,
      ...(registryIndexed ? {} : {
        warning: "Your IPFS record is permanent and safe. Discovery indexing can be retried by CID without republishing or changing it.",
      }),
    });
  } catch (error) {
    return sendServiceError(res, error);
  }
});

router.post("/papers/score", async (req, res) => {
  try {
    const paper = normalizePaper(req.body?.paper);
    const impactEvidence = normalizeImpactEvidence(req.body?.impactEvidence);
    const score = scorePaper({ paper, impactEvidence });
    return res.set("Cache-Control", "no-store").json({
      success: true,
      paper,
      impactEvidence,
      score,
    });
  } catch (error) {
    return sendServiceError(res, error);
  }
});

router.post("/papers/publish", publishLimiter, async (req, res) => {
  try {
    if (req.body?.confirmed !== true) {
      return res.status(400).json({
        success: false,
        code: "CONFIRMATION_REQUIRED",
        message: "Confirm that the paper details may be added to the public GSI registry.",
      });
    }
    const paper = normalizePaper(req.body?.paper);
    const impactEvidence = normalizeImpactEvidence(req.body?.impactEvidence);
    const score = scorePaper({ paper, impactEvidence });
    const duplicate = paper.doi
      ? await GsiPaperRecord.findOne({ "paper.doi": paper.doi }).select("publicId").lean()
      : null;
    if (duplicate) {
      return res.status(409).json({
        success: false,
        code: "PAPER_ALREADY_INDEXED",
        message: "A paper with this DOI is already in the GSI research registry.",
        publicRecordPath: `/gsi/papers/${duplicate.publicId}`,
      });
    }
    const created = await GsiPaperRecord.create({
      publicId: crypto.randomUUID(),
      paper,
      gsiScore: score,
      impactEvidence,
      confirmedAt: new Date(),
    });
    const record = created.toObject();
    await indexPaperRecord(record);
    return res.status(201).set("Cache-Control", "no-store").json({
      success: true,
      message: "Paper successfully added to the public research registry.",
      publicRecordPath: `/gsi/papers/${record.publicId}`,
      record,
    });
  } catch (error) {
    return sendServiceError(res, error);
  }
});

router.get("/papers/:recordId", async (req, res) => {
  try {
    const recordId = String(req.params.recordId || "").trim();
    if (!/^[a-f0-9-]{36}$/i.test(recordId)) {
      throw new GsiPaperError("That paper record reference is not valid.", {
        code: "INVALID_PAPER_RECORD_ID",
      });
    }
    const record = await GsiPaperRecord.findOne({ publicId: recordId }).select("-__v -updatedAt").lean();
    if (!record) {
      throw new GsiPaperError("That paper is not available in the public GSI registry.", {
        status: 404,
        code: "PAPER_NOT_FOUND",
      });
    }
    return res.set("Cache-Control", "public, max-age=300").json({ success: true, record });
  } catch (error) {
    return sendServiceError(res, error);
  }
});

router.get("/registry", async (req, res) => {
  try {
    const registry = await listRegistryRecords(req.query);
    return res.set("Cache-Control", "public, max-age=60").json({ success: true, ...registry });
  } catch (error) {
    return sendServiceError(res, error);
  }
});

router.get("/records/:recordId", async (req, res) => {
  try {
    const archived = await fetchArchivedRecord(req.params.recordId);
    return res.set("Cache-Control", "public, max-age=300").json({ success: true, ...archived });
  } catch (error) {
    return sendServiceError(res, error);
  }
});

module.exports = router;
