const MarketplaceOrder = require("../models/MarketplaceOrder");
const MarketplaceProduct = require("../models/MarketplaceProduct");
const MarketplaceSeller = require("../models/MarketplaceSeller");
const MarketplaceTransaction = require("../models/MarketplaceTransaction");
const User = require("../models/User");
const { config } = require("../config/env");
const { sanitizeMultilineText, sanitizePlainText } = require("./assistant/outputSanitizer");
const { calculateMarketplaceAmounts } = require("./marketplaceFeeService");
const { createPayoutForPaidOrder } = require("./marketplacePayoutService");
const {
  initializeMarketplaceTransaction,
  verifyMarketplaceTransaction,
} = require("./marketplacePaystackService");
const {
  createServiceError,
  toIdString,
} = require("./marketplaceSellerService");
const { validateCheckoutPayload } = require("../validators/marketplaceValidators");

const VALID_FULFILLMENT_STATUSES = new Set([
  "processing",
  "shipped_or_ready",
  "delivered",
  "completed",
  "cancelled",
]);

const mapGatewayFailureStatus = (status = "") => {
  const normalized = String(status || "").trim().toLowerCase();
  if (["ongoing", "pending", "processing"].includes(normalized)) {
    return "pending";
  }
  if (normalized === "abandoned") {
    return "failed";
  }
  return "failed";
};

const resolveMarketplaceReturnUrl = (value = "") => {
  const raw = String(value || "").trim();
  if (/^https?:\/\//i.test(raw)) {
    return raw;
  }
  if (raw.startsWith("/")) {
    return `${config.APP_URL || config.appUrl}${raw}`;
  }
  return `${config.APP_URL || config.appUrl}/marketplace/orders`;
};

const serializeOrderParty = (user = {}) =>
  user
    ? {
        _id: toIdString(user._id),
        name: user.name || "",
        username: user.username || "",
        email: user.email || "",
      }
    : null;

const serializeOrderSeller = (seller = {}) =>
  seller
    ? {
        _id: toIdString(seller._id),
        userId: toIdString(seller.user),
        storeName: seller.storeName || "",
        slug: seller.slug || "",
        fullName: seller.fullName || "",
        state: seller.state || "",
        city: seller.city || "",
      }
    : null;

const serializeOrder = (
  order = {},
  {
    buyer = null,
    seller = null,
    product = null,
    includeBuyer = false,
    includeDelivery = true,
  } = {}
) => ({
  _id: toIdString(order._id),
  buyerId: toIdString(order.buyer?._id || order.buyer),
  sellerId: toIdString(order.seller?._id || order.seller),
  productId: toIdString(order.product?._id || order.product),
  quantity: Number(order.quantity || 0),
  totalPrice: Number(order.totalPrice || 0),
  currency: order.currency || "NGN",
  platformFee: Number(order.platformFee || 0),
  sellerReceivable: Number(order.sellerReceivable || 0),
  paymentProvider: order.paymentProvider || "paystack",
  paymentReference: order.paymentReference || "",
  paystackAccessCode: order.paystackAccessCode || "",
  paymentStatus: order.paymentStatus || "initiated",
  orderStatus: order.orderStatus || "pending",
  deliveryMethod: order.deliveryMethod || "",
  deliveryAddress: includeDelivery ? order.deliveryAddress || "" : "",
  deliveryContactPhone: includeDelivery ? order.deliveryContactPhone || "" : "",
  fulfillmentNotes: order.fulfillmentNotes || "",
  productSnapshot: {
    title: order.productTitle || product?.title || "",
    slug: order.productSlug || product?.slug || "",
    imageUrl: order.productImageUrl || "",
  },
  storeSnapshot: {
    storeName: order.storeName || seller?.storeName || "",
    storeSlug: order.storeSlug || seller?.slug || "",
  },
  seller: serializeOrderSeller(seller || order.seller),
  buyer: includeBuyer ? serializeOrderParty(buyer || order.buyer) : null,
  createdAt: order.createdAt || null,
  updatedAt: order.updatedAt || null,
});

const serializeTransaction = (transaction = {}) => ({
  _id: toIdString(transaction._id),
  orderId: toIdString(transaction.order),
  buyerId: toIdString(transaction.buyer),
  sellerId: toIdString(transaction.seller),
  amount: Number(transaction.amount || 0),
  platformFee: Number(transaction.platformFee || 0),
  sellerReceivable: Number(transaction.sellerReceivable || 0),
  provider: transaction.provider || "paystack",
  reference: transaction.reference || "",
  status: transaction.status || "",
  createdAt: transaction.createdAt || null,
  updatedAt: transaction.updatedAt || null,
});

const resolveCheckoutDependencies = async ({ productId } = {}) => {
  const product = await MarketplaceProduct.findById(productId);
  if (!product) {
    throw createServiceError("Marketplace product not found", 404);
  }

  const seller = await MarketplaceSeller.findById(product.seller);
  if (!seller) {
    throw createServiceError("Marketplace seller not found", 404);
  }

  return { product, seller };
};

const releaseReservedStock = async (order, { markFailed = false } = {}) => {
  if (!order?._id || !order.stockReserved || order.stockReleasedAt) {
    return false;
  }

  const updatedOrder = await MarketplaceOrder.findOneAndUpdate(
    {
      _id: order._id,
      stockReserved: true,
      stockReleasedAt: null,
      paymentStatus: { $ne: "paid" },
    },
    {
      $set: {
        stockReserved: false,
        stockReleasedAt: new Date(),
        ...(markFailed
          ? {
              paymentStatus: "failed",
              orderStatus: "cancelled",
            }
          : {}),
      },
    },
    { new: true }
  );

  if (!updatedOrder) {
    return false;
  }

  await MarketplaceProduct.updateOne(
    { _id: updatedOrder.product },
    { $inc: { stock: Number(updatedOrder.quantity || 0) } }
  );

  return true;
};

const upsertMarketplaceTransaction = async ({ order, verified, status = "" } = {}) =>
  MarketplaceTransaction.findOneAndUpdate(
    { order: order._id },
    {
      $set: {
        order: order._id,
        buyer: order.buyer,
        seller: order.seller,
        amount: Number(order.totalPrice || 0),
        platformFee: Number(order.platformFee || 0),
        sellerReceivable: Number(order.sellerReceivable || 0),
        provider: order.paymentProvider || "paystack",
        reference: order.paymentReference || verified?.reference || "",
        status: status || verified?.status || order.paymentStatus || "",
        rawVerificationSnapshot: verified?.raw || verified || {},
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

const validateVerifiedOrderPayment = ({ order, verified } = {}) => {
  const expectedAmountKobo = Math.round(Number(order?.totalPrice || 0) * 100);
  const verifiedAmountKobo = Number(verified?.amountKobo || 0);
  const expectedCurrency = String(order?.currency || "NGN").trim().toUpperCase();
  const verifiedCurrency = String(verified?.currency || "").trim().toUpperCase();
  const verifiedStatus = String(verified?.status || "").trim().toLowerCase();

  if (verifiedStatus !== "success") {
    return {
      ok: false,
      nextStatus: mapGatewayFailureStatus(verifiedStatus),
      message: `Gateway status is ${verifiedStatus || "unknown"}`,
    };
  }

  if (verifiedAmountKobo !== expectedAmountKobo || verifiedCurrency !== expectedCurrency) {
    return {
      ok: false,
      nextStatus: "failed",
      message: "Payment verification mismatch",
    };
  }

  return {
    ok: true,
    nextStatus: "paid",
    message: "",
  };
};

const markOrderPaid = async ({ order, verified } = {}) => {
  const updatedOrder =
    (await MarketplaceOrder.findOneAndUpdate(
      {
        _id: order._id,
        paymentStatus: { $ne: "paid" },
      },
      {
        $set: {
          paymentStatus: "paid",
          orderStatus: "paid",
          paymentReference: verified?.reference || order.paymentReference || "",
        },
      },
      { new: true }
    )) || (await MarketplaceOrder.findById(order._id));

  if (!updatedOrder) {
    throw createServiceError("Marketplace order not found", 404);
  }

  const transaction = await upsertMarketplaceTransaction({
    order: updatedOrder,
    verified,
    status: "paid",
  });
  const payout = await createPayoutForPaidOrder({ order: updatedOrder });

  return {
    order: updatedOrder,
    transaction,
    payout,
  };
};

const initializeMarketplaceOrder = async ({
  req,
  buyerId,
  payload = {},
} = {}) => {
  const rawProductId = String(payload.productId || "").trim();
  if (!rawProductId) {
    throw createServiceError("productId is required", 400);
  }

  const { product, seller } = await resolveCheckoutDependencies({
    productId: rawProductId,
  });
  const { errors, value } = validateCheckoutPayload({
    payload,
    product,
    seller,
  });

  if (errors.length) {
    throw createServiceError("Checkout validation failed", 400, errors);
  }

  if (String(seller.user || "") === String(buyerId || "")) {
    throw createServiceError("You cannot buy your own marketplace listing", 400);
  }

  const buyer = await User.findById(buyerId).select("_id email name username");
  if (!buyer?.email) {
    throw createServiceError("A valid buyer email is required for Paystack checkout", 400);
  }

  const reservedProduct = await MarketplaceProduct.findOneAndUpdate(
    {
      _id: product._id,
      isPublished: true,
      isHidden: false,
      moderationStatus: "approved",
      stock: { $gte: value.quantity },
    },
    { $inc: { stock: -value.quantity } },
    { new: true }
  );

  if (!reservedProduct) {
    throw createServiceError("This listing no longer has enough stock", 409);
  }

  const amounts = calculateMarketplaceAmounts({
    unitPrice: product.price,
    quantity: value.quantity,
  });

  let order = null;
  try {
    order = await MarketplaceOrder.create({
      buyer: buyer._id,
      seller: seller._id,
      product: product._id,
      quantity: value.quantity,
      totalPrice: amounts.totalPrice,
      currency: product.currency || "NGN",
      platformFee: amounts.platformFee,
      sellerReceivable: amounts.sellerReceivable,
      paymentProvider: "paystack",
      paymentStatus: "initiated",
      orderStatus: "pending",
      deliveryMethod: value.deliveryMethod,
      deliveryAddress: value.deliveryAddress,
      deliveryContactPhone: value.deliveryContactPhone,
      fulfillmentNotes: "",
      productTitle: product.title || "",
      productSlug: product.slug || "",
      productImageUrl:
        product.images?.[0]?.secureUrl ||
        product.images?.[0]?.secure_url ||
        product.images?.[0]?.url ||
        "",
      storeName: seller.storeName || "",
      storeSlug: seller.slug || "",
      stockReserved: true,
    });

    const initialized = await initializeMarketplaceTransaction({
      order,
      buyerEmail: buyer.email,
      callbackUrl: resolveMarketplaceReturnUrl(payload.returnUrl),
      metadata: {
        buyerName: buyer.name || buyer.username || "",
        productTitle: product.title || "",
        storeName: seller.storeName || "",
      },
    });

    order.paymentReference = initialized.paymentReference;
    order.paystackAccessCode = initialized.payment.access_code || "";
    order.paymentStatus = "pending";
    await order.save();

    return {
      order: serializeOrder(order, {
        seller,
        buyer,
        includeBuyer: false,
      }),
      authorizationUrl: initialized.payment.authorization_url || "",
      accessCode: initialized.payment.access_code || "",
      reference: order.paymentReference || "",
    };
  } catch (error) {
    if (order?._id) {
      await releaseReservedStock(order, { markFailed: true }).catch(() => null);
    } else {
      await MarketplaceProduct.updateOne(
        { _id: product._id },
        { $inc: { stock: value.quantity } }
      ).catch(() => null);
    }
    throw error;
  }
};

const reconcileMarketplaceOrder = async ({ order } = {}) => {
  if (!order?._id) {
    throw createServiceError("Marketplace order not found", 404);
  }

  if (String(order.paymentStatus || "").trim().toLowerCase() === "paid") {
    const transaction = await upsertMarketplaceTransaction({
      order,
      verified: {
        reference: order.paymentReference,
        status: "success",
        raw: { idempotent: true },
      },
      status: "paid",
    });
    const payout = await createPayoutForPaidOrder({ order });

    return {
      success: true,
      verified: true,
      order,
      transaction,
      payout,
      message: "Payment already verified",
    };
  }

  const verified = await verifyMarketplaceTransaction(order.paymentReference);
  const match = validateVerifiedOrderPayment({
    order,
    verified,
  });

  if (!match.ok) {
    const updatedOrder =
      (await MarketplaceOrder.findOneAndUpdate(
        {
          _id: order._id,
          paymentStatus: { $ne: "paid" },
        },
        {
          $set: {
            paymentStatus: match.nextStatus,
            ...(match.nextStatus === "failed"
              ? { orderStatus: "cancelled" }
              : {}),
          },
        },
        { new: true }
      )) || (await MarketplaceOrder.findById(order._id));

    if (match.nextStatus === "failed") {
      await releaseReservedStock(updatedOrder || order).catch(() => null);
    }

    const finalOrder = (await MarketplaceOrder.findById(order._id)) || updatedOrder || order;
    const transaction = await upsertMarketplaceTransaction({
      order: finalOrder,
      verified,
      status: match.nextStatus,
    });

    return {
      success: false,
      verified: false,
      order: finalOrder,
      transaction,
      payout: null,
      message: match.message,
    };
  }

  const settled = await markOrderPaid({
    order,
    verified,
  });

  return {
    success: true,
    verified: true,
    order: settled.order,
    transaction: settled.transaction,
    payout: settled.payout,
    message: "Payment verified",
  };
};

const listBuyerOrders = async ({
  buyerId,
  page = 1,
  limit = 20,
  status = "",
} = {}) => {
  const safePage = Math.max(1, Number(page || 1));
  const safeLimit = Math.min(50, Math.max(1, Number(limit || 20)));
  const query = { buyer: buyerId };

  if (status) {
    query.orderStatus = String(status || "").trim().toLowerCase();
  }

  const [rows, total] = await Promise.all([
    MarketplaceOrder.find(query)
      .sort({ createdAt: -1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit)
      .populate("seller")
      .lean(),
    MarketplaceOrder.countDocuments(query),
  ]);

  return {
    page: safePage,
    limit: safeLimit,
    total,
    orders: rows.map((row) =>
      serializeOrder(row, {
        seller: row.seller,
        includeBuyer: false,
        includeDelivery: true,
      })
    ),
  };
};

const listSellerOrders = async ({
  sellerId,
  page = 1,
  limit = 20,
  paymentStatus = "",
  orderStatus = "",
} = {}) => {
  const safePage = Math.max(1, Number(page || 1));
  const safeLimit = Math.min(50, Math.max(1, Number(limit || 20)));
  const query = { seller: sellerId };

  if (paymentStatus) {
    query.paymentStatus = String(paymentStatus || "").trim().toLowerCase();
  }
  if (orderStatus) {
    query.orderStatus = String(orderStatus || "").trim().toLowerCase();
  }

  const [rows, total] = await Promise.all([
    MarketplaceOrder.find(query)
      .sort({ createdAt: -1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit)
      .populate("buyer", "_id name username email")
      .lean(),
    MarketplaceOrder.countDocuments(query),
  ]);

  return {
    page: safePage,
    limit: safeLimit,
    total,
    orders: rows.map((row) =>
      serializeOrder(row, {
        buyer: row.buyer,
        includeBuyer: true,
        includeDelivery: true,
      })
    ),
  };
};

const updateSellerOrderStatus = async ({
  sellerId,
  orderId,
  status,
  notes = "",
} = {}) => {
  const normalizedStatus = String(status || "").trim().toLowerCase();
  if (!VALID_FULFILLMENT_STATUSES.has(normalizedStatus)) {
    throw createServiceError("Invalid marketplace order status", 400);
  }

  const order = await MarketplaceOrder.findOne({
    _id: orderId,
    seller: sellerId,
  }).populate("buyer", "_id name username email");

  if (!order) {
    throw createServiceError("Marketplace order not found", 404);
  }

  if (String(order.paymentStatus || "").trim().toLowerCase() !== "paid") {
    throw createServiceError("Only paid marketplace orders can be fulfilled", 400);
  }

  order.orderStatus = normalizedStatus;
  if (notes) {
    order.fulfillmentNotes = sanitizeMultilineText(notes, 600);
  }
  await order.save();

  return serializeOrder(order, {
    buyer: order.buyer,
    includeBuyer: true,
    includeDelivery: true,
  });
};

const listMarketplaceOrdersForAdmin = async ({
  page = 1,
  limit = 20,
  paymentStatus = "",
  orderStatus = "",
  search = "",
} = {}) => {
  const safePage = Math.max(1, Number(page || 1));
  const safeLimit = Math.min(50, Math.max(1, Number(limit || 20)));
  const query = {};

  if (paymentStatus) {
    query.paymentStatus = String(paymentStatus || "").trim().toLowerCase();
  }
  if (orderStatus) {
    query.orderStatus = String(orderStatus || "").trim().toLowerCase();
  }
  if (search) {
    const needle = sanitizePlainText(search, 120);
    query.$or = [
      { paymentReference: { $regex: needle, $options: "i" } },
      { productTitle: { $regex: needle, $options: "i" } },
      { storeName: { $regex: needle, $options: "i" } },
    ];
  }

  const [rows, total, summaryRows] = await Promise.all([
    MarketplaceOrder.find(query)
      .sort({ createdAt: -1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit)
      .populate("buyer", "_id name username email")
      .populate("seller")
      .lean(),
    MarketplaceOrder.countDocuments(query),
    MarketplaceOrder.aggregate([
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          paidOrders: {
            $sum: {
              $cond: [{ $eq: ["$paymentStatus", "paid"] }, 1, 0],
            },
          },
          grossVolume: { $sum: "$totalPrice" },
          totalFees: { $sum: "$platformFee" },
          totalNet: { $sum: "$sellerReceivable" },
        },
      },
    ]),
  ]);

  return {
    page: safePage,
    limit: safeLimit,
    total,
    summary: {
      totalOrders: Number(summaryRows[0]?.totalOrders || 0),
      paidOrders: Number(summaryRows[0]?.paidOrders || 0),
      grossVolume: Number(summaryRows[0]?.grossVolume || 0),
      totalFees: Number(summaryRows[0]?.totalFees || 0),
      totalNet: Number(summaryRows[0]?.totalNet || 0),
    },
    orders: rows.map((row) =>
      serializeOrder(row, {
        buyer: row.buyer,
        seller: row.seller,
        includeBuyer: true,
        includeDelivery: true,
      })
    ),
  };
};

module.exports = {
  initializeMarketplaceOrder,
  listBuyerOrders,
  listMarketplaceOrdersForAdmin,
  listSellerOrders,
  reconcileMarketplaceOrder,
  releaseReservedStock,
  serializeOrder,
  serializeTransaction,
  updateSellerOrderStatus,
};
