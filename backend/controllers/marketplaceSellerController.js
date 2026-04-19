const asyncHandler = require("../middleware/asyncHandler");
const {
  getPublicSellerStorefront,
  getSellerStatusBundle,
  resubmitSellerApplication,
  saveSellerDraft,
  submitSellerApplication,
} = require("../services/marketplaceSellerService");

const getCacFile = (req) => req.files?.cacCertificate?.[0] || null;

exports.getMySellerProfile = asyncHandler(async (req, res) => {
  const payload = await getSellerStatusBundle({
    userId: req.user.id,
    req,
  });

  return res.json(payload);
});

exports.saveSellerDraft = asyncHandler(async (req, res) => {
  const payload = await saveSellerDraft({
    userId: req.user.id,
    payload: req.body || {},
    cacFile: getCacFile(req),
    req,
  });

  return res.status(201).json(payload);
});

exports.submitSellerApplication = asyncHandler(async (req, res) => {
  const payload = await submitSellerApplication({
    userId: req.user.id,
    payload: req.body || {},
    cacFile: getCacFile(req),
    req,
  });

  return res.status(201).json(payload);
});

exports.resubmitSellerApplication = asyncHandler(async (req, res) => {
  const payload = await resubmitSellerApplication({
    userId: req.user.id,
    payload: req.body || {},
    cacFile: getCacFile(req),
    req,
  });

  return res.json(payload);
});

exports.getPublicSellerStorefront = asyncHandler(async (req, res) => {
  const payload = await getPublicSellerStorefront({
    idOrSlug: req.params.idOrSlug,
    req,
  });

  return res.json(payload);
});
