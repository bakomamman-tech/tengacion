const express = require("express");
const rateLimit = require("express-rate-limit");
const {
  GsiOpenAlexError,
  importJournal,
  searchJournals,
} = require("../services/gsiOpenAlexService");
const { scoreJournal } = require("../services/gsiScoringService");
const {
  GsiArchiveError,
  buildArchivalRecord,
  fetchArchivedRecord,
  publishRecord,
} = require("../services/gsiArchiveService");

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

const sendServiceError = (res, error) => {
  if (error instanceof GsiOpenAlexError || error instanceof GsiArchiveError) {
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
    scoringVersion: "GSI-Archive-1.0",
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
    const score = scoreJournal(imported);
    const editorialReview = normalizeEditorialReview(req.body?.editorialReview);
    const record = buildArchivalRecord({ ...imported, score, editorialReview });
    const archive = await publishRecord(record);
    return res.status(201).set("Cache-Control", "no-store").json({
      success: true,
      message: "Journal successfully indexed.",
      archive,
      record,
    });
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
