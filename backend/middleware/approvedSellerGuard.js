const MarketplaceSeller = require("../models/MarketplaceSeller");

module.exports = async (req, res, next) => {
  try {
    const seller = await MarketplaceSeller.findOne({ user: req.user?.id });
    if (!seller) {
      return res.status(403).json({ error: "Marketplace seller profile required" });
    }

    if (seller.status !== "approved" || !seller.isActive) {
      return res.status(403).json({ error: "Only approved sellers can manage marketplace listings" });
    }

    req.marketplaceSeller = seller;
    return next();
  } catch (error) {
    return next(error);
  }
};
