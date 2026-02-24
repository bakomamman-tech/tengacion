const ApiError = require("../utils/ApiError");
const { config } = require("../config/env");

const CURRENCY_MAP = {
  NGN: "paystack",
  USD: "stripe",
};

const getProviderName = (currency) => {
  if (!currency) {
    return config.PAYSTACK_CURRENCY;
  }
  return CURRENCY_MAP[currency.toUpperCase()] || "stripe";
};

const PaymentService = {
  selectProvider(currency) {
    return getProviderName(currency);
  },

  async createPaymentIntent(payload = {}) {
    const provider = PaymentService.selectProvider(payload.currency);
    throw ApiError.serviceUnavailable(
      `${provider} payment intent is not implemented yet`,
      { payload }
    );
  },

  async createSubscription(payload = {}) {
    const provider = PaymentService.selectProvider(payload.currency);
    throw ApiError.serviceUnavailable(
      `${provider} subscription flow is not implemented yet`,
      { payload }
    );
  },
};

module.exports = PaymentService;
