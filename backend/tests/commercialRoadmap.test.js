const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const Record = require("../models/ExternalReadinessRecord");
const User = require("../models/User");
const catalog = require("../config/commercialRoadmapPackages.json");
const config = require("../config/commercialRoadmap");
const service = require("../services/externalReadinessService");
const { analyzeCommercialWorkflow: analyze } = require("../services/commercialWorkflowAnalysis");
const now = new Date();
const past = new Date(+now - 86400000);
const future = new Date(+now + 86400000 * 7);
function fixture(key = "DISTRIBUTION-001") {
  const spec = catalog.find(item => item.key === key);
  const owner = new mongoose.Types.ObjectId();
  const linked = key => ({key, value: "Reviewed operating evidence", evidenceIndexes: [0]});
  const row = {packageKey: key, title: spec.title, owner, createdBy: owner, lastChangedBy: owner,
    domain: "external_reporting", scope: "Internal scoped review", dueAt: future, expiresAt: future, status: "draft",
    evidence: [{source: "Controlled source", summary: "Observed pilot evidence", observedAt: past, expiresAt: future, confidence: "current"}],
    responses: spec.requirements.flatMap((text, index) => text.endsWith(":") ? [] : [{index, response: "Reviewed evidence", evidenceIndexes: [0]}]),
    audience: "internal", dependencies: [], findingIds: [], relatedControlKeys: [],
    commercial: {subject: "Scoped pilot", hypothesis: "Repeat value with bounded cost", state: "research", reviewAt: future,
      rollbackTrigger: "Pause when evidence weakens", currency: "NGN", budgetLimit: 1000, spendToDate: 0,
      periodStart: past, periodEnd: now, channel: "organic_creator", revenueLine: "paid_tracks",
      decision: "continue_pilot", learning: "Observe retention before expansion",
      scores: config.dimensions.map(key => ({key, value: 3, evidenceIndexes: [0]})),
      gates: config.controls.map(key => ({key, status: "pass", evidenceIndexes: [0]})),
      details: config.detailFields[spec.workflowKind].map(linked),
      acceptance: spec.acceptanceCriteria.map((_, index) => linked(String(index))),
      steps: [{key: "Review follow-up", owner: "Operating owner", dueAt: future, status: "pending", evidenceIndexes: []}],
      metrics: (config.requiredMetrics[spec.workflowKind] || []).map(key => ({key, value: key === "evaluated_workflows" ? 10 : key === "maximum_price" ? 20 : 1,
        unit: "count", confidence: "actual", observedAt: now, evidenceIndexes: [0]})), thresholds: []}};
  if (spec.workflowKind === "pricing") row.commercial.metrics.find(x => x.key === "minimum_price").value = 0;
  return row;
}
test.each(catalog.map(item => item.key))("%s has a durable, evidence-linked software workflow", async key => {
  const row = fixture(key);
  await expect(new Record(row).validate()).resolves.toBeUndefined();
  expect(analyze(row, now).blockers).toEqual([]);
  expect(analyze(row, now).reviewedRecordAvailable).toBe(false);
  for (const authority of ["outreachAuthorized", "spendingAuthorized", "moneyMovementAuthorized", "publicationAuthorized"]) expect(analyze(row, now)[authority]).toBe(false);
});
test("catalog preserves 40 exact source contracts and unique identifiers", () => {
  const fs = require("fs"), path = require("path");
  expect(catalog).toHaveLength(40);
  expect(new Set(catalog.map(item => item.key)).size).toBe(40);
  for (const item of catalog) {
    const source = fs.readFileSync(path.join(__dirname, "../..", item.source), "utf8");
    expect(source).toContain(item.title);
    expect(item.acceptanceCriteria.length).toBeGreaterThan(0);
    item.requirements.forEach(requirement => expect(source).toContain(requirement));
  }
});
test.each(["expired", "future", "estimated", "disputed", "missing"])("%s evidence blocks workflow readiness", state => {
  const row = fixture();
  if (state === "expired") row.evidence[0].expiresAt = past;
  else if (state === "future") row.evidence[0].observedAt = future;
  else if (state === "missing") row.evidence = [];
  else row.evidence[0].confidence = state;
  expect(analyze(row, now).blockers).toContain("commercial_detail_required:candidate_inventory");
});
test("invalid evidence links and duplicate metrics cannot persist", async () => {
  const row = fixture(); row.commercial.details[0].evidenceIndexes = [9];
  await expect(new Record(row).validate()).rejects.toThrow("in range");
  const other = fixture("REVENUE-010"); other.commercial.metrics.push(other.commercial.metrics[0]);
  await expect(new Record(other).validate()).rejects.toThrow("unique");
});
test("active pilots require every operating gate and measured stop-loss", () => {
  const row = fixture("REVENUE-007"); row.commercial.state = "active_pilot"; row.commercial.gates = [];
  expect(analyze(row, now).effectiveState).toBe("not_ready");
  expect(analyze(row, now).blockers).toEqual(expect.arrayContaining(["commercial_stop_loss_required", ...config.controls.map(key => "commercial_control_hold:" + key)]));
});
test("budget breaches and unknown threshold metrics hold expansion", () => {
  const row = fixture(); row.commercial.spendToDate = 1001;
  row.commercial.thresholds = [{key: "d7_retention", direction: "minimum", value: 0.2}];
  expect(analyze(row, now).blockers).toEqual(expect.arrayContaining(["commercial_budget_exceeded", "commercial_threshold_unmeasured:d7_retention"]));
});
test("actual breached threshold blocks review, estimates cannot pass it", () => {
  const row = fixture();
  row.commercial.metrics = [{key: "refund_rate", value: 0.2, unit: "ratio", confidence: "actual", observedAt: now, evidenceIndexes: [0]}];
  row.commercial.thresholds = [{key: "refund_rate", direction: "maximum", value: 0.1}];
  expect(analyze(row, now).blockers).toContain("commercial_stop_loss:refund_rate");
  row.commercial.metrics[0].confidence = "estimated";
  expect(analyze(row, now).thresholdResults[0].state).toBe("unknown");
});
test("discounts cannot push a proposed price below its floor", () => {
  const row = fixture("REVENUE-002");
  const values = {minimum_price: 10, maximum_price: 20, proposed_price: 10, maximum_discount_percent: 25, discount_percent: 25};
  row.commercial.metrics.forEach(item => {item.value = values[item.key];});
  expect(analyze(row, now).pricing.effectivePrice).toBe(7.5);
  expect(analyze(row, now).blockers).toContain("commercial_price_outside_guardrails");
});
test("unknown costs remain unknown and GMV is never added to platform revenue", () => {
  const row = fixture("REVENUE-010");
  row.commercial.metrics.find(x => x.key === "platform_revenue").value = 100;
  row.commercial.metrics.find(x => x.key === "gmv").value = 1000;
  expect(analyze(row, now).economics.contribution).toBe(92);
  row.commercial.metrics = row.commercial.metrics.filter(x => x.key !== "support_cost");
  expect(analyze(row, now).economics.contribution).toBeNull();
});
test("AI ratios require a real sample and contain numerator overflow", () => {
  const row = fixture("REVENUE-018");
  row.commercial.metrics.find(x => x.key === "helpful_workflows").value = 11;
  expect(analyze(row, now).blockers).toContain("commercial_ai_count_invalid:helpful_workflows");
  row.commercial.metrics.find(x => x.key === "evaluated_workflows").value = 0;
  expect(analyze(row, now).ai.helpfulRate).toBeNull();
});
test("workflow data is rejected on unrelated packages", async () => {
  const row = fixture(); row.packageKey = "CERTIFICATION-004";
  await expect(new Record(row).validate()).rejects.toThrow("not supported");
});
describe("database-backed commercial review", () => {
  let mongo, owner, reviewer;
  beforeAll(async () => {
    mongo = await MongoMemoryServer.create(); await mongoose.connect(mongo.getUri());
    owner = await User.create({name: "Commercial Owner", username: "commercial-owner", email: "commercial-owner@example.com", password: "HashForTest123!", role: "admin"});
    reviewer = await User.create({name: "Independent Reviewer", username: "commercial-reviewer", email: "commercial-reviewer@example.com", password: "HashForTest123!", role: "admin"});
  });
  afterAll(async () => {await mongoose.disconnect(); if(mongo) await mongo.stop();});
  test("round trip, independent review, revision invalidation, stale version and report", async () => {
    const base = fixture(); const {createdBy, lastChangedBy, status, ...body} = base;
    void createdBy; void lastChangedBy; void status;
    let row = await service.saveDraft({actor: owner._id, body: {...body, owner: owner._id, reason: "Create operating scorecard"}});
    const transition = (action, actor = owner._id) => service.transition({recordId: row._id, actor, body: {action, reason: "Review evidence", notes: "Current independent evidence", version: row.__v, outcome: "pass"}});
    row = await transition("attest"); row = await transition("submit");
    await expect(transition("approve")).rejects.toThrow();
    row = await transition("approve", reviewer._id);
    const report = await service.report();
    expect(report.records.find(item => item.id === String(row._id)).commercialAnalysis.reviewedRecordAvailable).toBe(true);
    await Record.updateOne({_id: row._id}, {$set: {expiresAt: past}});
    const expiredReport = await service.report();
    expect(expiredReport.records.find(item => item.id === String(row._id)).commercialAnalysis).toMatchObject({reviewedRecordAvailable: false, effectiveState: 'not_ready'});
    await Record.updateOne({_id: row._id}, {$set: {expiresAt: future}});
    const originalVersion = row.__v;
    row = await service.saveDraft({recordId: row._id, actor: owner._id, body: {version: row.__v, reason: "Revise hypothesis", commercial: {...row.commercial, hypothesis: "New hypothesis"}}});
    expect(row.status).toBe("draft"); expect(analyze(row).reviewedRecordAvailable).toBe(false);
    const revision = await require('../models/CommercialWorkflowRevision').findOne({record: row._id, version: originalVersion}).lean();
    expect(revision.snapshot.commercial.hypothesis).toBe('Repeat value with bounded cost');
    await expect(service.saveDraft({recordId: row._id, actor: owner._id, body: {version: originalVersion, reason: "Stale client", title: "Overwrite"}})).rejects.toMatchObject({status: 409});
  });
  test("capital outreach requires canonical path and packet records", async () => {
    const blockers = await service.blockersFor(fixture("CAPITAL-012"));
    expect(blockers).toEqual(expect.arrayContaining(["commercial_dependency_required:CAPITAL-011", "commercial_dependency_required:CAPITAL-006"]));
  });
});
test('capital model revisions require allocation gates and matching currencies', async () => {
  const row = fixture('CAPITAL-013');
  row.financial = {scenario: 'base', currency: 'NGN', inputs: service.FINANCIAL_KEYS.map(key => ({key, value: 100, confidence: 'actual', source: 'Reviewed monthly model', period: '2026-09'}))};
  expect(service.localBlockers(row)).toContain('allocation_gates_missing');
  expect(service.localBlockers(row)).toContain('model_revision_decision_and_reversal_required');
  row.allocation = {minimum: 20, maximum: 10, currency: 'NGN'};
  await expect(new Record(row).validate()).rejects.toThrow('minimum cannot exceed maximum');
  row.allocation = {minimum: 0, maximum: 10, currency: 'USD'};
  await expect(new Record(row).validate()).rejects.toThrow('currencies must match');
});
