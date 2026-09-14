const config = require('../config/commercialRoadmap');
const catalog = require('../config/commercialRoadmapPackages.json');
const time = value => value == null ? NaN : new Date(value).getTime();
const present = value => typeof value === 'string' && value.trim().length > 0;
const finite = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;
function analyzeCommercialWorkflow(row, now = new Date()) {
  const spec = catalog.find(item => item.key === row.packageKey);
  if (!spec) return undefined;
  const value = row.commercial || {};
  const blockers = [];
  const add = code => blockers.push(code);
  const evidence = row.evidence || [];
  const linked = entry => Array.isArray(entry?.evidenceIndexes) && entry.evidenceIndexes.length > 0
    && new Set(entry.evidenceIndexes).size === entry.evidenceIndexes.length
    && entry.evidenceIndexes.every(index => Number.isInteger(index) && index >= 0 && index < evidence.length
      && evidence[index].confidence === 'current' && time(evidence[index].observedAt) <= +now
      && time(evidence[index].expiresAt) > +now);
  if (!row.commercial) add('commercial_workflow_missing');
  if (!present(value.subject)) add('commercial_subject_missing');
  if (!present(value.hypothesis)) add('commercial_hypothesis_missing');
  if (!(time(value.reviewAt) > +now)) add('commercial_review_due');
  if (!present(value.rollbackTrigger)) add('commercial_rollback_missing');
  for (const group of ['scores', 'gates', 'metrics', 'thresholds', 'details', 'steps', 'acceptance', 'outreachTargets']) {
    const entries = value[group] || [];
    if (new Set(entries.map(entry => entry.key)).size !== entries.length) add('commercial_duplicate_' + group);
  }
  const details = new Map((value.details || []).map(entry => [entry.key, entry]));
  for (const key of config.detailFields[spec.workflowKind] || []) {
    const entry = details.get(key);
    if (!present(entry?.value) || !linked(entry)) add('commercial_detail_required:' + key);
  }
  for (const key of details.keys()) {
    if (!(config.detailFields[spec.workflowKind] || []).includes(key)) add('commercial_unknown_detail:' + key);
  }
  spec.acceptanceCriteria.forEach((criterion, index) => {
    const entry = (value.acceptance || []).find(item => item.key === String(index));
    if (!present(entry?.value) || !linked(entry)) add('commercial_acceptance_required:' + index);
  });
  for (const entry of value.acceptance || []) {
    if (!spec.acceptanceCriteria[Number(entry.key)] || String(Number(entry.key)) !== entry.key) add('commercial_acceptance_invalid');
  }
  const metrics = new Map((value.metrics || []).map(entry => [entry.key, entry]));
  const validMetric = entry => finite(entry?.value) && present(entry?.unit)
    && time(entry?.observedAt) <= +now && time(entry?.observedAt) >= time(value.periodStart)
    && time(entry?.observedAt) <= time(value.periodEnd) && linked(entry)
    && ['actual', 'estimated'].includes(entry.confidence);
  for (const entry of metrics.values()) {
    if (!validMetric(entry)) add('commercial_metric_invalid:' + entry.key);
  }
  for (const key of config.requiredMetrics[spec.workflowKind] || []) {
    if (!validMetric(metrics.get(key))) add('commercial_metric_required:' + key);
  }
  if (metrics.size && (!(time(value.periodStart) < time(value.periodEnd)) || time(value.periodEnd) > +now)) {
    add('commercial_measurement_period_invalid');
  }
  const thresholdResults = (value.thresholds || []).map(threshold => {
    const metric = metrics.get(threshold.key);
    const known = validMetric(metric) && metric.confidence === 'actual';
    const breached = known && (threshold.direction === 'minimum' ? metric.value < threshold.value : metric.value > threshold.value);
    if (!known) add('commercial_threshold_unmeasured:' + threshold.key);
    if (breached) add('commercial_stop_loss:' + threshold.key);
    return {key: threshold.key, state: !known ? 'unknown' : breached ? 'breached' : 'within_limit'};
  });
  for (const gate of value.gates || []) {
    if (gate.status === 'hold') add('commercial_control_hold:' + gate.key);
  }
  const active = ['pilot_ready', 'active_pilot', 'scale_ready'].includes(value.state) || value.decision === 'scale';
  if (active || ['pilot', 'scorecard', 'pricing', 'scale_decision'].includes(spec.workflowKind)) {
    if (!/^[A-Z]{3}$/.test(value.currency || '') || !finite(value.budgetLimit) || !finite(value.spendToDate)) add('commercial_budget_required');
    if (finite(value.budgetLimit) && finite(value.spendToDate) && value.spendToDate > value.budgetLimit) add('commercial_budget_exceeded');
  }
  if (active) {
    if (!value.thresholds?.length) add('commercial_stop_loss_required');
    for (const key of config.controls) {
      const gate = (value.gates || []).find(entry => entry.key === key);
      if (gate?.status !== 'pass' || !linked(gate)) add('commercial_control_hold:' + key);
    }
  }
  if (spec.workflowKind === 'scorecard') {
    for (const key of config.dimensions) {
      const score = (value.scores || []).find(entry => entry.key === key);
      if (!finite(score?.value) || score.value > 5 || !linked(score)) add('commercial_score_required:' + key);
    }
    const candidates = spec.cycle === 'distribution' ? config.channels : config.revenueLines;
    if (!candidates.includes(spec.cycle === 'distribution' ? value.channel : value.revenueLine)) add('commercial_candidate_required');
  }
  if (spec.workflowKind === 'scale_decision') {
    if (!config.decisions.includes(value.decision)) add('commercial_decision_required');
    if (!present(value.learning)) add('commercial_learning_required');
    if (value.decision === 'scale' && !present(value.nextCohort)) add('commercial_next_cohort_required');
  }
  if (['playbook', 'commercial_package', 'outreach', 'lifecycle'].includes(spec.workflowKind) && !value.steps?.length) add('commercial_steps_required');
  for (const step of value.steps || []) {
    if (!present(step.owner) || !Number.isFinite(time(step.dueAt))) add('commercial_step_owner_due_required:' + step.key);
    if (step.status === 'blocked' || (step.status !== 'done' && time(step.dueAt) <= +now)) add('commercial_step_blocked:' + step.key);
    if (step.status === 'done' && !linked(step)) add('commercial_step_evidence_required:' + step.key);
  }
  let pricing;
  if (spec.workflowKind === 'pricing') {
    const get = key => validMetric(metrics.get(key)) ? metrics.get(key).value : null;
    const minimum = get('minimum_price'), maximum = get('maximum_price'), proposed = get('proposed_price');
    const cap = get('maximum_discount_percent'), discount = get('discount_percent');
    const complete = [minimum, maximum, proposed, cap, discount].every(finite);
    const effectivePrice = complete ? proposed * (1 - discount / 100) : null;
    if (complete && (minimum > maximum || proposed > maximum || effectivePrice < minimum || cap > 100 || discount > cap)) add('commercial_price_outside_guardrails');
    pricing = {effectivePrice, currency: value.currency || null, priceApplied: false};
  }
  let economics;
  if (spec.workflowKind === 'economics_review') {
    const get = key => validMetric(metrics.get(key)) ? metrics.get(key).value : null;
    const costKeys = ['payment_fees', 'refunds', 'disputes', 'support_cost', 'moderation_cost', 'infrastructure_cost', 'akuso_cost', 'acquisition_cost'];
    const costs = costKeys.map(get), revenue = get('platform_revenue'), fans = get('paying_fans');
    const totalCost = costs.every(finite) ? costs.reduce((a, b) => a + b, 0) : null;
    economics = {currency: value.currency || null, platformRevenue: revenue, totalCost,
      contribution: revenue !== null && totalCost !== null ? revenue - totalCost : null,
      acquisitionCostPerPayingFan: fans > 0 && get('acquisition_cost') !== null ? get('acquisition_cost') / fans : null,
      confidence: [...metrics.values()].every(entry => entry.confidence === 'actual') ? 'actual' : 'estimated_or_incomplete',
      assumption: 'Platform revenue excludes creator earnings; refunds and disputes are platform-borne losses and must not overlap.'};
    if (!/^[A-Z]{3}$/.test(value.currency || '')) add('commercial_currency_required');
  }
  let ai;
  if (spec.workflowKind === 'ai_governance') {
    const count = metrics.get('evaluated_workflows')?.value;
    if (!(count > 0) || !Number.isInteger(count)) add('commercial_ai_sample_required');
    for (const key of ['helpful_workflows', 'edited_workflows', 'unsupported_claims', 'grounded_workflows', 'escalated_workflows']) {
      const n = metrics.get(key)?.value;
      if (!Number.isInteger(n) || n < 0 || n > count) add('commercial_ai_count_invalid:' + key);
    }
    if (active && (metrics.get('unsupported_claims')?.value !== 0 || metrics.get('incidents')?.value !== 0)) add('commercial_ai_safety_hold');
    const ratio = key => Number.isInteger(count) && count > 0 && Number.isInteger(metrics.get(key)?.value) && metrics.get(key).value >= 0 && metrics.get(key).value <= count ? metrics.get(key).value / count : null;
    ai = {helpfulRate: ratio('helpful_workflows'),
      unsupportedClaimRate: ratio('unsupported_claims'),
      costPerUsefulWorkflow: ratio('helpful_workflows') > 0 && validMetric(metrics.get('workflow_cost')) ? metrics.get('workflow_cost').value / metrics.get('helpful_workflows').value : null,
      executionAuthorized: false};
  }
  const unique = [...new Set(blockers)];
  const reviewed = row.status === 'approved' && !unique.length;
  return {kind: spec.workflowKind, blockers: unique, requestedState: value.state || 'research',
    effectiveState: reviewed ? value.state : 'not_ready', reviewedRecordAvailable: reviewed,
    thresholdResults, pricing, economics, ai, score: spec.workflowKind === 'scorecard' && !unique.some(x => x.startsWith('commercial_score')) ? (value.scores || []).reduce((sum, item) => sum + item.value, 0) : null,
    outreachAuthorized: false, spendingAuthorized: false, moneyMovementAuthorized: false, publicationAuthorized: false,
    scope: 'Internal operating records; external execution requires its existing authorized workflow.'};
}
module.exports = {analyzeCommercialWorkflow};