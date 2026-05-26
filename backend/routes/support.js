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

const publicReportLimiter = rateLimit({
  windowMs: 30 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many reports submitted. Please try again later." },
});

const COMPLAINT_CATEGORIES = new Set([
  "general",
  "safety",
  "abuse",
  "privacy",
  "copyright",
  "child_safety",
  "bug",
  "account",
  "other",
]);

const normalizeText = (value = "", maxLength = 2000) =>
  String(value || "").trim().replace(/\s+/g, " ").slice(0, maxLength);

const normalizeCategory = (value = "") => {
  const next = String(value || "").trim().toLowerCase();
  return COMPLAINT_CATEGORIES.has(next) ? next : "general";
};

const normalizeEmail = (value = "") => String(value || "").trim().toLowerCase().slice(0, 160);

const isValidEmail = (value = "") => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || ""));

const normalizeSupportFlow = (value = "") => {
  const allowed = new Set([
    "creator_onboarding",
    "creator_payouts",
    "creator_uploads",
    "creator_verification",
    "creator_catalog",
  ]);
  const next = String(value || "").trim().toLowerCase();
  return allowed.has(next) ? next : "";
};

const priorityWeights = {
  low: 100,
  medium: 200,
  high: 300,
  critical: 400,
};

const derivePriority = ({ subject = "", details = "", category = "general" }) => {
  const haystack = `${subject} ${details} ${category}`.toLowerCase();
  if (String(category || "").toLowerCase() === "child_safety") {
    return "critical";
  }
  if (/(csam|child sexual|child abuse|minor sexual|rape|threat|urgent|emergency)/i.test(haystack)) {
    return "critical";
  }
  if (/(safety|abuse|harassment|privacy|nudity|porn|gore|violent|animal cruelty)/i.test(haystack)) {
    return "high";
  }
  if (["safety", "abuse", "privacy", "copyright", "child_safety", "account"].includes(String(category || "").toLowerCase())) {
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

const notifyInboxAdmin = async ({ complaint, senderId, subject, details }) => {
  if (!senderId) {
    return;
  }

  const inboxAdmin = await findInboxAdmin();
  if (inboxAdmin?._id) {
    await createNotification({
      recipient: inboxAdmin._id,
      sender: senderId,
      type: "system",
      text: `New admin complaint: ${subject}`,
      metadata: {
        previewText: details.slice(0, 120),
        link: "/admin/messages",
        dedupeKey: `admin_complaint:${complaint._id.toString()}`,
      },
    }).catch(() => null);
  }
};

router.post("/complaints", auth, complaintLimiter, async (req, res) => {
  try {
    const subject = normalizeText(req.body?.subject || "", 160);
    const details = normalizeText(req.body?.details || "", 2000);
    const category = normalizeCategory(req.body?.category || "general");
    const sourcePath = String(req.body?.sourcePath || "").trim().slice(0, 260);
    const sourceLabel = normalizeText(req.body?.sourceLabel || "", 120);
    const supportFlow = normalizeSupportFlow(req.body?.supportFlow || "");

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
        supportFlow,
      },
    });

    await notifyInboxAdmin({ complaint, senderId: req.user.id, subject, details });

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
        supportFlow,
      },
    }).catch(() => null);

    return res.status(201).json({ success: true, complaint });
  } catch (err) {
    console.error("Support complaint submission failed:", err);
    return res.status(500).json({ error: "Failed to submit complaint" });
  }
});

router.post("/public-reports", publicReportLimiter, async (req, res) => {
  try {
    const honeypot = normalizeText(req.body?.website || "", 120);
    if (honeypot) {
      return res.status(201).json({ success: true });
    }

    const reporterName = normalizeText(req.body?.name || "", 120);
    const reporterEmail = normalizeEmail(req.body?.email || "");
    const category = normalizeCategory(req.body?.category || "copyright");
    const subject = normalizeText(req.body?.subject || "", 160);
    const details = normalizeText(req.body?.details || "", 2000);
    const sourceUrl = normalizeText(req.body?.sourceUrl || "", 260);
    const rightsOwner = normalizeText(req.body?.rightsOwner || "", 160);
    const workTitle = normalizeText(req.body?.workTitle || "", 160);

    if (!reporterName) {
      return res.status(400).json({ error: "Name is required" });
    }
    if (!isValidEmail(reporterEmail)) {
      return res.status(400).json({ error: "A valid email is required" });
    }
    if (!subject) {
      return res.status(400).json({ error: "Subject is required" });
    }
    if (!details) {
      return res.status(400).json({ error: "Report details are required" });
    }

    const priority = derivePriority({ subject, details, category });
    const complaint = await AdminComplaint.create({
      reporterId: null,
      subject,
      category,
      details,
      sourcePath: sourceUrl,
      sourceLabel: "Public report form",
      priority,
      priorityScore: priorityWeights[priority] || priorityWeights.medium,
      status: "open",
      metadata: {
        publicReport: true,
        reporterName,
        reporterEmail,
        sourceUrl,
        rightsOwner,
        workTitle,
        userAgent: String(req.headers["user-agent"] || "").slice(0, 220),
      },
    });

    await logAnalyticsEvent({
      type: "support_public_report_submitted",
      userId: null,
      actorRole: "public",
      targetId: complaint._id,
      targetType: "support_complaint",
      metadata: {
        category,
        priority,
        hasSourceUrl: Boolean(sourceUrl),
      },
    }).catch(() => null);

    return res.status(201).json({ success: true, reportId: complaint._id });
  } catch (err) {
    console.error("Public report submission failed:", err);
    return res.status(500).json({ error: "Failed to submit report" });
  }
});

module.exports = router;
