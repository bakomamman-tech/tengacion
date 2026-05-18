const express = require("express");

let rateLimit;
try {
  rateLimit = require("express-rate-limit");
} catch {
  rateLimit = () => (_req, _res, next) => next();
}

const auth = require("../middleware/auth");
const optionalAuth = require("../middleware/optionalAuth");
const requireRole = require("../middleware/requireRole");
const SponsoredPollResponse = require("../models/SponsoredPollResponse");
const { isValidPhoneNumber, normalizePhoneNumber } = require("../utils/phone");

const router = express.Router();

const POLLS = {
  "onward-baptist-childrens-day": {
    slug: "onward-baptist-childrens-day",
    title: "Onward Baptist's Children's Day Celebration",
    question: "Would you want your child to attend?",
  },
};

const voteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 12,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) =>
    req.user?.id ? `user:${req.user.id}` : rateLimit.ipKeyGenerator(req.ip || ""),
  message: { error: "Too many poll submissions. Please try again shortly." },
});

const normalizeText = (value = "", maxLength = 1600) =>
  String(value || "").trim().replace(/\s+/g, " ").slice(0, maxLength);

const normalizePollSlug = (value = "") =>
  normalizeText(value, 120).toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");

const normalizePhoneKey = (value = "") => normalizePhoneNumber(value).replace(/\D/g, "");

const getPoll = (pollSlug = "") => POLLS[normalizePollSlug(pollSlug)] || null;

const serializePoll = (poll) => ({
  slug: poll.slug,
  title: poll.title,
  question: poll.question,
});

const serializeResponse = (entry = {}) => ({
  _id: entry?._id?.toString?.() || "",
  pollSlug: entry?.pollSlug || "",
  phone: entry?.phone || "",
  vote: entry?.vote || "",
  createdAt: entry?.createdAt || null,
  updatedAt: entry?.updatedAt || null,
});

const buildStats = async (pollSlug) => {
  const rows = await SponsoredPollResponse.aggregate([
    { $match: { pollSlug } },
    { $group: { _id: "$vote", count: { $sum: 1 } } },
  ]);

  const stats = { yes: 0, no: 0, total: 0 };
  rows.forEach((row) => {
    if (row?._id === "yes" || row?._id === "no") {
      stats[row._id] = Number(row.count) || 0;
    }
  });
  stats.total = stats.yes + stats.no;
  return stats;
};

router.get("/:pollSlug", optionalAuth, async (req, res) => {
  try {
    const poll = getPoll(req.params.pollSlug);
    if (!poll) {
      return res.status(404).json({ error: "Sponsored poll not found." });
    }

    const [stats, response] = await Promise.all([
      buildStats(poll.slug),
      req.user?.id
        ? SponsoredPollResponse.findOne({
            pollSlug: poll.slug,
            parentUserId: req.user.id,
          }).lean()
        : Promise.resolve(null),
    ]);

    return res.json({
      poll: serializePoll(poll),
      stats,
      response: response ? serializeResponse(response) : null,
    });
  } catch (error) {
    console.error("Sponsored poll fetch failed:", error);
    return res.status(500).json({ error: "Failed to load sponsored poll." });
  }
});

router.post("/:pollSlug/vote", optionalAuth, voteLimiter, async (req, res) => {
  try {
    const poll = getPoll(req.params.pollSlug);
    if (!poll) {
      return res.status(404).json({ error: "Sponsored poll not found." });
    }

    const phone = normalizePhoneNumber(req.body?.phone || "");
    const normalizedPhone = normalizePhoneKey(phone);
    const vote = normalizeText(req.body?.vote || "", 12).toLowerCase();

    if (!isValidPhoneNumber(phone)) {
      return res.status(400).json({ error: "Please enter a valid parent phone number." });
    }

    if (!["yes", "no"].includes(vote)) {
      return res.status(400).json({ error: "Please choose whether your child would attend." });
    }

    const existing = await SponsoredPollResponse.findOne({
      pollSlug: poll.slug,
      normalizedPhone,
    });

    const payload = {
      pollSlug: poll.slug,
      pollTitle: poll.title,
      phone,
      normalizedPhone,
      vote,
      ...(req.user?.id ? { parentUserId: req.user.id } : {}),
    };

    let response;
    if (existing) {
      existing.set(payload);
      response = await existing.save();
    } else {
      response = await SponsoredPollResponse.create(payload);
    }

    return res.status(existing ? 200 : 201).json({
      success: true,
      created: !existing,
      poll: serializePoll(poll),
      stats: await buildStats(poll.slug),
      response: serializeResponse(response),
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({
        error: "This phone number has already voted. Please refresh to update the vote.",
      });
    }

    console.error("Sponsored poll submit failed:", error);
    return res.status(500).json({ error: "Failed to submit sponsored poll vote." });
  }
});

router.get("/:pollSlug/responses", auth, requireRole(["admin", "super_admin"]), async (req, res) => {
  try {
    const poll = getPoll(req.params.pollSlug);
    if (!poll) {
      return res.status(404).json({ error: "Sponsored poll not found." });
    }

    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 25));
    const skip = (page - 1) * limit;

    const [responses, total, stats] = await Promise.all([
      SponsoredPollResponse.find({ pollSlug: poll.slug })
        .populate("parentUserId", "_id name username email")
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      SponsoredPollResponse.countDocuments({ pollSlug: poll.slug }),
      buildStats(poll.slug),
    ]);

    return res.json({
      poll: serializePoll(poll),
      page,
      limit,
      total,
      stats,
      responses: responses.map((entry) => ({
        ...serializeResponse(entry),
        parent:
          entry?.parentUserId && typeof entry.parentUserId === "object"
            ? {
                _id: entry.parentUserId?._id?.toString?.() || "",
                name: entry.parentUserId?.name || "",
                username: entry.parentUserId?.username || "",
                email: entry.parentUserId?.email || "",
              }
            : null,
      })),
    });
  } catch (error) {
    console.error("Sponsored poll admin list failed:", error);
    return res.status(500).json({ error: "Failed to load sponsored poll responses." });
  }
});

module.exports = router;
