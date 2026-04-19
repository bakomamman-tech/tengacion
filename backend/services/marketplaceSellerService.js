const mongoose = require("mongoose");

const MarketplaceOrder = require("../models/MarketplaceOrder");
const MarketplaceProduct = require("../models/MarketplaceProduct");
const MarketplaceSeller = require("../models/MarketplaceSeller");
const { saveUploadedMediaToGridFs } = require("./mediaStore");
const { buildSignedMediaUrl } = require("./mediaSigner");
const { getSellerPayoutSummary } = require("./marketplacePayoutService");
const { generateUniqueSlug } = require("../utils/slug");
const {
  validateSellerDraftPayload,
  validateSellerSubmissionPayload,
} = require("../validators/marketplaceValidators");

const createServiceError = (message, status = 400, details = null) => {
  const error = new Error(message);
  error.status = status;
  if (details) {
    error.details = details;
  }
  return error;
};

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

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

const createEmptySummary = () => ({
  totalProducts: 0,
  publishedProducts: 0,
  totalOrders: 0,
  pendingOrders: 0,
  totalSales: 0,
  totalPlatformFees: 0,
  totalNetReceivable: 0,
  totalCompletedOrders: 0,
});

const buildSellerLocation = (seller = {}) => ({
  state: seller.state || "",
  city: seller.city || "",
  label: [seller.city, seller.state].filter(Boolean).join(", "),
});

const buildPublicAboutCopy = (seller = {}) => {
  const locationLabel = [seller.city, seller.state].filter(Boolean).join(", ");
  if (seller.storeName && locationLabel) {
    return `${seller.storeName} is an approved Tengacion marketplace seller serving ${locationLabel}.`;
  }
  if (seller.storeName) {
    return `${seller.storeName} is an approved Tengacion marketplace seller.`;
  }
  return "Approved Tengacion marketplace seller.";
};

const buildSecureCacDocument = ({ seller, req, userId = "" } = {}) => {
  const certificate = seller?.cacCertificate || {};
  const sourceUrl = String(certificate.url || "").trim();

  if (!sourceUrl) {
    return {
      hasFile: false,
      originalName: "",
      mimeType: "",
      secureUrl: "",
    };
  }

  return {
    hasFile: true,
    originalName: certificate.originalName || "",
    mimeType: certificate.mimeType || "",
    secureUrl: req
      ? buildSignedMediaUrl({
          sourceUrl,
          userId: userId || toIdString(seller?.user),
          itemType: "marketplace_cac",
          itemId: toIdString(seller?._id),
          expiresInSec: 15 * 60,
          allowDownload: true,
          req,
        })
      : "",
  };
};

const serializeSellerForPublic = (seller = {}, extras = {}) => ({
  _id: toIdString(seller._id),
  userId: toIdString(seller.user),
  storeName: seller.storeName || "",
  slug: seller.slug || "",
  fullName: seller.fullName || "",
  status: seller.status || "draft",
  approvedBadge: seller.status === "approved",
  approvedAt: seller.approvedAt || null,
  location: buildSellerLocation(seller),
  about: buildPublicAboutCopy(seller),
  isActive: Boolean(seller.isActive),
  summary: extras.summary || createEmptySummary(),
  createdAt: seller.createdAt || null,
  updatedAt: seller.updatedAt || null,
});

const serializeSellerForSelf = (seller = {}, { req, summary } = {}) => ({
  _id: toIdString(seller._id),
  userId: toIdString(seller.user),
  fullName: seller.fullName || "",
  storeName: seller.storeName || "",
  slug: seller.slug || "",
  phoneNumber: seller.phoneNumber || "",
  bankName: seller.bankName || "",
  accountNumber: seller.accountNumber || "",
  accountName: seller.accountName || "",
  residentialAddress: seller.residentialAddress || "",
  businessAddress: seller.businessAddress || "",
  state: seller.state || "",
  city: seller.city || "",
  location: buildSellerLocation(seller),
  status: seller.status || "draft",
  rejectionReason: seller.rejectionReason || "",
  approvedAt: seller.approvedAt || null,
  approvedBy: toIdString(seller.approvedBy),
  suspendedAt: seller.suspendedAt || null,
  isActive: Boolean(seller.isActive),
  acceptedTerms: true,
  canSell: seller.status === "approved" && Boolean(seller.isActive),
  storefrontPath: seller.slug
    ? `/marketplace/store/${encodeURIComponent(seller.slug)}`
    : toIdString(seller._id)
      ? `/marketplace/store/${encodeURIComponent(toIdString(seller._id))}`
      : "",
  cacCertificate: buildSecureCacDocument({
    seller,
    req,
    userId: toIdString(seller.user),
  }),
  summary: summary || createEmptySummary(),
  createdAt: seller.createdAt || null,
  updatedAt: seller.updatedAt || null,
});

const serializeSellerForAdmin = (seller = {}, { req, summary } = {}) => ({
  _id: toIdString(seller._id),
  userId: toIdString(seller.user),
  fullName: seller.fullName || "",
  storeName: seller.storeName || "",
  slug: seller.slug || "",
  phoneNumber: seller.phoneNumber || "",
  bankName: seller.bankName || "",
  accountNumber: seller.accountNumber || "",
  accountName: seller.accountName || "",
  residentialAddress: seller.residentialAddress || "",
  businessAddress: seller.businessAddress || "",
  state: seller.state || "",
  city: seller.city || "",
  location: buildSellerLocation(seller),
  status: seller.status || "draft",
  rejectionReason: seller.rejectionReason || "",
  approvedAt: seller.approvedAt || null,
  approvedBy: toIdString(seller.approvedBy),
  suspendedAt: seller.suspendedAt || null,
  isActive: Boolean(seller.isActive),
  cacCertificate: buildSecureCacDocument({
    seller,
    req,
    userId: req?.user?.id || "",
  }),
  summary: summary || createEmptySummary(),
  createdAt: seller.createdAt || null,
  updatedAt: seller.updatedAt || null,
});

const resolveSellerLookup = (idOrSlug = "") => {
  const raw = String(idOrSlug || "").trim();
  if (!raw) {
    throw createServiceError("Marketplace seller identifier is required", 400);
  }

  if (isValidObjectId(raw)) {
    return { _id: raw };
  }

  return { slug: raw.toLowerCase() };
};

const ensureSellerSlug = async (seller, storeName = "") => {
  const source = String(storeName || seller.storeName || seller.fullName || "").trim();
  if (!source) {
    seller.slug = "";
    return;
  }

  seller.slug = await generateUniqueSlug(MarketplaceSeller, source, {
    ignoreId: seller._id,
    fallback: `marketplace-seller-${String(seller.user || "").slice(-8)}`,
  });
};

const uploadSellerCacDocument = async (file, userId) => {
  if (!file) {
    return null;
  }

  const uploaded = await saveUploadedMediaToGridFs(file, {
    source: "marketplace_cac",
    metadata: {
      visibility: "private",
      ownerType: "marketplace_seller",
      ownerUserId: String(userId || ""),
    },
  });

  return {
    publicId: uploaded.public_id || uploaded.publicId || "",
    url: uploaded.url || "",
    originalName: file.originalname || "",
    mimeType: file.mimetype || "",
    provider: "gridfs",
  };
};

const loadSellerSummary = async (sellerId) => {
  if (!sellerId) {
    return createEmptySummary();
  }

  const [totalProducts, publishedProducts, totalOrders, pendingOrders, payoutSummary] =
    await Promise.all([
      MarketplaceProduct.countDocuments({ seller: sellerId }),
      MarketplaceProduct.countDocuments({ seller: sellerId, isPublished: true, isHidden: false }),
      MarketplaceOrder.countDocuments({ seller: sellerId }),
      MarketplaceOrder.countDocuments({
        seller: sellerId,
        orderStatus: { $in: ["pending", "paid", "processing"] },
      }),
      getSellerPayoutSummary(sellerId),
    ]);

  return {
    totalProducts: Number(totalProducts || 0),
    publishedProducts: Number(publishedProducts || 0),
    totalOrders: Number(totalOrders || 0),
    pendingOrders: Number(pendingOrders || 0),
    totalSales: Number(payoutSummary.totalSales || 0),
    totalPlatformFees: Number(payoutSummary.totalPlatformFees || 0),
    totalNetReceivable: Number(payoutSummary.totalNetReceivable || 0),
    totalCompletedOrders: Number(payoutSummary.totalCompletedOrders || 0),
  };
};

const applySellerPayloadToDocument = async ({
  seller,
  payload,
  cacFile = null,
  userId = "",
} = {}) => {
  seller.fullName = payload.fullName;
  seller.storeName = payload.storeName;
  seller.phoneNumber = payload.phoneNumber;
  seller.bankName = payload.bankName;
  seller.accountNumber = payload.accountNumber;
  seller.accountName = payload.accountName;
  seller.residentialAddress = payload.residentialAddress;
  seller.businessAddress = payload.businessAddress;
  seller.state = payload.state;
  seller.city = payload.city;
  seller.isActive = seller.status === "suspended" ? Boolean(seller.isActive) : true;

  await ensureSellerSlug(seller, payload.storeName);

  const uploadedCac = await uploadSellerCacDocument(cacFile, userId);
  if (uploadedCac) {
    seller.cacCertificate = uploadedCac;
  }
};

const assertSellerCanBeEdited = (seller = null) => {
  if (seller?.status === "suspended") {
    throw createServiceError(
      "This seller profile is suspended and cannot be edited right now",
      403
    );
  }
};

const getSellerStatusBundle = async ({ userId, req } = {}) => {
  const seller = await MarketplaceSeller.findOne({ user: userId });
  if (!seller) {
    return {
      seller: null,
      summary: createEmptySummary(),
    };
  }

  const summary = await loadSellerSummary(seller._id);
  return {
    seller: serializeSellerForSelf(seller, { req, summary }),
    summary,
  };
};

const saveSellerDraft = async ({ userId, payload = {}, cacFile = null, req } = {}) => {
  const existing = await MarketplaceSeller.findOne({ user: userId });
  assertSellerCanBeEdited(existing);

  const { errors, value } = validateSellerDraftPayload({
    payload,
    file: cacFile,
  });

  if (errors.length) {
    throw createServiceError("Seller profile validation failed", 400, errors);
  }

  const seller = existing || new MarketplaceSeller({ user: userId });
  await applySellerPayloadToDocument({
    seller,
    payload: value,
    cacFile,
    userId,
  });

  if (!seller.status) {
    seller.status = "draft";
  }

  await seller.save();
  const summary = await loadSellerSummary(seller._id);

  return {
    seller: serializeSellerForSelf(seller, { req, summary }),
    summary,
  };
};

const submitSellerApplication = async ({ userId, payload = {}, cacFile = null, req } = {}) => {
  const existing = await MarketplaceSeller.findOne({ user: userId });
  assertSellerCanBeEdited(existing);

  if (existing?.status === "approved" && existing?.isActive) {
    throw createServiceError("This seller profile is already approved", 409);
  }

  const { errors, value } = validateSellerSubmissionPayload({
    payload,
    file: cacFile,
    hasExistingCac: Boolean(existing?.cacCertificate?.url),
  });

  if (errors.length) {
    throw createServiceError("Seller application is incomplete", 400, errors);
  }

  const seller = existing || new MarketplaceSeller({ user: userId });
  await applySellerPayloadToDocument({
    seller,
    payload: value,
    cacFile,
    userId,
  });
  seller.status = "pending_review";
  seller.rejectionReason = "";
  seller.approvedAt = null;
  seller.approvedBy = null;
  seller.suspendedAt = null;
  seller.isActive = true;

  await seller.save();
  const summary = await loadSellerSummary(seller._id);

  return {
    seller: serializeSellerForSelf(seller, { req, summary }),
    summary,
  };
};

const resubmitSellerApplication = async ({ userId, payload = {}, cacFile = null, req } = {}) => {
  const seller = await MarketplaceSeller.findOne({ user: userId });
  if (!seller) {
    throw createServiceError("Marketplace seller profile not found", 404);
  }
  assertSellerCanBeEdited(seller);

  if (seller.status === "approved" && seller.isActive) {
    throw createServiceError("This seller profile is already approved", 409);
  }

  const { errors, value } = validateSellerSubmissionPayload({
    payload,
    file: cacFile,
    hasExistingCac: Boolean(seller?.cacCertificate?.url),
  });

  if (errors.length) {
    throw createServiceError("Seller application is incomplete", 400, errors);
  }

  await applySellerPayloadToDocument({
    seller,
    payload: value,
    cacFile,
    userId,
  });
  seller.status = "pending_review";
  seller.rejectionReason = "";
  seller.approvedAt = null;
  seller.approvedBy = null;
  seller.suspendedAt = null;
  seller.isActive = true;

  await seller.save();
  const summary = await loadSellerSummary(seller._id);

  return {
    seller: serializeSellerForSelf(seller, { req, summary }),
    summary,
  };
};

const getPublicSellerStorefront = async ({ idOrSlug, req } = {}) => {
  const seller = await MarketplaceSeller.findOne({
    ...resolveSellerLookup(idOrSlug),
    status: "approved",
    isActive: true,
  });

  if (!seller) {
    throw createServiceError("Marketplace seller not found", 404);
  }

  const summary = await loadSellerSummary(seller._id);
  return {
    seller: serializeSellerForPublic(seller, { req, summary }),
    summary,
  };
};

const listSellerApplications = async ({
  page = 1,
  limit = 20,
  status = "",
  search = "",
  req,
} = {}) => {
  const safePage = Math.max(1, Number(page || 1));
  const safeLimit = Math.min(50, Math.max(1, Number(limit || 20)));
  const skip = (safePage - 1) * safeLimit;
  const query = {};

  if (status) {
    query.status = String(status || "").trim().toLowerCase();
  }

  if (search) {
    const needle = String(search || "").trim();
    query.$or = [
      { fullName: { $regex: needle, $options: "i" } },
      { storeName: { $regex: needle, $options: "i" } },
      { state: { $regex: needle, $options: "i" } },
      { city: { $regex: needle, $options: "i" } },
    ];
  }

  const [rows, total] = await Promise.all([
    MarketplaceSeller.find(query)
      .sort({ updatedAt: -1, createdAt: -1 })
      .skip(skip)
      .limit(safeLimit)
      .lean(),
    MarketplaceSeller.countDocuments(query),
  ]);

  const sellers = await Promise.all(
    rows.map(async (row) => {
      const summary = await loadSellerSummary(row._id);
      return serializeSellerForAdmin(row, { req, summary });
    })
  );

  return {
    page: safePage,
    limit: safeLimit,
    total,
    sellers,
  };
};

const getSellerApplicationForAdmin = async ({ sellerId, req } = {}) => {
  const seller = await MarketplaceSeller.findById(sellerId);
  if (!seller) {
    throw createServiceError("Marketplace seller not found", 404);
  }

  const summary = await loadSellerSummary(seller._id);
  return {
    seller: serializeSellerForAdmin(seller, { req, summary }),
    summary,
  };
};

module.exports = {
  createEmptySummary,
  createServiceError,
  getPublicSellerStorefront,
  getSellerApplicationForAdmin,
  getSellerStatusBundle,
  listSellerApplications,
  loadSellerSummary,
  resolveSellerLookup,
  resubmitSellerApplication,
  saveSellerDraft,
  serializeSellerForAdmin,
  serializeSellerForPublic,
  serializeSellerForSelf,
  submitSellerApplication,
  toIdString,
};
