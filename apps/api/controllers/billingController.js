const ApiError = require("../utils/ApiError");
const paymentService = require("../services/paymentService");

const notImplemented = (label, currency) => {
  const provider = paymentService.selectProvider(currency);
  throw ApiError.serviceUnavailable(`${label} via ${provider} is not implemented yet`, {
    provider,
    currency,
  });
};

exports.subscribe = async (req, res) => {
  notImplemented("Billing subscribe", req.body.currency);
};

exports.purchase = async (req, res) => {
  notImplemented("Billing purchase", req.body.currency);
};
