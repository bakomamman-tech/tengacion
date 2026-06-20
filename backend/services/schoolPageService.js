const mongoose = require("mongoose");

const SchoolInquiry = require("../models/SchoolInquiry");
const SchoolPage = require("../models/SchoolPage");
const { getFallbackSchoolPageBySlug } = require("../data/schoolPageFallbacks");
const sendSecurityEmail = require("../utils/sendSecurityEmail");
const { getEmailSettings, isEmailConfigured } = require("../utils/emailSettings");
const { generateUniqueSlug, slugifyValue } = require("../utils/slug");

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ADMIN_ROLES = new Set(["admin", "super_admin"]);
const GALLERY_LIMIT = 12;
const ANNOUNCEMENT_LIMIT = 12;
const STAFF_LIMIT = 16;
const FACILITY_LIMIT = 12;
const TESTIMONIAL_LIMIT = 8;
const HIGHLIGHT_LIMIT = 8;
const VALUE_LIMIT = 8;

const DEFAULT_THEME_COLORS = {
  primary: "#050505",
  accent: "#f2c94c",
  emphasis: "#c9302c",
  growth: "#1f8f4d",
};

const createServiceError = (message, status = 400, details = null) => {
  const error = new Error(message);
  error.status = status;
  if (details) {
    error.details = details;
  }
  return error;
};

const toText = (value = "", maxLength = 240) =>
  String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maxLength);

const toLongText = (value = "", maxLength = 1200) =>
  String(value || "")
    .trim()
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .slice(0, maxLength);

const normalizeEmail = (value = "") => toText(value, 160).toLowerCase();

const escapeHtml = (value = "") =>
  String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const toIdString = (value) => {
  if (!value) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  if (value._id) {
    return value._id.toString();
  }
  return value.toString();
};

const isAdminUser = (user = {}) => ADMIN_ROLES.has(String(user?.role || "").toLowerCase());

const normalizeList = (value = [], maxItems = 8, maxLength = 160) =>
  (Array.isArray(value) ? value : [])
    .map((entry) => toText(entry, maxLength))
    .filter(Boolean)
    .slice(0, maxItems);

const normalizeNumber = (value = 0) => {
  const number = Number(value || 0);
  return Number.isFinite(number) && number > 0 ? Math.round(number) : 0;
};

const normalizeUrl = (value = "") => toText(value, 600);

const normalizeHighlights = (value = [], limit = HIGHLIGHT_LIMIT) =>
  (Array.isArray(value) ? value : [])
    .map((entry) => ({
      label: toText(entry?.label || entry?.title || "", 120),
      description: toText(entry?.description || entry?.copy || "", 360),
    }))
    .filter((entry) => entry.label)
    .slice(0, limit);

const normalizeAnnouncement = (entry = {}) => ({
  title: toText(entry.title, 160),
  date: (() => {
    if (!entry.date) {
      return null;
    }
    const date = new Date(entry.date);
    return Number.isNaN(date.getTime()) ? null : date;
  })(),
  description: toText(entry.description, 700),
  imageUrl: normalizeUrl(entry.imageUrl || entry.image),
});

const normalizeAnnouncements = (value = []) =>
  (Array.isArray(value) ? value : [])
    .map(normalizeAnnouncement)
    .filter((entry) => entry.title)
    .slice(0, ANNOUNCEMENT_LIMIT);

const normalizeGalleryImages = (value = []) =>
  (Array.isArray(value) ? value : [])
    .map((entry) => ({
      url: normalizeUrl(entry?.url || entry?.imageUrl || entry),
      alt: toText(entry?.alt || entry?.caption || "", 180),
      caption: toText(entry?.caption || "", 220),
    }))
    .filter((entry) => entry.url)
    .slice(0, GALLERY_LIMIT);

const normalizeStaffDepartments = (value = []) =>
  (Array.isArray(value) ? value : [])
    .map((entry) => ({
      name: toText(entry?.name, 140),
      role: toText(entry?.role || entry?.title, 140),
      photoUrl: normalizeUrl(entry?.photoUrl || entry?.imageUrl || entry?.photo),
      department: toText(entry?.department, 120),
      description: toText(entry?.description, 500),
    }))
    .filter((entry) => entry.name || entry.department)
    .slice(0, STAFF_LIMIT);

const normalizeFacilities = (value = []) =>
  (Array.isArray(value) ? value : [])
    .map((entry) => ({
      title: toText(entry?.title || entry?.name, 140),
      description: toText(entry?.description, 500),
      imageUrl: normalizeUrl(entry?.imageUrl || entry?.photoUrl || entry?.image),
    }))
    .filter((entry) => entry.title)
    .slice(0, FACILITY_LIMIT);

const normalizeTestimonials = (value = []) =>
  (Array.isArray(value) ? value : [])
    .map((entry) => ({
      name: toText(entry?.name, 140),
      role: toText(entry?.role, 120),
      quote: toText(entry?.quote || entry?.message, 700),
      photoUrl: normalizeUrl(entry?.photoUrl || entry?.imageUrl || entry?.photo),
    }))
    .filter((entry) => entry.name && entry.quote)
    .slice(0, TESTIMONIAL_LIMIT);

const normalizeThemeColors = (value = {}) => ({
  primary: toText(value?.primary, 32) || DEFAULT_THEME_COLORS.primary,
  accent: toText(value?.accent || value?.yellow, 32) || DEFAULT_THEME_COLORS.accent,
  emphasis: toText(value?.emphasis || value?.red, 32) || DEFAULT_THEME_COLORS.emphasis,
  growth: toText(value?.growth || value?.green, 32) || DEFAULT_THEME_COLORS.growth,
});

const normalizeAdmissionInfo = (value = {}) => ({
  status: toText(value?.status, 120),
  requirements: normalizeList(value?.requirements, 12, 220),
  availableClasses: normalizeList(value?.availableClasses || value?.classes, 18, 120),
  feesNote: toText(value?.feesNote || value?.fees, 360),
  procedure: normalizeList(value?.procedure || value?.steps, 12, 260),
});

const normalizeStatistics = (value = {}) => ({
  students: normalizeNumber(value?.students),
  teachers: normalizeNumber(value?.teachers),
  yearsOfExcellence: normalizeNumber(value?.yearsOfExcellence || value?.years),
  departments: normalizeNumber(value?.departments),
});

const buildSchoolPayload = (payload = {}) => ({
  schoolName: toText(payload.schoolName || payload.name, 180),
  logoUrl: normalizeUrl(payload.logoUrl),
  coverImageUrl: normalizeUrl(payload.coverImageUrl),
  ogImageUrl: normalizeUrl(payload.ogImageUrl),
  motto: toText(payload.motto || payload.slogan, 180),
  about: toLongText(payload.about, 2400),
  mission: toLongText(payload.mission, 900),
  vision: toLongText(payload.vision, 900),
  values: normalizeList(payload.values, VALUE_LIMIT, 120),
  foundingYear: normalizeNumber(payload.foundingYear),
  schoolCategory: toText(payload.schoolCategory || payload.category, 140),
  highlights: normalizeHighlights(payload.highlights),
  principalMessage: toLongText(payload.principalMessage, 1400),
  principalName: toText(payload.principalName, 140),
  principalTitle: toText(payload.principalTitle || payload.principalRole, 120),
  principalPhotoUrl: normalizeUrl(payload.principalPhotoUrl),
  contactEmail: normalizeEmail(payload.contactEmail),
  contactPhone: toText(payload.contactPhone || payload.phone, 60),
  whatsappNumber: toText(payload.whatsappNumber || payload.whatsapp, 60),
  address: toText(payload.address, 500),
  officeHours: toText(payload.officeHours, 180),
  mapUrl: normalizeUrl(payload.mapUrl),
  directionsUrl: normalizeUrl(payload.directionsUrl),
  admissionInfo: normalizeAdmissionInfo(payload.admissionInfo),
  announcements: normalizeAnnouncements(payload.announcements),
  galleryImages: normalizeGalleryImages(payload.galleryImages),
  staffDepartments: normalizeStaffDepartments(payload.staffDepartments),
  facilities: normalizeFacilities(payload.facilities),
  testimonials: normalizeTestimonials(payload.testimonials),
  whyChooseUs: normalizeHighlights(payload.whyChooseUs),
  statistics: normalizeStatistics(payload.statistics),
  themeColors: normalizeThemeColors(payload.themeColors),
  isPublished: payload.isPublished === undefined ? true : Boolean(payload.isPublished),
});

const validateSchoolPayload = (payload = {}) => {
  const errors = [];
  if (!payload.schoolName) {
    errors.push("School name is required.");
  }
  if (payload.contactEmail && !EMAIL_PATTERN.test(payload.contactEmail)) {
    errors.push("A valid school contact email is required.");
  }
  if (payload.foundingYear && (payload.foundingYear < 1800 || payload.foundingYear > 9999)) {
    errors.push("Founding year must be a valid year.");
  }
  return errors;
};

const findSchoolPageForManagement = async (idOrSlug = "") => {
  const raw = String(idOrSlug || "").trim();
  if (!raw) {
    return null;
  }
  const lookup = mongoose.Types.ObjectId.isValid(raw)
    ? { _id: raw }
    : { slug: raw.toLowerCase() };
  return SchoolPage.findOne(lookup);
};

const assertCanManageSchoolPage = (school, user = {}) => {
  if (!school) {
    throw createServiceError("School page not found", 404);
  }
  if (isAdminUser(user)) {
    return;
  }
  if (toIdString(school.owner) && toIdString(school.owner) === toIdString(user?.id || user?._id)) {
    return;
  }
  throw createServiceError("You do not have permission to manage this school page", 403);
};

const serializeSchoolPage = (school = {}) => {
  const doc = typeof school.toObject === "function" ? school.toObject() : school;
  return {
    _id: toIdString(doc._id),
    owner: toIdString(doc.owner),
    schoolName: doc.schoolName || "",
    slug: doc.slug || "",
    logoUrl: doc.logoUrl || "",
    coverImageUrl: doc.coverImageUrl || "",
    ogImageUrl: doc.ogImageUrl || "",
    motto: doc.motto || "",
    about: doc.about || "",
    mission: doc.mission || "",
    vision: doc.vision || "",
    values: Array.isArray(doc.values) ? doc.values : [],
    foundingYear: Number(doc.foundingYear || 0),
    schoolCategory: doc.schoolCategory || "",
    highlights: Array.isArray(doc.highlights) ? doc.highlights : [],
    principalMessage: doc.principalMessage || "",
    principalName: doc.principalName || "",
    principalTitle: doc.principalTitle || "",
    principalPhotoUrl: doc.principalPhotoUrl || "",
    contactEmail: doc.contactEmail || "",
    contactPhone: doc.contactPhone || "",
    whatsappNumber: doc.whatsappNumber || "",
    address: doc.address || "",
    officeHours: doc.officeHours || "",
    mapUrl: doc.mapUrl || "",
    directionsUrl: doc.directionsUrl || "",
    admissionInfo: doc.admissionInfo || {},
    announcements: Array.isArray(doc.announcements) ? doc.announcements : [],
    galleryImages: Array.isArray(doc.galleryImages) ? doc.galleryImages : [],
    staffDepartments: Array.isArray(doc.staffDepartments) ? doc.staffDepartments : [],
    facilities: Array.isArray(doc.facilities) ? doc.facilities : [],
    testimonials: Array.isArray(doc.testimonials) ? doc.testimonials : [],
    whyChooseUs: Array.isArray(doc.whyChooseUs) ? doc.whyChooseUs : [],
    statistics: doc.statistics || {},
    themeColors: { ...DEFAULT_THEME_COLORS, ...(doc.themeColors || {}) },
    isPublished: Boolean(doc.isPublished),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
};

const serializePublicSchoolPage = (school = {}) => {
  const page = serializeSchoolPage(school);
  delete page.owner;
  return page;
};

const createSchoolPage = async ({ user, payload = {} } = {}) => {
  const normalized = buildSchoolPayload(payload);
  const errors = validateSchoolPayload(normalized);
  if (errors.length) {
    throw createServiceError("School page validation failed", 400, errors);
  }

  const desiredSlug = toText(payload.slug, 120) || normalized.schoolName;
  const slug = await generateUniqueSlug(SchoolPage, desiredSlug, {
    fallback: "school",
  });
  const owner =
    isAdminUser(user) && mongoose.Types.ObjectId.isValid(payload.owner)
      ? payload.owner
      : user?.id || user?._id || null;

  const school = await SchoolPage.create({
    ...normalized,
    owner,
    slug,
  });

  return serializeSchoolPage(school);
};

const listSchoolPages = async ({ user, page = 1, limit = 20, search = "" } = {}) => {
  const safePage = Math.max(Number(page || 1), 1);
  const safeLimit = Math.min(Math.max(Number(limit || 20), 1), 50);
  const query = {};
  const normalizedSearch = toText(search, 120);

  if (!isAdminUser(user)) {
    query.owner = user?.id || user?._id || null;
  }
  if (normalizedSearch) {
    query.$or = [
      { schoolName: { $regex: normalizedSearch, $options: "i" } },
      { slug: { $regex: slugifyValue(normalizedSearch, normalizedSearch), $options: "i" } },
      { address: { $regex: normalizedSearch, $options: "i" } },
    ];
  }

  const [schools, total] = await Promise.all([
    SchoolPage.find(query)
      .sort({ updatedAt: -1, createdAt: -1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit)
      .lean(),
    SchoolPage.countDocuments(query),
  ]);

  return {
    schools: schools.map(serializeSchoolPage),
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      pages: Math.ceil(total / safeLimit),
    },
  };
};

const getManagedSchoolPage = async ({ user, idOrSlug = "" } = {}) => {
  const school = await findSchoolPageForManagement(idOrSlug);
  assertCanManageSchoolPage(school, user);
  return serializeSchoolPage(school);
};

const updateSchoolPage = async ({ user, idOrSlug = "", payload = {} } = {}) => {
  const school = await findSchoolPageForManagement(idOrSlug);
  assertCanManageSchoolPage(school, user);

  const current = serializeSchoolPage(school);
  const mergedPayload = {
    ...current,
    ...payload,
    admissionInfo: {
      ...(current.admissionInfo || {}),
      ...(payload.admissionInfo || {}),
    },
    statistics: {
      ...(current.statistics || {}),
      ...(payload.statistics || {}),
    },
    themeColors: {
      ...(current.themeColors || {}),
      ...(payload.themeColors || {}),
    },
  };
  const normalized = buildSchoolPayload(mergedPayload);
  const errors = validateSchoolPayload(normalized);
  if (errors.length) {
    throw createServiceError("School page validation failed", 400, errors);
  }

  Object.assign(school, normalized);
  if (payload.slug) {
    school.slug = await generateUniqueSlug(SchoolPage, payload.slug, {
      ignoreId: school._id,
      fallback: "school",
    });
  }
  if (payload.owner && isAdminUser(user) && mongoose.Types.ObjectId.isValid(payload.owner)) {
    school.owner = payload.owner;
  }

  await school.save();
  return serializeSchoolPage(school);
};

const publishSchoolPage = async ({ user, idOrSlug = "", isPublished = true } = {}) => {
  const school = await findSchoolPageForManagement(idOrSlug);
  assertCanManageSchoolPage(school, user);
  school.isPublished = Boolean(isPublished);
  await school.save();
  return serializeSchoolPage(school);
};

const getPublicSchoolPage = async (slug = "") => {
  const normalizedSlug = slugifyValue(slug, "");
  if (!normalizedSlug) {
    throw createServiceError("School slug is required", 400);
  }

  const school = await SchoolPage.findOne({
    slug: normalizedSlug,
    isPublished: true,
  }).lean();

  if (!school) {
    const fallbackSchool = getFallbackSchoolPageBySlug(normalizedSlug);
    if (fallbackSchool) {
      return serializePublicSchoolPage(fallbackSchool);
    }
    throw createServiceError("School page not found", 404);
  }

  return serializePublicSchoolPage(school);
};

const buildInquiryEmailHtml = ({ school = {}, inquiry = {} } = {}) => `
  <div style="font-family:Arial,sans-serif;line-height:1.6;color:#1f2937;padding:16px;">
    <h2 style="margin:0 0 12px;">New admission inquiry</h2>
    <p><strong>School:</strong> ${escapeHtml(school.schoolName || "")}</p>
    <p><strong>Parent/guardian:</strong> ${escapeHtml(inquiry.parentName || "")}</p>
    <p><strong>Phone:</strong> ${escapeHtml(inquiry.phoneNumber || "")}</p>
    <p><strong>Email:</strong> ${escapeHtml(inquiry.email || "")}</p>
    <p><strong>Class of interest:</strong> ${escapeHtml(inquiry.childClassInterest || "")}</p>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0;" />
    <p>${escapeHtml(inquiry.message || "")}</p>
  </div>
`;

const submitSchoolInquiry = async ({ slug = "", payload = {}, req = null } = {}) => {
  const school = await getPublicSchoolPage(slug);
  const values = {
    parentName: toText(payload.parentName || payload.name, 140),
    phoneNumber: toText(payload.phoneNumber || payload.phone, 60),
    email: normalizeEmail(payload.email),
    childClassInterest: toText(payload.childClassInterest || payload.classOfInterest, 120),
    message: toLongText(payload.message, 1200),
  };
  const errors = [];

  if (!values.parentName) {
    errors.push("Parent or guardian name is required.");
  }
  if (!values.phoneNumber) {
    errors.push("Phone number is required.");
  }
  if (!values.email || !EMAIL_PATTERN.test(values.email)) {
    errors.push("A valid email is required.");
  }
  if (!values.childClassInterest) {
    errors.push("Child class of interest is required.");
  }
  if (!values.message) {
    errors.push("Message is required.");
  }
  if (errors.length) {
    throw createServiceError("School inquiry validation failed", 400, errors);
  }

  const inquiry = await SchoolInquiry.create({
    school: school._id,
    schoolSlug: school.slug,
    schoolName: school.schoolName,
    ...values,
    metadata: {
      ip: toText(req?.ip || req?.headers?.["x-forwarded-for"] || "", 120),
      userAgent: toText(req?.headers?.["user-agent"] || "", 260),
      sourcePath: toText(payload.sourcePath || req?.originalUrl || "", 260),
    },
  });

  let emailStatus = "not_configured";
  if (!isEmailConfigured()) {
    emailStatus = "not_configured";
  } else if (!school.contactEmail) {
    emailStatus = "missing_school_email";
  } else {
    try {
      const settings = getEmailSettings();
      await sendSecurityEmail({
        to: school.contactEmail,
        subject: `Admission inquiry: ${school.schoolName}`,
        html: buildInquiryEmailHtml({ school, inquiry }),
      });
      if (settings.adminNotificationEmail && settings.adminNotificationEmail !== school.contactEmail) {
        await sendSecurityEmail({
          to: settings.adminNotificationEmail,
          subject: `School inquiry copy: ${school.schoolName}`,
          html: buildInquiryEmailHtml({ school, inquiry }),
        }).catch(() => null);
      }
      emailStatus = "sent";
    } catch {
      emailStatus = "failed";
    }
  }

  inquiry.emailStatus = emailStatus;
  await inquiry.save();

  return {
    success: true,
    inquiryId: inquiry._id,
    emailStatus,
  };
};

const serializeInquiry = (inquiry = {}) => {
  const doc = typeof inquiry.toObject === "function" ? inquiry.toObject() : inquiry;
  return {
    _id: toIdString(doc._id),
    school: toIdString(doc.school),
    schoolSlug: doc.schoolSlug || "",
    schoolName: doc.schoolName || "",
    parentName: doc.parentName || "",
    phoneNumber: doc.phoneNumber || "",
    email: doc.email || "",
    childClassInterest: doc.childClassInterest || "",
    message: doc.message || "",
    status: doc.status || "new",
    emailStatus: doc.emailStatus || "not_configured",
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
};

const listSchoolInquiries = async ({ user, idOrSlug = "", page = 1, limit = 20 } = {}) => {
  const school = await findSchoolPageForManagement(idOrSlug);
  assertCanManageSchoolPage(school, user);

  const safePage = Math.max(Number(page || 1), 1);
  const safeLimit = Math.min(Math.max(Number(limit || 20), 1), 50);
  const query = { school: school._id };
  const [inquiries, total] = await Promise.all([
    SchoolInquiry.find(query)
      .sort({ createdAt: -1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit)
      .lean(),
    SchoolInquiry.countDocuments(query),
  ]);

  return {
    school: serializeSchoolPage(school),
    inquiries: inquiries.map(serializeInquiry),
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      pages: Math.ceil(total / safeLimit),
    },
  };
};

const updateSchoolInquiryStatus = async ({ user, idOrSlug = "", inquiryId = "", status = "" } = {}) => {
  const allowed = new Set(["new", "reviewed", "contacted", "closed"]);
  const normalizedStatus = String(status || "").trim().toLowerCase();
  if (!allowed.has(normalizedStatus)) {
    throw createServiceError("Invalid inquiry status", 400);
  }

  const school = await findSchoolPageForManagement(idOrSlug);
  assertCanManageSchoolPage(school, user);

  const inquiry = await SchoolInquiry.findOne({
    _id: inquiryId,
    school: school._id,
  });
  if (!inquiry) {
    throw createServiceError("School inquiry not found", 404);
  }

  inquiry.status = normalizedStatus;
  await inquiry.save();
  return serializeInquiry(inquiry);
};

module.exports = {
  createSchoolPage,
  getManagedSchoolPage,
  getPublicSchoolPage,
  listSchoolInquiries,
  listSchoolPages,
  publishSchoolPage,
  serializePublicSchoolPage,
  submitSchoolInquiry,
  updateSchoolInquiryStatus,
  updateSchoolPage,
};
