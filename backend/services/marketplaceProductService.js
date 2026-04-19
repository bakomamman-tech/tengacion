const MarketplaceOrder = require("../models/MarketplaceOrder");
const MarketplaceProduct = require("../models/MarketplaceProduct");
const MarketplaceSeller = require("../models/MarketplaceSeller");
const { deleteUploadedMediaBatch, saveUploadedMedia } = require("./mediaStore");
const {
  createServiceError,
  resolveSellerLookup,
  serializeSellerForPublic,
  toIdString,
} = require("./marketplaceSellerService");
const { generateUniqueSlug } = require("../utils/slug");
const { normalizeMediaValue } = require("../utils/userMedia");
const {
  parseList,
  validateProductPayload,
} = require("../validators/marketplaceValidators");

const escapeRegex = (value = "") => String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const parsePage = (value, fallback = 1) => {
  const parsed = Number.parseInt(String(value || "").trim(), 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }
  return parsed;
};

const parseLimit = (value, fallback = 18) => {
  const parsed = Number.parseInt(String(value || "").trim(), 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }
  return Math.min(50, parsed);
};

const buildPagination = ({ page = 1, limit = 18 } = {}) => {
  const safePage = parsePage(page, 1);
  const safeLimit = parseLimit(limit, 18);

  return {
    page: safePage,
    limit: safeLimit,
    skip: (safePage - 1) * safeLimit,
  };
};

const buildProductLocation = (product = {}) => ({
  state: product.state || "",
  city: product.city || "",
  label: [product.city, product.state].filter(Boolean).join(", "),
});

const serializeProductImage = (image = {}) => {
  const normalized = normalizeMediaValue(image);
  return {
    assetId: normalized.assetId || "",
    publicId: normalized.publicId || "",
    url: normalized.secureUrl || normalized.url || "",
    secureUrl: normalized.secureUrl || normalized.url || "",
    resourceType: normalized.resourceType || normalized.resource_type || "",
    type: image.type || "image",
    width: Number(normalized.width || 0),
    height: Number(normalized.height || 0),
    originalFilename: normalized.originalFilename || "",
  };
};

const serializeSellerSnippet = (seller = {}) =>
  seller
    ? {
        _id: toIdString(seller._id),
        userId: toIdString(seller.user),
        storeName: seller.storeName || "",
        slug: seller.slug || "",
        fullName: seller.fullName || "",
        location: {
          state: seller.state || "",
          city: seller.city || "",
          label: [seller.city, seller.state].filter(Boolean).join(", "),
        },
        approvedBadge: seller.status === "approved",
      }
    : null;

const serializeProduct = (product = {}, { seller = null, manageView = false } = {}) => {
  const images = Array.isArray(product.images) ? product.images.map(serializeProductImage) : [];
  const location = buildProductLocation(product);

  return {
    _id: toIdString(product._id),
    sellerId: toIdString(product.seller?._id || product.seller),
    title: product.title || "",
    slug: product.slug || "",
    description: product.description || "",
    category: product.category || "",
    price: Number(product.price || 0),
    currency: product.currency || "NGN",
    stock: Number(product.stock || 0),
    condition: product.condition || "new",
    state: product.state || "",
    city: product.city || "",
    location,
    deliveryOptions: Array.isArray(product.deliveryOptions) ? product.deliveryOptions : [],
    deliveryNotes: product.deliveryNotes || "",
    images,
    primaryImage: images[0] || null,
    serviceChargeIncluded: true,
    isPublished: Boolean(product.isPublished),
    isHidden: Boolean(product.isHidden),
    moderationStatus: product.moderationStatus || "approved",
    seller: serializeSellerSnippet(seller || product.seller),
    createdAt: product.createdAt || null,
    updatedAt: product.updatedAt || null,
    ...(manageView
      ? {}
      : {
          isPublished: undefined,
          isHidden: undefined,
          moderationStatus: undefined,
        }),
  };
};

const parseExistingImages = (value) =>
  parseList(value)
    .map((entry) => normalizeMediaValue(entry))
    .filter((entry) => entry.url || entry.publicId || entry.public_id)
    .map((entry) => ({
      ...entry,
      type: "image",
    }));

const uploadProductImages = async (files = []) => {
  const uploads = Array.isArray(files) ? files.filter(Boolean) : [];
  if (!uploads.length) {
    return [];
  }

  const uploaded = await Promise.all(
    uploads.map((file) =>
      saveUploadedMedia(file, {
        source: "marketplace_product_image",
        folder: "tengacion/marketplace/products",
        resourceType: "image",
      })
    )
  );

  return uploaded.map((entry) => ({
    ...normalizeMediaValue(entry),
    type: "image",
  }));
};

const buildSellerEligibilityQuery = ({ onlyApproved = true } = {}) =>
  onlyApproved
    ? { status: "approved", isActive: true }
    : {};

const resolveStoreSeller = async ({ idOrSlug, onlyApproved = true } = {}) => {
  const seller = await MarketplaceSeller.findOne({
    ...resolveSellerLookup(idOrSlug),
    ...buildSellerEligibilityQuery({ onlyApproved }),
  });

  if (!seller) {
    throw createServiceError("Marketplace seller not found", 404);
  }

  return seller;
};

const buildPublicProductQuery = async ({
  search = "",
  category = "",
  state = "",
  city = "",
  deliveryOption = "",
  storeId = "",
} = {}) => {
  const query = {
    isPublished: true,
    isHidden: false,
    moderationStatus: "approved",
  };

  if (search) {
    const regex = new RegExp(escapeRegex(String(search || "").trim()), "i");
    query.$or = [
      { title: regex },
      { description: regex },
      { category: regex },
      { state: regex },
      { city: regex },
    ];
  }

  if (category) {
    query.category = { $regex: `^${escapeRegex(String(category || "").trim())}$`, $options: "i" };
  }
  if (state) {
    query.state = { $regex: `^${escapeRegex(String(state || "").trim())}$`, $options: "i" };
  }
  if (city) {
    query.city = { $regex: `^${escapeRegex(String(city || "").trim())}$`, $options: "i" };
  }
  if (deliveryOption) {
    query.deliveryOptions = String(deliveryOption || "").trim().toLowerCase();
  }

  if (storeId) {
    const seller = await resolveStoreSeller({ idOrSlug: storeId, onlyApproved: true });
    query.seller = seller._id;
    return { query, storeSeller: seller };
  }

  const approvedSellerIds = await MarketplaceSeller.find({
    status: "approved",
    isActive: true,
  }).distinct("_id");

  query.seller = { $in: approvedSellerIds };
  return { query, storeSeller: null };
};

const buildSort = (sort = "") => {
  const normalized = String(sort || "").trim().toLowerCase();
  if (normalized === "price_asc") {
    return { price: 1, createdAt: -1 };
  }
  if (normalized === "price_desc") {
    return { price: -1, createdAt: -1 };
  }
  if (normalized === "oldest") {
    return { createdAt: 1 };
  }
  return { createdAt: -1, updatedAt: -1 };
};

const getProductByIdOrSlug = async ({ idOrSlug, includeHidden = false } = {}) => {
  const raw = String(idOrSlug || "").trim();
  const lookup = /^[a-f0-9]{24}$/i.test(raw) ? { _id: raw } : { slug: raw.toLowerCase() };
  const query = includeHidden ? lookup : { ...lookup, isHidden: false };

  return MarketplaceProduct.findOne(query).populate("seller");
};

const getSellerProductOrThrow = async ({ sellerId, productId } = {}) => {
  const product = await MarketplaceProduct.findOne({
    _id: productId,
    seller: sellerId,
  }).populate("seller");

  if (!product) {
    throw createServiceError("Marketplace product not found", 404);
  }

  return product;
};

const createMarketplaceListing = async ({ seller, payload = {}, files = [] } = {}) => {
  const { errors, value } = validateProductPayload({
    payload,
    files,
    requireImages: true,
    hasExistingImages: false,
  });

  if (errors.length) {
    throw createServiceError("Product listing validation failed", 400, errors);
  }

  const uploadedImages = await uploadProductImages(files);
  const slug = await generateUniqueSlug(MarketplaceProduct, value.title, {
    fallback: `marketplace-product-${Date.now()}`,
  });

  const product = await MarketplaceProduct.create({
    seller: seller._id,
    title: value.title,
    slug,
    description: value.description,
    images: uploadedImages,
    category: value.category,
    price: value.price,
    currency: "NGN",
    stock: value.stock,
    condition: value.condition,
    state: value.state,
    city: value.city,
    deliveryOptions: value.deliveryOptions,
    deliveryNotes: value.deliveryNotes,
    isPublished: Boolean(value.isPublished),
    isHidden: false,
    moderationStatus: "approved",
  });

  product.seller = seller;
  return serializeProduct(product, {
    seller,
    manageView: true,
  });
};

const updateMarketplaceListing = async ({
  seller,
  productId,
  payload = {},
  files = [],
} = {}) => {
  const product = await getSellerProductOrThrow({
    sellerId: seller._id,
    productId,
  });

  const existingImages = parseExistingImages(payload.existingImages);
  const { errors, value } = validateProductPayload({
    payload,
    files,
    requireImages: false,
    hasExistingImages: existingImages.length > 0 || product.images.length > 0,
  });

  if (errors.length) {
    throw createServiceError("Product listing validation failed", 400, errors);
  }

  const uploadedImages = await uploadProductImages(files);
  const nextImages =
    existingImages.length || uploadedImages.length
      ? [...existingImages, ...uploadedImages]
      : product.images;

  product.title = value.title;
  product.description = value.description;
  product.category = value.category;
  product.price = value.price;
  product.stock = value.stock;
  product.condition = value.condition;
  product.state = value.state;
  product.city = value.city;
  product.deliveryOptions = value.deliveryOptions;
  product.deliveryNotes = value.deliveryNotes;
  product.images = nextImages;
  product.slug = await generateUniqueSlug(MarketplaceProduct, value.title, {
    ignoreId: product._id,
    fallback: product.slug || `marketplace-product-${Date.now()}`,
  });

  await product.save();

  return serializeProduct(product, {
    seller,
    manageView: true,
  });
};

const publishMarketplaceListing = async ({ seller, productId } = {}) => {
  const product = await getSellerProductOrThrow({
    sellerId: seller._id,
    productId,
  });

  if (product.isHidden || product.moderationStatus !== "approved") {
    throw createServiceError("This listing is currently hidden by marketplace moderation", 403);
  }

  const { errors } = validateProductPayload({
    payload: product.toObject ? product.toObject() : product,
    files: [],
    requireImages: true,
    hasExistingImages: Array.isArray(product.images) && product.images.length > 0,
  });

  if (errors.length) {
    throw createServiceError("This listing cannot be published yet", 400, errors);
  }

  product.isPublished = true;
  await product.save();

  return serializeProduct(product, {
    seller,
    manageView: true,
  });
};

const unpublishMarketplaceListing = async ({ seller, productId } = {}) => {
  const product = await getSellerProductOrThrow({
    sellerId: seller._id,
    productId,
  });

  product.isPublished = false;
  await product.save();

  return serializeProduct(product, {
    seller,
    manageView: true,
  });
};

const deleteMarketplaceListing = async ({ seller, productId } = {}) => {
  const product = await getSellerProductOrThrow({
    sellerId: seller._id,
    productId,
  });

  const orderCount = await MarketplaceOrder.countDocuments({ product: product._id });
  if (orderCount > 0) {
    product.isPublished = false;
    product.isHidden = true;
    product.moderationStatus = "removed";
    await product.save();

    return {
      deleted: false,
      archived: true,
      product: serializeProduct(product, {
        seller,
        manageView: true,
      }),
    };
  }

  await deleteUploadedMediaBatch(product.images || []);
  await MarketplaceProduct.deleteOne({ _id: product._id });

  return {
    deleted: true,
    archived: false,
    productId: toIdString(product._id),
  };
};

const listMarketplaceProducts = async ({
  search = "",
  category = "",
  state = "",
  city = "",
  deliveryOption = "",
  storeId = "",
  page = 1,
  limit = 18,
  sort = "latest",
} = {}) => {
  const pagination = buildPagination({ page, limit });
  const { query, storeSeller } = await buildPublicProductQuery({
    search,
    category,
    state,
    city,
    deliveryOption,
    storeId,
  });

  const [rows, total, categoryRows, featuredRows, latestRows, trendingRows] =
    await Promise.all([
      MarketplaceProduct.find(query)
        .sort(buildSort(sort))
        .skip(pagination.skip)
        .limit(pagination.limit)
        .populate("seller")
        .lean(),
      MarketplaceProduct.countDocuments(query),
      MarketplaceProduct.aggregate([
        {
          $match: {
            isPublished: true,
            isHidden: false,
            moderationStatus: "approved",
          },
        },
        { $group: { _id: "$category", count: { $sum: 1 } } },
        { $sort: { count: -1, _id: 1 } },
        { $limit: 12 },
      ]),
      MarketplaceProduct.find({
        isPublished: true,
        isHidden: false,
        moderationStatus: "approved",
      })
        .sort({ updatedAt: -1, stock: -1 })
        .limit(6)
        .populate("seller")
        .lean(),
      MarketplaceProduct.find({
        isPublished: true,
        isHidden: false,
        moderationStatus: "approved",
      })
        .sort({ createdAt: -1 })
        .limit(8)
        .populate("seller")
        .lean(),
      MarketplaceProduct.aggregate([
        {
          $match: {
            isPublished: true,
            isHidden: false,
            moderationStatus: "approved",
          },
        },
        {
          $group: {
            _id: "$seller",
            productCount: { $sum: 1 },
            latestListingAt: { $max: "$updatedAt" },
          },
        },
        { $sort: { productCount: -1, latestListingAt: -1 } },
        { $limit: 6 },
      ]),
    ]);

  const trendingSellerDocs = trendingRows.length
    ? await MarketplaceSeller.find({
        _id: { $in: trendingRows.map((row) => row._id) },
        status: "approved",
        isActive: true,
      }).lean()
    : [];
  const trendingSellerMap = new Map(
    trendingSellerDocs.map((row) => [toIdString(row._id), row])
  );

  return {
    page: pagination.page,
    limit: pagination.limit,
    total,
    filters: {
      search: String(search || ""),
      category: String(category || ""),
      state: String(state || ""),
      city: String(city || ""),
      deliveryOption: String(deliveryOption || ""),
      sort: String(sort || "latest"),
    },
    store: storeSeller ? serializeSellerForPublic(storeSeller) : null,
    products: rows.map((row) => serializeProduct(row, { seller: row.seller })),
    featuredProducts: featuredRows.map((row) => serializeProduct(row, { seller: row.seller })),
    latestProducts: latestRows.map((row) => serializeProduct(row, { seller: row.seller })),
    categories: categoryRows
      .filter((row) => row._id)
      .map((row) => ({
        value: row._id,
        count: Number(row.count || 0),
      })),
    trendingSellers: trendingRows
      .map((row) => {
        const seller = trendingSellerMap.get(toIdString(row._id));
        if (!seller) {
          return null;
        }
        return {
          ...serializeSellerForPublic(seller),
          productCount: Number(row.productCount || 0),
          latestListingAt: row.latestListingAt || null,
        };
      })
      .filter(Boolean),
  };
};

const getMarketplaceProductDetail = async ({ idOrSlug } = {}) => {
  const product = await getProductByIdOrSlug({ idOrSlug, includeHidden: false });
  if (!product || !product.seller || product.seller.status !== "approved" || !product.seller.isActive) {
    throw createServiceError("Marketplace product not found", 404);
  }

  if (!product.isPublished || product.isHidden || product.moderationStatus !== "approved") {
    throw createServiceError("Marketplace product not found", 404);
  }

  const relatedRows = await MarketplaceProduct.find({
    _id: { $ne: product._id },
    seller: { $ne: product.seller._id },
    isPublished: true,
    isHidden: false,
    moderationStatus: "approved",
    $or: [
      { category: product.category },
      { state: product.state },
    ],
  })
    .sort({ createdAt: -1 })
    .limit(4)
    .populate("seller")
    .lean();

  return {
    product: serializeProduct(product, {
      seller: product.seller,
    }),
    relatedProducts: relatedRows.map((row) => serializeProduct(row, { seller: row.seller })),
  };
};

const listSellerStoreProducts = async ({
  storeId,
  search = "",
  category = "",
  state = "",
  city = "",
  deliveryOption = "",
  page = 1,
  limit = 18,
  sort = "latest",
} = {}) =>
  listMarketplaceProducts({
    storeId,
    search,
    category,
    state,
    city,
    deliveryOption,
    page,
    limit,
    sort,
  });

const listSellerManagedProducts = async ({
  seller,
  page = 1,
  limit = 20,
  search = "",
  status = "",
} = {}) => {
  const pagination = buildPagination({ page, limit });
  const query = { seller: seller._id };

  if (search) {
    const regex = new RegExp(escapeRegex(String(search || "").trim()), "i");
    query.$or = [
      { title: regex },
      { description: regex },
      { category: regex },
    ];
  }

  if (status === "published") {
    query.isPublished = true;
  } else if (status === "draft") {
    query.isPublished = false;
  } else if (status === "hidden") {
    query.isHidden = true;
  }

  const [rows, total] = await Promise.all([
    MarketplaceProduct.find(query)
      .sort({ updatedAt: -1, createdAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit)
      .lean(),
    MarketplaceProduct.countDocuments(query),
  ]);

  return {
    page: pagination.page,
    limit: pagination.limit,
    total,
    products: rows.map((row) =>
      serializeProduct(row, {
        seller,
        manageView: true,
      })
    ),
  };
};

const listMarketplaceProductsForAdmin = async ({
  page = 1,
  limit = 20,
  status = "",
  search = "",
} = {}) => {
  const pagination = buildPagination({ page, limit });
  const query = {};

  if (status === "published") {
    query.isPublished = true;
    query.isHidden = false;
  } else if (status === "hidden") {
    query.isHidden = true;
  } else if (status === "removed") {
    query.moderationStatus = "removed";
  }

  if (search) {
    const regex = new RegExp(escapeRegex(String(search || "").trim()), "i");
    query.$or = [
      { title: regex },
      { category: regex },
      { state: regex },
      { city: regex },
      { slug: regex },
    ];
  }

  const [rows, total, summaryRows] = await Promise.all([
    MarketplaceProduct.find(query)
      .sort({ updatedAt: -1, createdAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit)
      .populate("seller")
      .lean(),
    MarketplaceProduct.countDocuments(query),
    MarketplaceProduct.aggregate([
      {
        $group: {
          _id: null,
          totalProducts: { $sum: 1 },
          publishedProducts: {
            $sum: {
              $cond: [{ $eq: ["$isPublished", true] }, 1, 0],
            },
          },
          hiddenProducts: {
            $sum: {
              $cond: [{ $eq: ["$isHidden", true] }, 1, 0],
            },
          },
        },
      },
    ]),
  ]);

  return {
    page: pagination.page,
    limit: pagination.limit,
    total,
    summary: {
      totalProducts: Number(summaryRows[0]?.totalProducts || 0),
      publishedProducts: Number(summaryRows[0]?.publishedProducts || 0),
      hiddenProducts: Number(summaryRows[0]?.hiddenProducts || 0),
    },
    products: rows.map((row) =>
      serializeProduct(row, {
        seller: row.seller,
        manageView: true,
      })
    ),
  };
};

const hideMarketplaceProductByAdmin = async ({ productId } = {}) => {
  const product = await MarketplaceProduct.findById(productId).populate("seller");
  if (!product) {
    throw createServiceError("Marketplace product not found", 404);
  }

  product.isHidden = true;
  product.isPublished = false;
  product.moderationStatus = "hidden";
  await product.save();

  return serializeProduct(product, {
    seller: product.seller,
    manageView: true,
  });
};

const removeMarketplaceProductByAdmin = async ({ productId } = {}) => {
  const product = await MarketplaceProduct.findById(productId).populate("seller");
  if (!product) {
    throw createServiceError("Marketplace product not found", 404);
  }

  const orderCount = await MarketplaceOrder.countDocuments({ product: product._id });
  if (orderCount > 0) {
    product.isHidden = true;
    product.isPublished = false;
    product.moderationStatus = "removed";
    await product.save();

    return {
      deleted: false,
      archived: true,
      product: serializeProduct(product, {
        seller: product.seller,
        manageView: true,
      }),
    };
  }

  await deleteUploadedMediaBatch(product.images || []);
  await MarketplaceProduct.deleteOne({ _id: product._id });

  return {
    deleted: true,
    archived: false,
    productId: toIdString(product._id),
  };
};

module.exports = {
  createMarketplaceListing,
  deleteMarketplaceListing,
  getMarketplaceProductDetail,
  getProductByIdOrSlug,
  getSellerProductOrThrow,
  hideMarketplaceProductByAdmin,
  listMarketplaceProducts,
  listMarketplaceProductsForAdmin,
  listSellerManagedProducts,
  listSellerStoreProducts,
  publishMarketplaceListing,
  removeMarketplaceProductByAdmin,
  serializeProduct,
  serializeSellerSnippet,
  unpublishMarketplaceListing,
  updateMarketplaceListing,
};
