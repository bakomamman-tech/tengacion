// Contracts for the execution cycle following CAPITAL-011.
const states = ['not_ready', 'research', 'pilot_ready', 'active_pilot', 'scale_ready', 'paused', 'retired'];
const decisions = ['scale', 'continue_pilot', 'narrow_scope', 'pause', 'retire', 'revisit_after_fix'];
const dimensions = ['creator_value', 'fan_demand', 'retention', 'revenue_quality', 'margin_confidence', 'support_readiness', 'rights_readiness', 'refund_dispute_readiness', 'payout_readiness', 'market_readiness', 'partner_fit', 'akuso_readiness'];
const controls = ['finance', 'trust', 'support', 'moderation', 'rights', 'privacy', 'claims', 'market', 'akuso'];
const channels = ['organic_creator', 'fan_referral', 'community_ambassador', 'city_campus', 'creator_category', 'influencer', 'paid_social', 'search_app_install', 'live_event', 'creator_institution', 'strategic_partner', 'sponsor_campaign', 'enterprise'];
const revenueLines = ['paid_tracks', 'paid_books_chapters', 'creator_subscription', 'bundle', 'live_event_access', 'creator_service', 'sponsor_spotlight', 'category_campaign', 'marketplace_placement', 'creator_institution', 'enterprise_hub', 'partner_reporting', 'revenue_backed_growth'];
const kinds = {'CAPITAL-012': 'outreach', 'CAPITAL-013': 'model_revision', 'CAPITAL-014': 'operating_report', 'CAPITAL-015': 'scale_decision'};
const cycleKinds = ['scorecard', 'playbook', 'measurement', 'commercial_package', 'trust_review', 'ai_governance', 'pilot', 'lifecycle', 'commercial_package', 'economics_review', 'trust_review', 'ai_governance', 'scale_decision', 'playbook', 'lifecycle', 'commercial_package', 'operating_report', 'ai_governance'];
for (const cycle of ['DISTRIBUTION', 'REVENUE']) {
  cycleKinds.forEach((kind, index) => { kinds[cycle + '-' + String(index + 1).padStart(3, '0')] = kind; });
}
kinds['REVENUE-002'] = 'pricing';
kinds['REVENUE-003'] = 'playbook';
kinds['REVENUE-004'] = 'measurement';
module.exports = { states, decisions, dimensions, controls, channels, revenueLines, kinds };
const detailFields = {
  outreach: ['approved_target_list', 'approved_claims', 'qa_routing', 'meeting_status', 'interest_level', 'objections', 'diligence_requests', 'requested_terms', 'risky_asks', 'followup_owner', 'next_step', 'advisor_review_trigger', 'advisor_review_outcome', 'access_log_review'],
  model_revision: ['feedback_source', 'previous_model_version', 'revised_model_version', 'assumption_owner', 'confidence_state', 'sharing_approval', 'allocation_changes'],
  scorecard: ['candidate_inventory', 'ranking_rationale', 'success_metric', 'stop_loss_metric'],
  pilot: ['creator_cohort', 'fan_cohort', 'success_metric', 'stop_loss_metric', 'support_owner', 'trust_owner', 'finance_owner', 'rights_review', 'weekly_review'],
  pricing: ['pricing_surface', 'approval_threshold', 'discount_rules', 'promotion_rules', 'tax_review_trigger', 'refund_dispute_implications', 'creator_earnings_impact', 'fan_explanation', 'package_state'],
  commercial_package: ['buyer_fit', 'value_proposition', 'approved_claims', 'pricing_range', 'delivery_obligations', 'reporting_cadence', 'support_owner', 'sponsor_disclosure', 'creator_consent', 'rights_review', 'renewal_path', 'revocation_path', 'opportunity_stage', 'risky_terms', 'escalation_outcome', 'promised_delivery', 'actual_delivery'],
  playbook: ['category', 'entry_criteria', 'maturity_stage', 'creator_outcomes', 'fan_outcomes', 'rights_review', 'payout_readiness', 'support_escalation', 'graduation_criteria'],
  measurement: ['event_contract', 'source_authority', 'attribution_dimensions', 'cohort_definitions', 'retention_windows', 'data_quality_review', 'missing_instrumentation', 'privacy_review'],
  lifecycle: ['program', 'trigger', 'eligibility', 'consent_authority', 'opt_out_authority', 'frequency_cap', 'complaint_threshold', 'refund_dispute_watch', 'sponsor_disclosure', 'diversity_check', 'market_restrictions', 'subscription_disclosures', 'delivery_authority'],
  trust_review: ['creator_feedback', 'fan_feedback', 'claim_complaints', 'support_capacity', 'moderation_capacity', 'rights_risk', 'privacy_constraints', 'incident_owner', 'remediation', 'pause_rules'],
  economics_review: ['assumption_register', 'sensitivity_analysis', 'revenue_confidence', 'payback_confidence', 'finance_review', 'trust_review', 'scale_gates'],
  ai_governance: ['supported_workflows', 'blocked_decisions', 'grounding_sources', 'approved_claim_retrieval', 'eval_run', 'refusal_review', 'privacy_memory_review', 'incident_history', 'human_review', 'readiness_state'],
  scale_decision: ['hypothesis_result', 'creator_outcome', 'fan_outcome', 'revenue_outcome', 'retention_outcome', 'payback_confidence', 'support_coverage', 'moderation_coverage', 'finance_review_cadence', 'trust_review_cadence', 'claims_review_cadence', 'market_readiness', 'alternatives'],
  operating_report: ['reporting_scope', 'observed_outcomes', 'unproven_outcomes', 'finance_confidence', 'creator_outcomes', 'fan_outcomes', 'trust_outcomes', 'akuso_quality_cost', 'blocked_claims', 'next_milestone', 'owner_decisions', 'go_no_go'],
};
const requiredMetrics = {
  pricing: ['minimum_price', 'maximum_price', 'proposed_price', 'maximum_discount_percent', 'discount_percent'],
  economics_review: ['gmv', 'platform_revenue', 'creator_earnings', 'payment_fees', 'refunds', 'disputes', 'support_cost', 'moderation_cost', 'infrastructure_cost', 'akuso_cost', 'acquisition_cost', 'paying_fans'],
  ai_governance: ['evaluated_workflows', 'helpful_workflows', 'edited_workflows', 'unsupported_claims', 'grounded_workflows', 'escalated_workflows', 'workflow_cost', 'incidents'],
};
const requiredPackages = {
  'CAPITAL-012': ['CAPITAL-011', 'CAPITAL-006'],
  'CAPITAL-013': ['CAPITAL-003', 'CAPITAL-009'],
  'CAPITAL-014': ['CAPITAL-011', 'CAPITAL-013'],
  'CAPITAL-015': ['CAPITAL-014'],
};
for (const cycle of ['DISTRIBUTION', 'REVENUE']) {
  requiredPackages[cycle + '-007'] = [cycle + '-001', cycle + '-005'];
  requiredPackages[cycle + '-013'] = [cycle + '-007', cycle + '-010', cycle + '-011'];
  requiredPackages[cycle + '-014'] = [cycle + '-013'];
  requiredPackages[cycle + '-015'] = [cycle + '-008'];
  requiredPackages[cycle + '-017'] = [cycle + '-013', cycle + '-016'];
  requiredPackages[cycle + '-018'] = [cycle + '-006', cycle + '-012'];
}
module.exports.detailFields = detailFields;
module.exports.requiredMetrics = requiredMetrics;
module.exports.requiredPackages = requiredPackages;