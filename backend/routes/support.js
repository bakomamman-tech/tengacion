const express = require("express");

let rateLimit;
try {
  rateLimit = require("express-rate-limit");
} catch {
  rateLimit = () => (_req, _res, next) => next();
}

const auth = require("../middleware/auth");
const AdminComplaint = require("../models/AdminComplaint");
const User = require("../models/User");
const { createNotification } = require("../services/notificationService");
const { logAnalyticsEvent } = require("../services/analyticsService");
const { findPrimaryModerationAdmin } = require("../services/moderationAdminService");

const router = express.Router();

const complaintLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many complaints submitted. Please try again later." },
});

const normalizeText = (value = "", maxLength = 2000) =>
  String(value || "").trim().replace(/\s+/g, " ").slice(0, maxLength);

const normalizeCategory = (value = "") => {
  const allowed = new Set(["general", "safety", "abuse", "privacy", "bug", "account", "other"]);
  const next = String(value || "").trim().toLowerCase();
  return allowed.has(next) ? next : "general";
};

const priorityWeights = {
  low: 100,
  medium: 200,
  high: 300,
  critical: 400,
};

const derivePriority = ({ subject = "", details = "", category = "general" }) => {
  const haystack = `${subject} ${details} ${category}`.toLowerCase();
  if (/(csam|child sexual|child abuse|minor sexual|rape|threat|urgent|emergency)/i.test(haystack)) {
    return "critical";
  }
  if (/(safety|abuse|harassment|privacy|nudity|porn|gore|violent|animal cruelty)/i.test(haystack)) {
    return "high";
  }
  if (["safety", "abuse", "privacy", "account"].includes(String(category || "").toLowerCase())) {
    return "high";
  }
  if (["bug", "other"].includes(String(category || "").toLowerCase())) {
    return "medium";
  }
  return "medium";
};

const findInboxAdmin = async () => {
  const primary = await findPrimaryModerationAdmin().catch(() => null);
  if (primary?._id) {
    return primary;
  }

  return User.findOne({ role: { $in: ["admin", "super_admin", "moderator", "trust_safety_admin"] } })
    .sort({ createdAt: 1 })
    .select("_id name username email role");
};

router.post("/complaints", auth, complaintLimiter, async (req, res) => {
  try {
    const subject = normalizeText(req.body?.subject || "", 160);
    const details = normalizeText(req.body?.details || "", 2000);
    const category = normalizeCategory(req.body?.category || "general");
    const sourcePath = String(req.body?.sourcePath || "").trim().slice(0, 260);
    const sourceLabel = normalizeText(req.body?.sourceLabel || "", 120);

    if (!subject) {
      return res.status(400).json({ error: "Subject is required" });
    }
    if (!details) {
      return res.status(400).json({ error: "Complaint details are required" });
    }

    const priority = derivePriority({ subject, details, category });
    const complaint = await AdminComplaint.create({
      reporterId: req.user.id,
      subject,
      category,
      details,
      sourcePath,
      sourceLabel,
      priority,
      priorityScore: priorityWeights[priority] || priorityWeights.medium,
      status: "open",
      metadata: {
        userAgent: String(req.headers["user-agent"] || "").slice(0, 220),
      },
    });

    const inboxAdmin = await findInboxAdmin();
    if (inboxAdmin?._id) {
      await createNotification({
        recipient: inboxAdmin._id,
        sender: req.user.id,
        type: "system",
        text: `New admin complaint: ${subject}`,
        metadata: {
          previewText: details.slice(0, 120),
          link: "/admin/messages",
          dedupeKey: `admin_complaint:${complaint._id.toString()}`,
        },
      }).catch(() => null);
    }

    await logAnalyticsEvent({
      type: "support_complaint_submitted",
      userId: req.user.id,
      actorRole: req.user.role,
      targetId: complaint._id,
      targetType: "support_complaint",
      metadata: {
        category,
        priority,
        sourcePath,
      },
    }).catch(() => null);

    return res.status(201).json({ success: true, complaint });
  } catch (err) {
    console.error("Support complaint submission failed:", err);
    return res.status(500).json({ error: "Failed to submit complaint" });
  }
});

module.exports = router;
