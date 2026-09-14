const {revenueFromRows} = require("../services/commercialEvidenceService");
const {buildFanRetentionCohortsFromRows} = require("../services/fanRetentionCohortService");
test("revenue evidence separates currencies, categories and non-paid states", () => {
  const paid = {status: "paid", amount: 100, currency: "NGN", revenueCategory: "music", itemType: "track", creatorShareRate: 0.8, platformShareRate: 0.2};
  const rows = revenueFromRows([paid, {...paid, currency: "USD"}, {...paid, status: "refunded"}, {...paid, status: "failed"}, {...paid, status: "pending"}]);
  const ngn = rows.find(row => row.currency === "NGN");
  expect(ngn).toMatchObject({paidOrders: 1, grossPaidAmount: 100, platformRevenueEstimate: 20, creatorEarningsEstimate: 80, refundedOrders: 1, failedOrders: 1, pendingOrders: 1, refundRate: 0.5, approvedForExternalUse: false});
  expect(rows.find(row => row.currency === "USD").grossPaidAmount).toBe(100);
});
test("missing or contradictory stored rates produce unknown earnings", () => {
  const base = {status: "paid", amount: 100, currency: "NGN", revenueCategory: "music"};
  expect(revenueFromRows([base])[0]).toMatchObject({missingShareRates: 1, creatorEarningsEstimate: null, platformRevenueEstimate: null});
  expect(revenueFromRows([{...base, creatorShareRate: 0.9, platformShareRate: 0.9}])[0].platformRevenueEstimate).toBeNull();
});
test("live aggregates expose no supplied actor identifiers or private fields", () => {
  const result = revenueFromRows([{status: "paid", amount: 1, currency: "NGN", userId: "private-actor-123", providerRef: "private-ref-456", metadata: {secret: "private-data"}}]);
  expect(JSON.stringify(result)).not.toMatch(/private-|userId|providerRef|metadata/);
});
test("D14 retention waits for the complete day-14 window and excludes its upper boundary", () => {
  const start = new Date("2026-01-01T00:00:00Z");
  const day = 86400000;
  const args = {eventRows: [
    {userId: "fan-a", type: "creator_followed", createdAt: start},
    {userId: "fan-a", type: "session_returned", createdAt: new Date(+start + 14.5 * day)},
    {userId: "fan-b", type: "creator_followed", createdAt: start},
    {userId: "fan-b", type: "session_returned", createdAt: new Date(+start + 15 * day)},
  ], purchaseRows: [], users: [], start, end: new Date(+start + 16 * day)};
  const partial = buildFanRetentionCohortsFromRows({...args, observedThrough: new Date(+start + 14.75 * day)});
  expect(partial.summary.d14Eligible).toBe(0);
  const full = buildFanRetentionCohortsFromRows({...args, observedThrough: new Date(+start + 15 * day)});
  expect(full.summary).toMatchObject({d14Eligible: 2, d14Returned: 1, d14RetentionRate: 0.5});
});
const {buildCommercialPortfolio} = require("../services/commercialPortfolio");
test("portfolio ranks reviewed candidates only and exposes missing inventory", () => {
  const row = {id: "scorecard-1", packageKey: "DISTRIBUTION-001", readiness: "ready", blockers: [], commercial: {subject: "Reviewed", channel: "organic_creator"},
    commercialAnalysis: {kind: "scorecard", score: 20}};
  const draft = {...row, id: "scorecard-2", readiness: "evidence_needed", commercial: {subject: "Unreviewed", channel: "fan_referral"},
    commercialAnalysis: {kind: "scorecard", score: 60}};
  const portfolio = buildCommercialPortfolio([draft, row]).find(item => item.cycle === "distribution");
  expect(portfolio.ranking.map(item => item.score)).toEqual([20, null]);
  expect(portfolio.missingCandidates).toContain("fan_referral");
  expect(portfolio.missingCandidates).not.toContain("organic_creator");
  expect(portfolio.inventoryComplete).toBe(false);
});
test("dependency-blocked pilots never appear active in the portfolio", () => {
  const rows = [{id: "pilot-1", packageKey: "REVENUE-007", readiness: "evidence_needed", blockers: ["dependency_blocked"],
    commercial: {subject: "Pilot", currency: "NGN", budgetLimit: 100, spendToDate: 0},
    commercialAnalysis: {kind: "pilot", requestedState: "active_pilot", effectiveState: "active_pilot"}}];
  const portfolio = buildCommercialPortfolio(rows, {truncated: true}).find(item => item.cycle === "revenue");
  expect(portfolio.pilots[0].effectiveState).toBe("not_ready");
  expect(portfolio.inventoryComplete).toBe(false);
  expect(portfolio.limitations.length).toBeGreaterThan(0);
});