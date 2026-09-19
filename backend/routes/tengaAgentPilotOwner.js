"use strict";
const crypto = require("crypto");
const express = require("express");
const rateLimit = require("express-rate-limit");
const auth = require("../middleware/auth");
const { isTengaAgentPilotMode } = require("../config/tengaAgentPilotMode");
const PilotClaim = require("../models/tengaAgent/PilotDemoOwnerClaim");
const Lead = require("../models/tengaAgent/Lead");
const Appointment = require("../models/tengaAgent/Appointment");
const { ensureCustomerZeroAgent } = require("../services/tengaAgent/customerZeroService");

const router = express.Router();
const CLAIM_KEY = "tengacion-demo";
const noStore = (_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
};
const configuredSecret = () => String(process.env.TENGAAGENT_PILOT_OWNER_CLAIM_SECRET || "");
const validSecret = (provided) => {
  const expected = configuredSecret();
  if (expected.length < 32 || expected.length > 256 ||
      typeof provided !== "string" || provided.length < 32 || provided.length > 256) {
    return false;
  }
  const digest = (value) => crypto.createHash("sha256").update(value).digest();
  return crypto.timingSafeEqual(digest(expected), digest(provided));
};
const readClaim = (query) => PilotClaim.findOne(query).lean();
const serializeLead = (lead) => ({
  id: lead._id, name: lead.name, email: lead.email, phone: lead.phone,
  company: lead.company, projectSummary: lead.projectSummary,
  status: lead.status, consentToContact: lead.consentToContact,
  createdAt: lead.createdAt, lastCapturedAt: lead.lastCapturedAt,
});
const serializeAppointment = (item) => ({
  id: item._id, name: item.name, email: item.email, phone: item.phone,
  company: item.company, purpose: item.purpose, notes: item.notes,
  preferredStartAt: item.preferredStartAt, timezone: item.timezone,
  durationMinutes: item.durationMinutes, status: item.status,
  requestedAt: item.requestedAt, consentToContact: item.consentToContact,
});

router.use((req, res, next) => {
  // Fail closed on all services except the explicitly bound Render pilot.
  if (!isTengaAgentPilotMode()) return res.status(404).json({ message: "Not found." });
  next();
});
router.use(auth, noStore);

router.get("/status", async (req, res, next) => {
  try {
    const claim = await readClaim({ key: CLAIM_KEY });
    const claimedByYou = Boolean(claim && String(claim.ownerUser) === String(req.user._id));
    return res.json({
      ok: true, claimedByYou,
      available: !claim,
      claimConfigured: configuredSecret().length >= 32 && configuredSecret().length <= 256,
    });
  } catch (error) {
    return next(error);
  }
});

const claimLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 5,
  standardHeaders: "draft-7", legacyHeaders: false,
  message: { message: "Too many owner-claim attempts. Please try again later." },
});

router.post("/claim", claimLimiter, async (req, res, next) => {
  try {
    // Authentication is not sufficient: the secret is set out of band on this pilot only.
    const existing = await readClaim({ key: CLAIM_KEY });
    if (existing) {
      return res.status(String(existing.ownerUser) === String(req.user._id) ? 200 : 409).json({
        ok: String(existing.ownerUser) === String(req.user._id),
        message: "The demo owner has already been assigned.",
      });
    }
    if (configuredSecret().length < 32 || configuredSecret().length > 256) {
      return res.status(503).json({ message: "Pilot owner claim is not configured." });
    }
    if (!validSecret(req.body && req.body.claimSecret)) {
      return res.status(403).json({ message: "Owner claim could not be verified." });
    }
    const { organization, agent } = await ensureCustomerZeroAgent();
    try {
      await PilotClaim.create({
        key: CLAIM_KEY, ownerUser: req.user._id,
        organizationId: organization._id, agentId: agent._id,
      });
    } catch (error) {
      if (error && error.code === 11000) {
        // The unique key permits exactly one owner even under simultaneous requests.
        return res.status(409).json({ message: "The demo owner has already been assigned." });
      }
      throw error;
    }
    return res.status(201).json({ ok: true, claimedByYou: true });
  } catch (error) {
    return next(error);
  }
});

const requireDemoOwner = async (req, res, next) => {
  try {
    const claim = await readClaim({ key: CLAIM_KEY, ownerUser: req.user._id });
    if (!claim) return res.status(403).json({ message: "Demo owner access is required." });
    req.demoScope = { organizationId: claim.organizationId, agentId: claim.agentId };
    next();
  } catch (error) {
    next(error);
  }
};

router.get("/leads", requireDemoOwner, async (req, res, next) => {
  try {
    const leads = await Lead.find(req.demoScope)
      .sort({ lastCapturedAt: -1, createdAt: -1 }).limit(100).lean();
    return res.json({ ok: true, leads: leads.map(serializeLead) });
  } catch (error) {
    return next(error);
  }
});

router.get("/appointments", requireDemoOwner, async (req, res, next) => {
  try {
    const appointments = await Appointment.find(req.demoScope)
      .sort({ requestedAt: -1, createdAt: -1 }).limit(100).lean();
    return res.json({ ok: true, appointments: appointments.map(serializeAppointment) });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
