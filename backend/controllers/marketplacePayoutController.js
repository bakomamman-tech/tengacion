const asyncHandler = require("../middleware/asyncHandler");
const {
  getSellerPayoutSummary,
  listSellerPayouts,
} = require("../services/marketplacePayoutService");

exports.getMyPayoutHistory = asyncHandler(async (req, res) => {
  const [history, summary] = await Promise.all([
    listSellerPayouts(req.marketplaceSeller._id, {
      page: req.query.page || 1,
      limit: req.query.limit || 20,
    }),
    getSellerPayoutSummary(req.marketplaceSeller._id),
  ]);

  return res.json({
    ...history,
    summary,
  });
});

exports.getMyPayoutSummary = asyncHandler(async (req, res) => {
  const summary = await getSellerPayoutSummary(req.marketplaceSeller._id);
  return res.json({ summary });
});
