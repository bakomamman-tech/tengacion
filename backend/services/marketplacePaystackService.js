const {
  generatePaymentReference,
  initializeTransaction,
  validateWebhookSignature,
  verifyTransaction,
} = require("./paystackService");

const initializeMarketplaceTransaction = async ({
  order,
  buyerEmail,
  callbackUrl = "",
  metadata = {},
} = {}) => {
  if (!order?._id) {
    throw new Error("Marketplace order is required");
  }
  if (!buyerEmail) {
    throw new Error("Buyer email is required");
  }

  const reference = order.paymentReference || generatePaymentReference("marketplace");
  const payment = await initializeTransaction({
    email: buyerEmail,
    amountNgn: Number(order.totalPrice || 0),
    reference,
    callbackUrl,
    metadata: {
      app: "tengacion_marketplace",
      orderId: order._id.toString(),
      buyerId: String(order.buyer || ""),
      sellerId: String(order.seller || ""),
      productId: String(order.product || ""),
      ...metadata,
    },
  });

  return {
    paymentReference: payment.reference || reference,
    payment,
  };
};

module.exports = {
  initializeMarketplaceTransaction,
  validateMarketplaceWebhookSignature: validateWebhookSignature,
  verifyMarketplaceTransaction: verifyTransaction,
};
