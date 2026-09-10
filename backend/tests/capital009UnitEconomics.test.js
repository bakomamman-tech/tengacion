const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const express = require("express");
const request = require("supertest");
jest.mock("../middleware/auth", () => (req, res, next) => {
  if (!req.headers["x-user"]) return res.status(401).json({ error: "Unauthorized" });
  req.user = { id: req.headers["x-user"], role: req.headers["x-role"] || "user" }; next();
});
const service = require("../services/externalReadinessService");
const Record = require("../models/ExternalReadinessRecord");
const Share = require("../models/ExternalReadinessShare");
const User = require("../models/User");
const AuditLog = require("../models/AuditLog");
const config = require("../config/unitEconomics");
const app = express(); app.use(express.json()); app.use("/readiness", require("../routes/externalReadiness"));
let mongod, owner, reviewer, recipient;
const future = (days = 7) => new Date(Date.now() + days * 86400000);
const as = (user, role = "admin") => ({ "x-user": String(user._id), "x-role": role });
function payload() {
  const bases = { creator_acquisition: 100, fan_acquisition: 2, conversion: 0.2, subscription_retention: 0.8, payout_refund: 1, support: 1, moderation: 1, infrastructure: 100, akuso: 1, partner_margin: 40, market_expansion: 50, new_creators: 2, new_fans: 100, existing_subscribers: 50, revenue_per_subscriber: 20, other_fixed_cost: 50, cash_balance: 10000 };
  return { packageKey: "CAPITAL-009", title: "Monthly unit economics", owner: owner._id, domain: "external_reporting", scope: "One monthly cohort", dueAt: future(), expiresAt: future(14), reason: "Prepare economics review", audience: "internal",
    evidence: [{ source: "private/finance-inputs", summary: "Source excerpt", observedAt: new Date(), expiresAt: future(14), confidence: "current" }],
    responses: service.catalog.find((p) => p.key === "CAPITAL-009").requirements.flatMap((r, index) => r.endsWith(":") ? [] : [{ index, response: "Reviewed contract", evidenceIndexes: [0] }]),
    unitEconomics: { period: new Date().toISOString().slice(0, 7), currency: "NGN",
      assumptions: config.inputs.map((s) => ({ key: s.key, owner: owner._id, low: bases[s.key] / 2, base: bases[s.key], high: s.unit === "ratio" ? Math.min(1, bases[s.key] * 2) : bases[s.key] * 2, confidence: "assumption", rationale: "Explicit modeling assumption", evidenceIndexes: [0] })),
      milestones: [{ key: "break_even", title: "Break-even cohort", owner: owner._id, targetDate: future(10), targetSubscribers: 40, rationale: "Cover fixed costs" }],
      riskTriggers: [{ key: "burn", title: "Burn ceiling", owner: owner._id, scenario: "base", metric: "netBurn", operator: "gte", threshold: 1000, response: "Human review of costs" }],
      allocationGates: [{ key: "acquisition", title: "Acquisition envelope", owner: owner._id, scenario: "fan_acquisition:high", metric: "netBurn", operator: "lte", threshold: 0, milestoneKey: "break_even", riskTriggerKeys: ["burn"], priorMaximum: 10000, revisedMaximum: 5000, rationale: "Reduce using sensitivity", stopLoss: "Request new decision if burn exceeds ceiling" }],
    } };
}
const save = (body = payload()) => service.saveDraft({ body, actor: owner._id });
const move = (row, action, actor = owner._id) => service.transition({ recordId: row._id, actor, body: { action, version: row.__v, reason: "Review evidence", notes: "Independent review", outcome: "pass" } });
async function approve(body = payload()) { let row = await save(body); row = await move(row, "attest"); row = await move(row, "submit"); return move(row, "approve", reviewer._id); }
beforeAll(async () => { mongod = await MongoMemoryServer.create(); await mongoose.connect(mongod.getUri()); });
beforeEach(async () => { await mongoose.connection.db.dropDatabase(); [owner, reviewer, recipient] = await User.create(["owner", "reviewer", "recipient"].map((name) => ({ name, username: `capital009_${name}`, email: `${name}@capital009.test`, password: "Password123!", role: name === "recipient" ? "user" : "admin" }))); });
afterAll(async () => { await mongoose.disconnect(); if (mongod) await mongod.stop(); });

test("persists all areas and computes bounded projections without claiming economics or spending approval", async () => {
  const row = await save(); const report = await service.report(); const r = report.records.find((r) => r.id === String(row._id)).unitEconomicsAnalysis;
  expect(config.areas).toEqual(["creator_acquisition", "fan_acquisition", "conversion", "subscription_retention", "payout_refund", "support", "moderation", "infrastructure", "akuso", "partner_margin", "market_expansion"]);
  expect(r.assumptionRegister).toHaveLength(17); expect(r.sensitivity).toHaveLength(34);
  expect(r.base).toMatchObject({ subscribers: 60, contributionPerSubscriber: 16, fixedCost: 600, netBurn: -400, breakEvenSubscribers: 35, subscriberGap: 0, runwayMonths: null });
  expect(r.sensitivity.find((s) => s.scenario === "conversion:low").result.netBurn).toBe(-240);
  expect(r.allocationGates[0]).toMatchObject({ state: "candidate_for_human_review", budgetChange: -5000, spendingAuthorized: false });
  expect(r).toMatchObject({ economicsValidated: false, auditedResult: false, capitalDecisionApproved: false, spendingAuthorized: false });
  expect(r.milestones[0]).toMatchObject({ state: "planned", achieved: false });
  expect(report.limits).toMatchObject({ records: 250, moneyMovementAuthorized: false });
  expect(r.assumptionRegister.every((a) => a.observationState === "not_observed_actual")).toBe(true);
});
test("routes protect writes, audit creation and reject forged derived fields", async () => {
  await request(app).post("/readiness/records").send(payload()).expect(401);
  await request(app).post("/readiness/records").set(as(recipient, "user")).send(payload()).expect(403);
  const r = await request(app).post("/readiness/records").set(as(owner)).send(payload()).expect(200); expect(r.headers["cache-control"]).toBe("no-store"); expect(r.body.status).toBe("draft");
  expect(await AuditLog.countDocuments({ action: "external_readiness.create", "metadata.packageKey": "CAPITAL-009" })).toBe(1);
  const body = payload(); body.unitEconomics.spendingAuthorized = true; await request(app).post("/readiness/records").set(as(owner)).send(body).expect(400);
});
test("missing assumptions remain unknown and block submission", async () => {
  const body = payload(); body.unitEconomics.assumptions = []; let row = await save(body); const r = service.analyzeUnitEconomics(row);
  expect(r.base).toBeNull(); expect(r.sensitivity.every((s) => s.result === null)).toBe(true); expect(r.assumptionRegister.every((a) => a.issues.includes("values_missing"))).toBe(true);
  row = await move(row, "attest"); await expect(move(row, "submit")).rejects.toThrow("economics_assumption_incomplete");
});
test.each(["disputed", "stale", "missing", "estimated_actual"])("%s evidence blocks projections and review", async (kind) => {
  const body = payload(); if (kind === "disputed") body.unitEconomics.assumptions[0].confidence = "disputed";
  if (kind === "stale") { body.evidence[0].observedAt = future(-3); body.evidence[0].expiresAt = future(-1); }
  if (kind === "missing") body.unitEconomics.assumptions[0].evidenceIndexes = [];
  if (kind === "estimated_actual") { body.evidence[0].confidence = "estimated"; body.unitEconomics.assumptions[0].confidence = "actual"; }
  let row = await save(body); expect(service.analyzeUnitEconomics(row).base).toBeNull(); row = await move(row, "attest"); await expect(move(row, "submit")).rejects.toThrow("economics_assumption_incomplete");
});
test("actual input assertions and approved review do not claim audited economics", async () => {
  const body = payload(); body.unitEconomics.assumptions.forEach((a) => { a.confidence = "actual"; }); const row = await approve(body); const r = service.analyzeUnitEconomics(row);
  expect(r.assumptionRegister.every((a) => a.observationState === "actual_input_recorded")).toBe(true); expect(r.economicsValidated).toBe(false); expect(r.auditedResult).toBe(false); expect(row.outcome).toBe("not_observed");
});
test.each(["duplicate", "range", "ratio", "evidence_index", "owner", "period", "currency", "wrong_package", "bounds"])("rejects invalid %s", async (kind) => {
  const b = payload(), e = b.unitEconomics;
  if (kind === "duplicate") e.assumptions[1].key = e.assumptions[0].key;
  if (kind === "range") e.assumptions[0].low = -1;
  if (kind === "ratio") e.assumptions.find((a) => a.key === "conversion").high = 2;
  if (kind === "evidence_index") e.assumptions[0].evidenceIndexes = [99];
  if (kind === "owner") e.assumptions[0].owner = recipient._id;
  if (kind === "period") b.financial = { currency: "NGN", inputs: [{ key: "gmv", value: 0, confidence: "actual", source: "close", period: "2000-01" }] };
  if (kind === "currency") b.allocation = { currency: "USD" };
  if (kind === "wrong_package") b.packageKey = "CAPITAL-008";
  if (kind === "bounds") e.assumptions[0].low = 1000;
  await expect(save(b)).rejects.toThrow(); expect(await Record.countDocuments()).toBe(0);
});
test("rejects oversized and duplicate risk registers", async () => {
  const b = payload(); b.unitEconomics.riskTriggers = Array.from({ length: 21 }, (_, i) => ({ ...b.unitEconomics.riskTriggers[0], key: `risk_${i}` })); await expect(save(b)).rejects.toThrow();
  b.unitEconomics.riskTriggers = [b.unitEconomics.riskTriggers[0], b.unitEconomics.riskTriggers[0]]; await expect(save(b)).rejects.toThrow();
});
test("zero and nonpositive contribution never fabricate runway or break-even", async () => {
  const b = payload(); b.unitEconomics.assumptions.forEach((a) => { a.low = 0; a.base = 0; a.high = 0; }); const r = service.analyzeUnitEconomics(await save(b));
  expect(r.inputComplete).toBe(true); expect(r.base).toMatchObject({ subscribers: 0, netBurn: 0, breakEvenSubscribers: null, breakEvenState: "nonpositive_contribution", runwayMonths: null, runwayState: "no_positive_burn" }); expect(r.milestones[0].state).toBe("nonpositive_contribution");
});
test("triggered sensitivity risk creates a human hold and no financial action", async () => {
  const b = payload(); b.unitEconomics.assumptions.find((a) => a.key === "support").high = 30; b.unitEconomics.riskTriggers[0].scenario = "support:high"; let row = await save(b); const r = service.analyzeUnitEconomics(row);
  expect(r.riskTriggers[0]).toMatchObject({ state: "triggered", projectedValue: 1340, action: "human_review_only" }); expect(r.allocationGates[0].state).toBe("hold");
  row = await move(row, "attest"); await expect(move(row, "submit")).rejects.toThrow("economics_risk_triggered"); expect(await Record.countDocuments()).toBe(1); expect(await Share.countDocuments()).toBe(0);
});
test.each(["missing_risk", "missing_milestone", "base_only", "below_break_even", "overdue"])("%s prevents allocation review", async (kind) => {
  const b = payload(), e = b.unitEconomics;
  if (kind === "missing_risk") e.allocationGates[0].riskTriggerKeys = ["unknown"];
  if (kind === "missing_milestone") e.allocationGates[0].milestoneKey = "unknown";
  if (kind === "base_only") e.allocationGates[0].scenario = "base";
  if (kind === "below_break_even") e.milestones[0].targetSubscribers = 1;
  if (kind === "overdue") e.milestones[0].targetDate = future(-1);
  let row = await save(b); row = await move(row, "attest"); await expect(move(row, "submit")).rejects.toThrow("economics_");
});
test("independent approval, edit invalidation and stale route versions preserve authority", async () => {
  let row = await save(); row = await move(row, "attest"); row = await move(row, "submit"); await expect(move(row, "approve")).rejects.toMatchObject({ status: 403 }); row = await move(row, "approve", reviewer._id);
  row.unitEconomics.assumptions[0].base = 120; const body = { version: row.__v, reason: "Evidence changed", unitEconomics: row.unitEconomics };
  const response = await request(app).patch(`/readiness/records/${row._id}`).set(as(owner)).send(body).expect(200); expect(response.body.status).toBe("draft"); expect(response.body.reviewedBy).toBeUndefined(); expect(response.body.ownerAttestedAt).toBeUndefined();
  await request(app).patch(`/readiness/records/${row._id}`).set(as(owner)).send(body).expect(409); expect((await Record.findById(row._id)).unitEconomics.assumptions[0].base).toBe(120);
});
test("direct model edits cannot keep economics approved", async () => {
  const row = await approve(); const stored = await Record.findById(row._id); stored.unitEconomics.assumptions[0].base = 110; await expect(stored.save()).rejects.toThrow("Revise changed economics");
});
test("external use needs review, excludes raw economics and becomes invalid with stale evidence", async () => {
  const b = payload(); Object.assign(b, { audience: "investor", classification: "sanitized", publicSummary: "Scoped projections", exclusions: "Raw finance excluded", withdrawalRule: "Withdraw on change" }); let row = await save(b);
  const shareBody = (version) => ({ version, recipient: recipient._id, reason: "Requested review", expiresAt: future(2) });
  await request(app).post(`/readiness/records/${row._id}/shares`).set(as(owner)).send(shareBody(row.__v)).expect(409);
  row = await move(row, "attest"); row = await move(row, "submit"); row = await move(row, "approve", reviewer._id);
  const share = await request(app).post(`/readiness/records/${row._id}/shares`).set(as(reviewer)).send(shareBody(row.__v)).expect(200);
  const visible = await request(app).get(`/readiness/shares/${share.body._id}`).set(as(recipient, "user")).expect(200); expect(JSON.stringify(visible.body)).not.toContain("unitEconomics"); expect(JSON.stringify(visible.body)).not.toContain("private/finance-inputs");
  await Record.updateOne({ _id: row._id }, { "evidence.0.expiresAt": future(-1) }); await request(app).get(`/readiness/shares/${share.body._id}`).set(as(recipient, "user")).expect(410);
});

test("a named assumption owner cannot independently approve their own economics", async () => {
  const b = payload(); b.unitEconomics.assumptions[0].owner = reviewer._id;
  let row = await save(b); row = await move(row, "attest"); row = await move(row, "submit");
  await expect(move(row, "approve", reviewer._id)).rejects.toMatchObject({ status: 403 });
});
test("positive burn yields a finite runway and negative partner contribution is counted once", async () => {
  const b = payload(); const input = b.unitEconomics.assumptions.find((a) => a.key === "partner_margin");
  Object.assign(input, { low: -1000, base: -500, high: -200 });
  const r = service.analyzeUnitEconomics(await save(b));
  expect(r.base).toMatchObject({ netBurn: 140, breakEvenSubscribers: 69, runwayState: "projected" });
  expect(r.base.runwayMonths).toBeCloseTo(10000 / 140);
});

test("arithmetic overflow remains explicitly incomplete instead of serializing an infinite break-even", async () => {
  const b = payload();
  for (const a of b.unitEconomics.assumptions) {
    if (["payout_refund", "support", "moderation", "akuso", "partner_margin"].includes(a.key)) Object.assign(a, { low: 0, base: 0, high: 0 });
    if (a.key === "revenue_per_subscriber") Object.assign(a, { low: 1e-320, base: 1e-320, high: 1e-320 });
  }
  const r = service.analyzeUnitEconomics(await save(b));
  expect(r.base).toBeNull(); expect(r.blockers).toContain("economics_projection_out_of_range"); expect(r.spendingAuthorized).toBe(false);
});
