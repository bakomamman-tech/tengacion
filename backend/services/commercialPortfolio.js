const config = require("../config/commercialRoadmap");
function buildCommercialPortfolio(records = [], {truncated = false} = {}) {
  return ["capital", "distribution", "revenue"].map(cycle => {
    const rows = records.filter(row => row.packageKey?.startsWith(cycle.toUpperCase() + "-") && config.kinds[row.packageKey]);
    const scorecards = rows.filter(row => row.commercialAnalysis?.kind === "scorecard");
    const candidateKeys = cycle === "distribution" ? config.channels : cycle === "revenue" ? config.revenueLines : [];
    const dimension = cycle === "distribution" ? "channel" : "revenueLine";
    const reviewedCandidates = new Set(scorecards.filter(row => row.readiness === "ready").map(row => row.commercial?.[dimension]));
    const missingCandidates = candidateKeys.filter(key => !reviewedCandidates.has(key));
    const ranking = scorecards.map(row => ({recordId: row.id, subject: row.commercial?.subject,
      candidate: row.commercial?.[dimension], reviewed: row.readiness === "ready",
      score: row.readiness === "ready" ? row.commercialAnalysis.score : null,
      blockers: row.blockers || []})).sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || String(a.subject).localeCompare(String(b.subject)));
    return {cycle, records: rows.length, reviewedRecords: rows.filter(row => row.readiness === "ready").length,
      inventoryComplete: !truncated && missingCandidates.length === 0 && rows.length > 0, missingCandidates, ranking,
      pilots: rows.filter(row => ["pilot", "scale_decision"].includes(row.commercialAnalysis?.kind)).map(row => ({
        recordId: row.id, subject: row.commercial?.subject, channel: row.commercial?.channel, revenueLine: row.commercial?.revenueLine,
        requestedState: row.commercialAnalysis.requestedState,
        effectiveState: row.readiness === "ready" ? row.commercialAnalysis.effectiveState : "not_ready",
        decision: row.commercial?.decision || null, currency: row.commercial?.currency || null,
        budgetLimit: row.commercial?.budgetLimit ?? null, spendToDate: row.commercial?.spendToDate ?? null,
        reviewAt: row.commercial?.reviewAt, blockers: row.blockers || [],
      })),
      limitations: truncated ? ["Inventory truncated; no complete portfolio or scale conclusion is available."] : [],
      spendingAuthorized: false};
  });
}
module.exports = {buildCommercialPortfolio};