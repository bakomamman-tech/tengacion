const paymentService = require("../services/paymentService");

const buildCheckoutResponse = ({ result, kind }) => {
  const checkout = result.checkout || {};
  return {
    success: true,
    kind,
    purchase: result.purchase,
    payment: result.payment || {},
    ...checkout,
  };
};

exports.subscribe = async (req, res) => {
  const result = await paymentService.createSubscription({
    ...req.body,
    req,
    userId: req.user.id,
    actorRole: req.user?.role || "user",
    productId: req.body?.creatorId || req.body?.itemId || req.body?.productId,
  });

  return res.status(201).json(buildCheckoutResponse({ result, kind: "subscription" }));
};

exports.purchase = async (req, res) => {
  const result = await paymentService.createPaymentIntent({
    ...req.body,
    req,
    userId: req.user.id,
    actorRole: req.user?.role || "user",
  });

  return res.status(201).json(buildCheckoutResponse({ result, kind: "purchase" }));
};
