const ApiError = require("../utils/ApiError");
const { config } = require("../config/env");
const {
  initializePaystackCheckout,
  toLegacyCheckoutPayload,
  toPurchasePayload,
} = require("../../../backend/services/paymentOpsService");

const CURRENCY_MAP = {
  NGN: "paystack",
  USD: "stripe",
};

const getProviderName = (currency) => {
  const normalizedCurrency = String(currency || config.PAYSTACK_CURRENCY || "NGN")
    .trim()
    .toUpperCase();
  return CURRENCY_MAP[normalizedCurrency] || "stripe";
};

const normalizeCheckoutPayload = (payload = {}) => {
  const itemType = String(
    payload.productType || payload.itemType || payload.type || payload.contentType || ""
  ).trim();
  const itemId = String(
    payload.productId || payload.itemId || payload.contentId || payload.creatorId || ""
  ).trim();

  return {
    req: payload.req || null,
    userId: payload.userId,
    productType: itemType,
    productId: itemId,
    returnUrl: payload.returnUrl || payload.callbackUrl || "",
    currencyMode: payload.currencyMode || "NG",
    actorRole: payload.actorRole || "",
  };
};

const assertPaystackSupported = (payload = {}) => {
  const provider = PaymentService.selectProvider(payload.currency);
  if (provider !== "paystack") {
    throw ApiError.serviceUnavailable(
      `${provider} checkout is not available on this commerce path yet`
    );
  }
};

const createPaystackCheckout = async (payload = {}) => {
  assertPaystackSupported(payload);
  const checkoutPayload = normalizeCheckoutPayload(payload);
  if (!checkoutPayload.userId) {
    throw ApiError.badRequest("Authenticated user is required for checkout");
  }
  if (!checkoutPayload.productType || !checkoutPayload.productId) {
    throw ApiError.badRequest("productType and productId are required");
  }

  const checkout = await initializePaystackCheckout(checkoutPayload);
  return {
    purchase: toPurchasePayload(checkout.purchase),
    checkout: toLegacyCheckoutPayload({
      purchase: checkout.purchase,
      payment: checkout.payment,
      currencyMode: checkoutPayload.currencyMode,
    }),
    payment: checkout.payment,
    item: checkout.item,
  };
};

const PaymentService = {
  selectProvider(currency) {
    return getProviderName(currency);
  },

  async createPaymentIntent(payload = {}) {
    return createPaystackCheckout(payload);
  },

  async createSubscription(payload = {}) {
    return createPaystackCheckout({
      ...payload,
      productType: "subscription",
      itemType: "subscription",
    });
  },
};

module.exports = PaymentService;
