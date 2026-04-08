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
const TalentShowApplication = require("../models/TalentShowApplication");
const {
  TALENT_CATEGORY_VALUES,
  TALENT_APPLICATION_STATUS_VALUES,
} = require("../models/TalentShowApplication");

const router = express.Router();

const TALENT_SHOW_SLUG = "kaduna-got-talent";
const TALENT_SHOW_TITLE = "Kaduna Got Talent";
const TALENT_CATEGORY_SET = new Set(TALENT_CATEGORY_VALUES);
const TALENT_STATUS_SET = new Set(TALENT_APPLICATION_STATUS_VALUES);

const submissionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many talent show applications. Please try again later." },
});

const normalizeText = (value = "", maxLength = 1600) =>
  String(value || "").trim().replace(/\s+/g, " ").slice(0, maxLength);

const normalizeEmail = (value = "") => normalizeText(value, 160).toLowerCase();

const serializeApplication = (entry = {}) => ({
  _id: entry?._id?.toString?.() || "",
  showSlug: entry?.showSlug || TALENT_SHOW_SLUG,
  showTitle: entry?.showTitle || TALENT_SHOW_TITLE,
  applicantUserId: entry?.applicantUserId?._id?.toString?.() || entry?.applicantUserId?.toString?.() || "",
  fullName: entry?.fullName || "",
  stageName: entry?.stageName || "",
  email: entry?.email || "",
  phone: entry?.phone || "",
  gender: entry?.gender || "prefer_not_to_say",
  dateOfBirth: entry?.dateOfBirth || null,
  country: entry?.country || "",
  stateOfOrigin: entry?.stateOfOrigin || "",
  city: entry?.city || "",
  talentCategory: entry?.talentCategory || "",
  talentCategoryOther: entry?.talentCategoryOther || "",
  bio: entry?.bio || "",
  experienceLevel: entry?.experienceLevel || "",
  socialHandle: entry?.socialHandle || "",
  status: entry?.status || "submitted",
  adminNote: entry?.adminNote || "",
  reviewedAt: entry?.reviewedAt || null,
  createdAt: entry?.createdAt || null,
  updatedAt: entry?.updatedAt || null,
  applicant: entry?.applicantUserId && typeof entry.applicantUserId === "object"
    ? {
        _id: entry.applicantUserId?._id?.toString?.() || "",
        name: entry.applicantUserId?.name || "",
        username: entry.applicantUserId?.username || "",
        email: entry.applicantUserId?.email || "",
      }
    : null,
});

const parseApplicationPayload = (body = {}) => {
  const fullName = normalizeText(body?.fullName || "", 120);
  const stageName = normalizeText(body?.stageName || "", 120);
  const email = normalizeEmail(body?.email || "");
  const phone = normalizeText(body?.phone || "", 40);
  const gender = normalizeText(body?.gender || "prefer_not_to_say", 40).toLowerCase();
  const dateOfBirth = String(body?.dateOfBirth || "").trim();
  const country = normalizeText(body?.country || "", 120);
  const stateOfOrigin = normalizeText(body?.stateOfOrigin || "", 120);
  const city = normalizeText(body?.city || "", 120);
  const talentCategory = normalizeText(body?.talentCategory || "", 60).toLowerCase();
  const talentCategoryOther = normalizeText(body?.talentCategoryOther || "", 120);
  const bio = normalizeText(body?.bio || "", 1600);
  const experienceLevel = normalizeText(body?.experienceLevel || "", 120);
  const socialHandle = normalizeText(body?.socialHandle || "", 120);

  const errors = [];
  if (!fullName) {errors.push("Full name is required.");}
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {errors.push("A valid email address is required.");}
  if (!phone || phone.length < 7) {errors.push("A valid phone number is required.");}
  if (!dateOfBirth) {errors.push("Date of birth is required.");}
  if (!country) {errors.push("Country is required.");}
  if (!stateOfOrigin) {errors.push("State or region is required.");}
  if (!city) {errors.push("City is required.");}
  if (!TALENT_CATEGORY_SET.has(talentCategory)) {errors.push("Please choose a valid talent category.");}
  if (talentCategory === "other" && !talentCategoryOther) {errors.push("Tell us the talent you are applying with.");}
  if (!bio || bio.length < 40) {errors.push("Tell us more about your talent in at least 40 characters.");}

  const normalizedGender = ["male", "female", "custom", "prefer_not_to_say"].includes(gender)
    ? gender
    : "prefer_not_to_say";
  const parsedDate = dateOfBirth ? new Date(dateOfBirth) : null;
  if (!parsedDate || Number.isNaN(parsedDate.getTime())) {
    errors.push("Date of birth is not valid.");
  }

  return {
    errors,
    values: {
      showSlug: TALENT_SHOW_SLUG,
      showTitle: TALENT_SHOW_TITLE,
      fullName,
      stageName,
      email,
      normalizedEmail: email,
      phone,
      gender: normalizedGender,
      dateOfBirth: parsedDate,
      country,
      stateOfOrigin,
      city,
      talentCategory,
      talentCategoryOther,
      bio,
      experienceLevel,
      socialHandle,
      status: "submitted",
    },
  };
};

router.get(`/${TALENT_SHOW_SLUG}/application`, optionalAuth, async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.json({ application: null });
    }

    const application = await TalentShowApplication.findOne({
      showSlug: TALENT_SHOW_SLUG,
      applicantUserId: req.user.id,
    }).lean();

    return res.json({
      application: application ? serializeApplication(application) : null,
    });
  } catch (error) {
    console.error("Talent show application fetch failed:", error);
    return res.status(500).json({ error: "Failed to load your application." });
  }
});

router.post(`/${TALENT_SHOW_SLUG}/application`, submissionLimiter, optionalAuth, async (req, res) => {
  try {
    const { errors, values } = parseApplicationPayload(req.body || {});
    if (errors.length > 0) {
      return res.status(400).json({ error: errors[0], details: errors });
    }

    const applicantUserId = req.user?.id || null;
    const existing = applicantUserId
      ? await TalentShowApplication.findOne({
          showSlug: TALENT_SHOW_SLUG,
          $or: [{ applicantUserId }, { normalizedEmail: values.normalizedEmail }],
        })
      : await TalentShowApplication.findOne({
          showSlug: TALENT_SHOW_SLUG,
          normalizedEmail: values.normalizedEmail,
        });

    let application;
    const payload = {
      ...values,
      ...(applicantUserId ? { applicantUserId } : {}),
    };

    if (existing) {
      existing.set({
        ...payload,
        status: existing.status || "submitted",
      });
      application = await existing.save();
    } else {
      application = await TalentShowApplication.create(payload);
    }

    return res.status(existing ? 200 : 201).json({
      success: true,
      created: !existing,
      application: serializeApplication(application),
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({
        error: "An application already exists for this email. Please refresh and update it instead.",
      });
    }

    console.error("Talent show application submit failed:", error);
    return res.status(500).json({ error: "Failed to submit talent show application." });
  }
});

router.get(`/${TALENT_SHOW_SLUG}/applications`, auth, requireRole(["admin", "super_admin"]), async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.max(1, Math.min(50, Number(req.query.limit) || 20));
    const skip = (page - 1) * limit;
    const search = normalizeText(req.query.search || "", 120);
    const status = normalizeText(req.query.status || "", 40).toLowerCase();

    const query = {
      showSlug: TALENT_SHOW_SLUG,
    };
    if (search) {
      query.$or = [
        { fullName: { $regex: search, $options: "i" } },
        { stageName: { $regex: search, $options: "i" } },
        { normalizedEmail: { $regex: search, $options: "i" } },
        { talentCategory: { $regex: search, $options: "i" } },
        { talentCategoryOther: { $regex: search, $options: "i" } },
      ];
    }
    if (status && TALENT_STATUS_SET.has(status)) {
      query.status = status;
    }

    const [applications, total] = await Promise.all([
      TalentShowApplication.find(query)
        .populate("applicantUserId", "_id name username email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      TalentShowApplication.countDocuments(query),
    ]);

    return res.json({
      page,
      limit,
      total,
      applications: applications.map(serializeApplication),
    });
  } catch (error) {
    console.error("Talent show application admin list failed:", error);
    return res.status(500).json({ error: "Failed to load talent show applications." });
  }
});

module.exports = router;
