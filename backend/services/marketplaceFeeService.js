const PLATFORM_FEE_NGN = 300;

const roundMoney = (value) => Math.round(Number(value || 0));

const assertListingPrice = (price) => {
  const normalized = roundMoney(price);
  if (!Number.isFinite(normalized) || normalized < PLATFORM_FEE_NGN) {
    const error = new Error("Marketplace listing price must be at least NGN 300");
    error.status = 400;
    throw error;
  }
  return normalized;
};

const calculateMarketplaceAmounts = ({ unitPrice, quantity = 1 } = {}) => {
  const safeQuantity = Math.max(1, Number.parseInt(String(quantity || 1), 10) || 1);
  const normalizedUnitPrice = assertListingPrice(unitPrice);
  const totalPrice = roundMoney(normalizedUnitPrice * safeQuantity);
  const platformFee = PLATFORM_FEE_NGN;
  const sellerReceivable = Math.max(0, roundMoney(totalPrice - platformFee));

  return {
    unitPrice: normalizedUnitPrice,
    quantity: safeQuantity,
    buyerPays: totalPrice,
    totalPrice,
    platformFee,
    sellerReceivable,
  };
};

module.exports = {
  PLATFORM_FEE_NGN,
  assertListingPrice,
  calculateMarketplaceAmounts,
};
