const asyncHandler = require("../middleware/asyncHandler");
const requireStepUp = require("../middleware/requireStepUp");
const MarketplaceSeller = require("../models/MarketplaceSeller");
const { writeAuditLog } = require("../services/auditLogService");
const {
  getAdminPayoutOverview,
} = require("../services/marketplacePayoutService");
const {
  getSellerApplicationForAdmin,
  listSellerApplications,
  loadSellerSummary,
  serializeSellerForAdmin,
} = require("../services/marketplaceSellerService");
const {
  hideMarketplaceProductByAdmin,
  listMarketplaceProductsForAdmin,
  removeMarketplaceProductByAdmin,
} = require("../services/marketplaceProductService");
const {
  listMarketplaceOrdersForAdmin,
} = require("../services/marketplaceOrderService");

const buildReason = (value = "", fallback = "") =>
  String(value || fallback || "").trim().slice(0, 400);

const getSellerOrThrow = async (sellerId) => {
  const seller = await MarketplaceSeller.findById(sellerId);
  if (!seller) {
    throw Object.assign(new Error("Marketplace seller not found"), { status: 404 });
  }
  return seller;
};

exports.requireMutationStepUp = requireStepUp({ adminOnly: true });

exports.listSellerApplications = asyncHandler(async (req, res) => {
  const payload = await listSellerApplications({
    page: req.query.page || 1,
    limit: req.query.limit || 20,
    status: req.query.status || "",
    search: req.query.q || req.query.search || "",
    req,
  });

  return res.json(payload);
});

exports.getSellerApplication = asyncHandler(async (req, res) => {
  const payload = await getSellerApplicationForAdmin({
    sellerId: req.params.id,
    req,
  });

  return res.json(payload);
});

exports.approveSeller = asyncHandler(async (req, res) => {
  const seller = await getSellerOrThrow(req.params.id);

  seller.status = "approved";
  seller.rejectionReason = "";
  seller.approvedAt = new Date();
  seller.approvedBy = req.user.id;
  seller.suspendedAt = null;
  seller.isActive = true;
  await seller.save();

  await writeAuditLog({
    req,
    actorId: req.user.id,
    action: "marketplace.seller.approve",
    targetType: "MarketplaceSeller",
    targetId: seller._id,
    reason: buildReason(req.body?.reason, "Approved marketplace seller"),
    metadata: {
      storeName: seller.storeName || "",
      sellerUserId: String(seller.user || ""),
    },
  }).catch(() => null);

  const summary = await loadSellerSummary(seller._id);
  return res.json({
    seller: serializeSellerForAdmin(seller, { req, summary }),
    summary,
  });
});

exports.rejectSeller = asyncHandler(async (req, res) => {
  const seller = await getSellerOrThrow(req.params.id);
  const reason = buildReason(req.body?.reason);
  if (!reason) {
    return res.status(400).json({ error: "A rejection reason is required" });
  }

  seller.status = "rejected";
  seller.rejectionReason = reason;
  seller.approvedAt = null;
  seller.approvedBy = null;
  seller.suspendedAt = null;
  seller.isActive = true;
  await seller.save();

  await writeAuditLog({
    req,
    actorId: req.user.id,
    action: "marketplace.seller.reject",
    targetType: "MarketplaceSeller",
    targetId: seller._id,
    reason,
    metadata: {
      storeName: seller.storeName || "",
      sellerUserId: String(seller.user || ""),
    },
  }).catch(() => null);

  const summary = await loadSellerSummary(seller._id);
  return res.json({
    seller: serializeSellerForAdmin(seller, { req, summary }),
    summary,
  });
});

exports.suspendSeller = asyncHandler(async (req, res) => {
  const seller = await getSellerOrThrow(req.params.id);
  const reason = buildReason(req.body?.reason, "Marketplace seller suspended");

  seller.status = "suspended";
  seller.suspendedAt = new Date();
  seller.isActive = false;
  if (reason) {
    seller.rejectionReason = reason;
  }
  await seller.save();

  await writeAuditLog({
    req,
    actorId: req.user.id,
    action: "marketplace.seller.suspend",
    targetType: "MarketplaceSeller",
    targetId: seller._id,
    reason,
    metadata: {
      storeName: seller.storeName || "",
      sellerUserId: String(seller.user || ""),
    },
  }).catch(() => null);

  const summary = await loadSellerSummary(seller._id);
  return res.json({
    seller: serializeSellerForAdmin(seller, { req, summary }),
    summary,
  });
});

exports.listMarketplaceProducts = asyncHandler(async (req, res) => {
  const payload = await listMarketplaceProductsForAdmin({
    page: req.query.page || 1,
    limit: req.query.limit || 20,
    status: req.query.status || "",
    search: req.query.q || req.query.search || "",
  });

  return res.json(payload);
});

exports.hideProduct = asyncHandler(async (req, res) => {
  const product = await hideMarketplaceProductByAdmin({
    productId: req.params.id,
  });

  await writeAuditLog({
    req,
    actorId: req.user.id,
    action: "marketplace.product.hide",
    targetType: "MarketplaceProduct",
    targetId: req.params.id,
    reason: buildReason(req.body?.reason, "Marketplace product hidden"),
    metadata: {
      title: product.title || "",
      sellerId: product.sellerId || "",
    },
  }).catch(() => null);

  return res.json({ product });
});

exports.deleteProduct = asyncHandler(async (req, res) => {
  const payload = await removeMarketplaceProductByAdmin({
    productId: req.params.id,
  });

  await writeAuditLog({
    req,
    actorId: req.user.id,
    action: "marketplace.product.remove",
    targetType: "MarketplaceProduct",
    targetId: req.params.id,
    reason: buildReason(req.body?.reason, "Marketplace product removed"),
    metadata: {
      archived: Boolean(payload.archived),
      deleted: Boolean(payload.deleted),
    },
  }).catch(() => null);

  return res.json(payload);
});

exports.listMarketplaceOrders = asyncHandler(async (req, res) => {
  const payload = await listMarketplaceOrdersForAdmin({
    page: req.query.page || 1,
    limit: req.query.limit || 20,
    paymentStatus: req.query.paymentStatus || "",
    orderStatus: req.query.orderStatus || "",
    search: req.query.q || req.query.search || "",
  });

  return res.json(payload);
});

exports.listMarketplacePayouts = asyncHandler(async (req, res) => {
  const payload = await getAdminPayoutOverview({
    page: req.query.page || 1,
    limit: req.query.limit || 20,
    status: req.query.status || "",
  });

  return res.json(payload);
});
