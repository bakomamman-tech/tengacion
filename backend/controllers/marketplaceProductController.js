const asyncHandler = require("../middleware/asyncHandler");
const {
  createMarketplaceListing,
  deleteMarketplaceListing,
  getMarketplaceProductDetail,
  listMarketplaceProducts,
  listSellerManagedProducts,
  listSellerStoreProducts,
  publishMarketplaceListing,
  unpublishMarketplaceListing,
  updateMarketplaceListing,
} = require("../services/marketplaceProductService");

const getProductFiles = (req) => (Array.isArray(req.files) ? req.files : []);

exports.createListing = asyncHandler(async (req, res) => {
  const product = await createMarketplaceListing({
    seller: req.marketplaceSeller,
    payload: req.body || {},
    files: getProductFiles(req),
  });

  return res.status(201).json({ product });
});

exports.updateListing = asyncHandler(async (req, res) => {
  const product = await updateMarketplaceListing({
    seller: req.marketplaceSeller,
    productId: req.params.id,
    payload: req.body || {},
    files: getProductFiles(req),
  });

  return res.json({ product });
});

exports.deleteListing = asyncHandler(async (req, res) => {
  const payload = await deleteMarketplaceListing({
    seller: req.marketplaceSeller,
    productId: req.params.id,
  });

  return res.json(payload);
});

exports.publishListing = asyncHandler(async (req, res) => {
  const product = await publishMarketplaceListing({
    seller: req.marketplaceSeller,
    productId: req.params.id,
  });

  return res.json({ product });
});

exports.unpublishListing = asyncHandler(async (req, res) => {
  const product = await unpublishMarketplaceListing({
    seller: req.marketplaceSeller,
    productId: req.params.id,
  });

  return res.json({ product });
});

exports.getMarketplaceFeed = asyncHandler(async (req, res) => {
  const payload = await listMarketplaceProducts({
    search: req.query.q || req.query.search || "",
    category: req.query.category || "",
    state: req.query.state || "",
    city: req.query.city || "",
    deliveryOption: req.query.deliveryOption || req.query.deliveryType || "",
    storeId: req.query.storeId || "",
    page: req.query.page || 1,
    limit: req.query.limit || 18,
    sort: req.query.sort || "latest",
  });

  return res.json(payload);
});

exports.getMarketplaceProductDetail = asyncHandler(async (req, res) => {
  const payload = await getMarketplaceProductDetail({
    idOrSlug: req.params.idOrSlug,
  });

  return res.json(payload);
});

exports.getSellerStorefrontListings = asyncHandler(async (req, res) => {
  const payload = await listSellerStoreProducts({
    storeId: req.params.storeId,
    search: req.query.q || req.query.search || "",
    category: req.query.category || "",
    state: req.query.state || "",
    city: req.query.city || "",
    deliveryOption: req.query.deliveryOption || "",
    page: req.query.page || 1,
    limit: req.query.limit || 18,
    sort: req.query.sort || "latest",
  });

  return res.json(payload);
});

exports.getManagedSellerListings = asyncHandler(async (req, res) => {
  const payload = await listSellerManagedProducts({
    seller: req.marketplaceSeller,
    page: req.query.page || 1,
    limit: req.query.limit || 20,
    search: req.query.q || req.query.search || "",
    status: req.query.status || "",
  });

  return res.json(payload);
});
