const config = require("../config/unitEconomics");
const finite = Number.isFinite;
const current = (e, now) => e && ["current", "estimated"].includes(e.confidence) &&
  finite(new Date(e.observedAt).getTime()) && new Date(e.observedAt) <= now &&
  finite(new Date(e.expiresAt).getTime()) && new Date(e.expiresAt) > now;
const compare = (value, operator, threshold) => finite(value) && finite(threshold) ? (operator === "gte" ? value >= threshold : operator === "lte" ? value <= threshold : null) : null;

// All results are projections from the recorded monthly inputs, including when inputs are labelled actual.
function calculate(v) {
  const subscribers = v.new_fans * v.conversion + v.existing_subscribers * v.subscription_retention;
  const contributionPerSubscriber = v.revenue_per_subscriber - v.payout_refund - v.support - v.moderation - v.akuso;
  const fixedCost = v.creator_acquisition * v.new_creators + v.fan_acquisition * v.new_fans + v.infrastructure + v.market_expansion + v.other_fixed_cost;
  const netBurn = fixedCost - v.partner_margin - subscribers * contributionPerSubscriber;
  const breakEvenSubscribers = contributionPerSubscriber > 0 ? Math.max(0, Math.ceil((fixedCost - v.partner_margin) / contributionPerSubscriber)) : null;
  const result = { subscribers, contributionPerSubscriber, fixedCost, netBurn,
    runwayMonths: netBurn > 0 ? v.cash_balance / netBurn : null,
    runwayState: netBurn > 0 ? "projected" : "no_positive_burn",
    breakEvenSubscribers, breakEvenState: contributionPerSubscriber > 0 ? "projected" : "nonpositive_contribution",
    subscriberGap: breakEvenSubscribers === null ? null : Math.max(0, breakEvenSubscribers - subscribers) };
  return Object.values(result).some((value) => typeof value === "number" && !finite(value)) ? null : result;
}

function analyzeUnitEconomics(row, now = new Date()) {
  const economics = row.unitEconomics || {};
  const blockers = [];
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(economics.period || "") || !/^[A-Z]{3}$/.test(economics.currency || "")) blockers.push("economics_period_currency_missing");
  const register = config.inputs.map((spec) => {
    const a = (economics.assumptions || []).find((v) => v.key === spec.key);
    const issues = [];
    if (!a || ![a.low, a.base, a.high].every(finite)) issues.push("values_missing");
    if (a && ([a.low, a.base, a.high].some((v) => finite(v) && (v < spec.min || v > spec.max)) || a.low > a.base || a.base > a.high)) issues.push("invalid_range");
    if (!a?.owner) issues.push("owner_missing");
    if (!a?.rationale?.trim()) issues.push("rationale_missing");
    if (!a || ["incomplete", "disputed"].includes(a.confidence)) issues.push(a?.confidence || "incomplete");
    const evidence = (a?.evidenceIndexes || []).map((i) => row.evidence?.[i]);
    if (!evidence.length || evidence.some((e) => !current(e, now))) issues.push("evidence_missing_disputed_or_stale");
    if (a?.confidence === "actual" && evidence.some((e) => e?.confidence !== "current")) issues.push("actual_needs_current_evidence");
    if (issues.length) blockers.push(`economics_assumption_incomplete:${spec.key}`);
    return { ...spec, ...(a?.toObject ? a.toObject() : a), issues,
      observationState: !issues.length && a.confidence === "actual" ? "actual_input_recorded" : "not_observed_actual" };
  });
  const inputComplete = !blockers.length;
  const values = Object.fromEntries(register.map((a) => [a.key, a.base]));
  const base = inputComplete ? calculate(values) : null;
  const sensitivity = config.inputs.flatMap((spec) => ["low", "high"].map((bound) => ({
    scenario: `${spec.key}:${bound}`, assumptionKey: spec.key, bound,
    input: register.find((a) => a.key === spec.key)?.[bound] ?? null,
    result: inputComplete ? calculate({ ...values, [spec.key]: register.find((a) => a.key === spec.key)[bound] }) : null,
  })));
  if (inputComplete && (!base || sensitivity.some((s) => !s.result))) blockers.push("economics_projection_out_of_range");
  const resultFor = (scenario) => scenario === "base" ? base : sensitivity.find((s) => s.scenario === scenario)?.result;
  const riskTriggers = (economics.riskTriggers || []).map((r) => {
    const result = compare(resultFor(r.scenario)?.[r.metric], r.operator, r.threshold);
    const complete = r.owner && r.title?.trim() && r.response?.trim() && result !== null;
    const state = !complete ? "incomplete" : result ? "triggered" : "clear";
    if (state !== "clear") blockers.push(`economics_risk_${state}:${r.key}`);
    return { key: r.key, state, projectedValue: resultFor(r.scenario)?.[r.metric] ?? null, action: "human_review_only" };
  });
  const milestones = (economics.milestones || []).map((m) => {
    const complete = m.owner && m.title?.trim() && m.rationale?.trim() && finite(m.targetSubscribers) && finite(new Date(m.targetDate).getTime());
    const state = !complete || !base ? "incomplete" : base.breakEvenSubscribers === null ? "nonpositive_contribution" : new Date(m.targetDate) <= now ? "overdue" : m.targetSubscribers < base.breakEvenSubscribers ? "target_below_break_even" : "planned";
    if (state !== "planned") blockers.push(`economics_milestone_${state}:${m.key}`);
    return { key: m.key, state, requiredSubscribers: base?.breakEvenSubscribers ?? null, achieved: false };
  });
  const allocationGates = (economics.allocationGates || []).map((g) => {
    const result = compare(resultFor(g.scenario)?.[g.metric], g.operator, g.threshold);
    const milestone = milestones.find((m) => m.key === g.milestoneKey);
    const risks = (g.riskTriggerKeys || []).map((key) => riskTriggers.find((r) => r.key === key));
    const complete = g.scenario !== "base" && g.owner && g.title?.trim() && finite(g.priorMaximum) && finite(g.revisedMaximum) && g.rationale?.trim() && g.stopLoss?.trim() && milestone && risks.length && risks.every(Boolean) && result !== null;
    const state = !complete || !inputComplete ? "incomplete" : result && milestone.state === "planned" && risks.every((r) => r.state === "clear") ? "candidate_for_human_review" : "hold";
    if (state !== "candidate_for_human_review") blockers.push(`economics_allocation_${state}:${g.key}`);
    return { key: g.key, state, scenario: g.scenario, projectedValue: resultFor(g.scenario)?.[g.metric] ?? null,
      budgetChange: finite(g.revisedMaximum) && finite(g.priorMaximum) ? g.revisedMaximum - g.priorMaximum : null, spendingAuthorized: false };
  });
  if (!milestones.length) blockers.push("economics_milestones_missing");
  if (!riskTriggers.length) blockers.push("economics_risk_triggers_missing");
  if (!allocationGates.length) blockers.push("economics_allocation_gates_missing");
  return { period: economics.period || null, currency: economics.currency || null, inputComplete,
    state: blockers.length ? "incomplete_or_on_hold" : "projection_for_human_review", assumptionRegister: register,
    base, sensitivity, milestones, riskTriggers, allocationGates, blockers,
    method: "One input at a time; all other inputs held at base. No probability, correlation or causality claim.",
    economicsValidated: false, auditedResult: false, capitalDecisionApproved: false, spendingAuthorized: false,
    externalUse: "requires_current_evidence_and_independent_human_review" };
}
module.exports = { analyzeUnitEconomics };
