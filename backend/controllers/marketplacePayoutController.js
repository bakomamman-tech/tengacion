const asyncHandler = require("../middleware/asyncHandler");
const {
  getSellerPayoutSummary,
  listSellerPayouts,
} = require("../services/marketplacePayoutService");
const {
  createSellerWithdrawal,
  listSellerWithdrawals,
} = require("../services/withdrawalService");

exports.getMyPayoutHistory = asyncHandler(async (req, res) => {
  const [history, summary, withdrawalHistory] = await Promise.all([
    listSellerPayouts(req.marketplaceSeller._id, {
      page: req.query.page || 1,
      limit: req.query.limit || 20,
    }),
    getSellerPayoutSummary(req.marketplaceSeller._id),
    listSellerWithdrawals({
      sellerId: req.marketplaceSeller._id,
      page: req.query.withdrawalPage || 1,
      limit: req.query.withdrawalLimit || 10,
    }),
  ]);

  return res.json({
    ...history,
    summary,
    withdrawalSummary: withdrawalHistory.summary,
    withdrawals: withdrawalHistory.withdrawals,
  });
});

exports.getMyPayoutSummary = asyncHandler(async (req, res) => {
  const [summary, withdrawalHistory] = await Promise.all([
    getSellerPayoutSummary(req.marketplaceSeller._id),
    listSellerWithdrawals({
      sellerId: req.marketplaceSeller._id,
      page: 1,
      limit: 1,
    }),
  ]);
  return res.json({ summary, withdrawalSummary: withdrawalHistory.summary });
});

exports.getMyWithdrawals = asyncHandler(async (req, res) => {
  const payload = await listSellerWithdrawals({
    sellerId: req.marketplaceSeller._id,
    page: req.query.page || 1,
    limit: req.query.limit || 20,
  });

  return res.json(payload);
});

exports.withdrawMyPayout = asyncHandler(async (req, res) => {
  const payload = await createSellerWithdrawal({
    seller: req.marketplaceSeller,
    userId: req.user.id,
    amount: req.body?.amount,
    currency: req.body?.currency || "NGN",
  });

  return res.status(201).json({
    success: true,
    ...payload,
  });
});
