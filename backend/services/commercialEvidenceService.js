const Purchase = require("../models/Purchase");
const ReferralAttribution = require("../models/ReferralAttribution");
const { buildFanRetentionCohorts } = require("./fanRetentionCohortService");
const { buildReferralReporting } = require("./expansionPlatformOperatingService");
const LIMIT = 10000;
function revenueFromRows(rows = []) {
  const groups = new Map();
  for (const row of rows) {
    const currency = /^[A-Z]{3}$/.test(row.currency || "") ? row.currency : "unknown";
    const category = ["music", "books", "podcasts", "subscriptions", "other"].includes(row.revenueCategory) ? row.revenueCategory : "unclassified";
    const key = currency + ":" + category;
    if (!groups.has(key)) groups.set(key, {currency, category, paidOrders: 0, failedOrders: 0, pendingOrders: 0,
      refundedOrders: 0, subscriptionOrders: 0, scheduledCancellations: 0, grossPaidAmount: 0, refundedAmount: 0,
      creatorEarningsEstimate: 0, platformRevenueEstimate: 0, missingShareRates: 0, missingAmounts: 0});
    const group = groups.get(key);
    if (row.status === "failed") group.failedOrders++;
    if (["initiated", "pending", "abandoned"].includes(row.status)) group.pendingOrders++;
    const amountKnown = typeof row.amount === "number" && Number.isFinite(row.amount) && row.amount >= 0;
    if (!amountKnown) group.missingAmounts++;
    if (row.status === "refunded") {
      group.refundedOrders++;
      if (amountKnown) group.refundedAmount += row.amount;
    }
    if (row.status !== "paid") continue;
    group.paidOrders++;
    if (row.itemType === "subscription") group.subscriptionOrders++;
    if (row.cancelAtPeriodEnd) group.scheduledCancellations++;
    if (amountKnown) group.grossPaidAmount += row.amount;
    const rates = [row.creatorShareRate, row.platformShareRate];
    if (amountKnown && rates.every(rate => typeof rate === "number" && Number.isFinite(rate) && rate >= 0 && rate <= 1) && Math.abs(rates[0] + rates[1] - 1) < 0.000001) {
      group.creatorEarningsEstimate += row.amount * row.creatorShareRate;
      group.platformRevenueEstimate += row.amount * row.platformShareRate;
    } else group.missingShareRates++;
  }
  return [...groups.values()].map(group => ({...group,
    grossPaidAmount: group.missingAmounts ? null : group.grossPaidAmount,
    refundedAmount: group.missingAmounts ? null : group.refundedAmount,
    creatorEarningsEstimate: group.missingShareRates ? null : group.creatorEarningsEstimate,
    platformRevenueEstimate: group.missingShareRates ? null : group.platformRevenueEstimate,
    shareEstimateBasis: "Purchase amount times stored share rate; excludes ledger reconciliation, fees, tax adjustments, and disputes.",
    refundRate: group.paidOrders + group.refundedOrders > 0 ? group.refundedOrders / (group.paidOrders + group.refundedOrders) : null,
    approvedForExternalUse: false}));
}
async function buildCommercialEvidence({now = new Date()} = {}) {
  const start = new Date(+now - 90 * 86400000);
  const [purchases, referrals, retention] = await Promise.all([
    Purchase.find({createdAt: {$gte: start, $lte: now}}).select("amount currency revenueCategory status itemType creatorShareRate platformShareRate cancelAtPeriodEnd")
      .sort({createdAt: -1, _id: -1}).limit(LIMIT + 1).lean(),
    ReferralAttribution.find({createdAt: {$lte: now}}).select("sourceType counters status").sort({createdAt: -1, _id: -1}).limit(LIMIT + 1).lean(),
    buildFanRetentionCohorts({range: "90d", observedThrough: now}),
  ]);
  const referralReport = buildReferralReporting(referrals.slice(0, LIMIT));
  return {generatedAt: now, period: {start, end: now}, revenue: revenueFromRows(purchases.slice(0, LIMIT)),
    referrals: {summary: referralReport.summary, bySource: referralReport.bySource.map(({sourceType, links, linkOpened, signup, firstFollow, firstPreview, firstPurchase, firstSubscription, d7Return}) => ({sourceType, links, linkOpened, signup, firstFollow, firstPreview, firstPurchase, firstSubscription, d7Return})), scope: "All-time counters on retained referral records; milestones may overlap."},
    retention: {summary: retention.summary, cohorts: retention.cohorts, window: retention.window, dataQuality: retention.dataQuality},
    completeness: {complete: purchases.length <= LIMIT && referrals.length <= LIMIT && retention.dataQuality.complete,
      purchaseRowsTruncated: purchases.length > LIMIT, referralRowsTruncated: referrals.length > LIMIT, rowLimit: LIMIT},
    gaps: ["Purchase cohort uses creation time and current status, not an accounting-period ledger.",
      "Channel, partner, city, sponsor, and bundle joins are not yet available for purchase revenue.",
      "Source-attributed D1/D7/D14/D30 retention requires additional attribution instrumentation.",
      "Dispute reserves, realized margin, acquisition cost and payout exposure require reconciled finance evidence."],
    actorRowsExposed: false, externalUseApproved: false};
}
module.exports = {revenueFromRows, buildCommercialEvidence};