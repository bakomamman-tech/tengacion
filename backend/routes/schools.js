const express = require("express");

let rateLimit;
try {
  rateLimit = require("express-rate-limit");
} catch {
  rateLimit = () => (_req, _res, next) => next();
}

const auth = require("../middleware/auth");
const asyncHandler = require("../middleware/asyncHandler");
const {
  createSchoolPage,
  getManagedSchoolPage,
  getPublicSchoolPage,
  listSchoolInquiries,
  listSchoolPages,
  publishSchoolPage,
  submitSchoolInquiry,
  updateSchoolInquiryStatus,
  updateSchoolPage,
} = require("../services/schoolPageService");

const router = express.Router();

const inquiryLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many school inquiries submitted. Please try again later." },
});

router.get(
  "/public/:slug",
  asyncHandler(async (req, res) => {
    const school = await getPublicSchoolPage(req.params.slug);
    return res.json({ success: true, school });
  })
);

router.post(
  "/public/:slug/inquiries",
  inquiryLimiter,
  asyncHandler(async (req, res) => {
    const payload = await submitSchoolInquiry({
      slug: req.params.slug,
      payload: req.body || {},
      req,
    });
    return res.status(201).json(payload);
  })
);

router.use(auth);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const payload = await listSchoolPages({
      user: req.user,
      page: req.query.page,
      limit: req.query.limit,
      search: req.query.search,
    });
    return res.json({ success: true, ...payload });
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const school = await createSchoolPage({
      user: req.user,
      payload: req.body || {},
    });
    return res.status(201).json({ success: true, school });
  })
);

router.get(
  "/me",
  asyncHandler(async (req, res) => {
    const payload = await listSchoolPages({
      user: req.user,
      page: req.query.page,
      limit: req.query.limit,
      search: req.query.search,
    });
    return res.json({ success: true, ...payload });
  })
);

router.get(
  "/:idOrSlug",
  asyncHandler(async (req, res) => {
    const school = await getManagedSchoolPage({
      user: req.user,
      idOrSlug: req.params.idOrSlug,
    });
    return res.json({ success: true, school });
  })
);

router.put(
  "/:idOrSlug",
  asyncHandler(async (req, res) => {
    const school = await updateSchoolPage({
      user: req.user,
      idOrSlug: req.params.idOrSlug,
      payload: req.body || {},
    });
    return res.json({ success: true, school });
  })
);

router.patch(
  "/:idOrSlug/publish",
  asyncHandler(async (req, res) => {
    const school = await publishSchoolPage({
      user: req.user,
      idOrSlug: req.params.idOrSlug,
      isPublished: req.body?.isPublished !== false,
    });
    return res.json({ success: true, school });
  })
);

router.get(
  "/:idOrSlug/inquiries",
  asyncHandler(async (req, res) => {
    const payload = await listSchoolInquiries({
      user: req.user,
      idOrSlug: req.params.idOrSlug,
      page: req.query.page,
      limit: req.query.limit,
    });
    return res.json({ success: true, ...payload });
  })
);

router.patch(
  "/:idOrSlug/inquiries/:inquiryId",
  asyncHandler(async (req, res) => {
    const inquiry = await updateSchoolInquiryStatus({
      user: req.user,
      idOrSlug: req.params.idOrSlug,
      inquiryId: req.params.inquiryId,
      status: req.body?.status,
    });
    return res.json({ success: true, inquiry });
  })
);

module.exports = router;
