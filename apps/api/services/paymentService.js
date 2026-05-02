const ApiError = require("../utils/ApiError");
const { config } = require("../config/env");
const {
  initializeCheckout,
  resolveCheckoutCurrency,
  selectProviderForCurrency,
  toLegacyCheckoutPayload,
  toPurchasePayload,
} = require("../../../backend/services/paymentOpsService");

const getProviderName = ({ currency = "", currencyMode = "" } = {}) =>
  selectProviderForCurrency(resolveCheckoutCurrency({ currency, currencyMode }));

const normalizeCheckoutPayload = (payload = {}) => {
  const itemType = String(
    payload.productType || payload.itemType || payload.type || payload.contentType || ""
  ).trim();
  const itemId = String(
    payload.productId || payload.itemId || payload.contentId || payload.creatorId || ""
  ).trim();
  const currency = String(payload.currency || config.PAYSTACK_CURRENCY || "NGN")
    .trim()
    .toUpperCase();

  return {
    req: payload.req || null,
    userId: payload.userId,
    productType: itemType,
    productId: itemId,
    returnUrl: payload.returnUrl || payload.callbackUrl || "",
    currency,
    currencyMode: payload.currencyMode || (currency === "USD" ? "GLOBAL" : "NG"),
    actorRole: payload.actorRole || "",
  };
};

const createProviderCheckout = async (payload = {}) => {
  const checkoutPayload = normalizeCheckoutPayload(payload);
  if (!checkoutPayload.userId) {
    throw ApiError.badRequest("Authenticated user is required for checkout");
  }
  if (!checkoutPayload.productType || !checkoutPayload.productId) {
    throw ApiError.badRequest("productType and productId are required");
  }

  const checkout = await initializeCheckout(checkoutPayload);
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
  selectProvider(currency, currencyMode = "") {
    if (typeof currency === "object" && currency !== null) {
      return getProviderName(currency);
    }
    return getProviderName({ currency, currencyMode });
  },

  async createPaymentIntent(payload = {}) {
    return createProviderCheckout(payload);
  },

  async createSubscription(payload = {}) {
    return createProviderCheckout({
      ...payload,
      productType: "subscription",
      itemType: "subscription",
    });
  },
};

module.exports = PaymentService;
