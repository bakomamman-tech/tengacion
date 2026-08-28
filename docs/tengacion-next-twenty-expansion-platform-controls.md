# Tengacion Expansion and Platform Control Contract

Date: 28 August 2026

This document records the implementation contract for the twenty work packages following EXPANSION-001 in the authoritative roadmap sequence: EXPANSION-002 through EXPANSION-015, followed by PLATFORM-001 through PLATFORM-006.

Implementation completion does not manufacture operational evidence. An environment with no active expansion bet, launch plan, referral, experiment, partner pilot, or fully instrumented cost row reports zero or a bounded incomplete state. Cohort expansion and the next-cycle focus still require the recorded human decisions described below.

## Implemented package map

| Packages | Implemented surface |
|---|---|
| EXPANSION-002 to EXPANSION-005 | Six self-serve creator playbooks, privacy-safe referral attribution, five reusable campaign packages, a versioned event taxonomy, and guarded experiment records |
| EXPANSION-006 to EXPANSION-010 | Scored-cohort operating view, five creator offer types, aggregate fan relationship stages, suggestion-only operations automation, and grounded Akuso expansion modes and evals |
| EXPANSION-011 to EXPANSION-015 | Cohort review records, known-only unit economics, partner renewal and sponsor packages, independent governance decisions, and a ranked next-roadmap recommendation |
| PLATFORM-001 to PLATFORM-005 | Shared platform object catalog, creator business suite contract, fan relationship model, metric contracts, experiment data-quality gates, and reusable governance control maps |
| PLATFORM-006 | Creator launch planner and offer builder in the Creator Dashboard, plus elevated-risk admin review |

## Durable authorities

- CreatorLaunchPlan owns creator playbook, offer, readiness, review, scheduling, and launch-plan history. Supported offers are paid drop, bundle, subscription package, live event pass, and marketplace spotlight.
- ReferralAttribution owns the share token, source, destination, aggregate counters, and expiry. ReferralAttributionEvent owns deduplicated milestone evidence.
- ExpansionExperiment owns hypothesis, cohort, surface, variants, allocation, primary metric, guardrails, stop condition, dates, data-quality state, result, and decision.
- AutomationSuggestion owns confidence, bounded source signals, expiry, and the human disposition. Its immutable sensitive-action authority is always false.
- GovernanceDecision owns workflow, risk, separate review roles, evidence, conditions, rollback, expiry, follow-up, approvals, and status history.
- Existing ExpansionBet, RevenueCampaign, PartnerPilot, purchase/ledger, payout, reliability, support, moderation, and analytics authorities remain authoritative. The new operating layer composes them; it does not duplicate their financial or trust decisions.

## State and review boundaries

Creator launch plans move through draft, planning, review_required, approved, scheduled, launched, paused, completed, or cancelled. Creator mutations are ownership-scoped. Elevated campaign, finance, or trust risk must enter admin review before promotion. A material edit after approval clears the approval and returns the plan to review_required; scheduled plan details cannot be edited until the launch is paused.

Experiments move through draft, review, approved, running, paused, completed, or cancelled. A running experiment requires a hypothesis, owner, cohort, two or more variants totalling 100 percent, a primary metric, at least one guardrail, stop condition, valid time bounds, a decision date, and ready data quality.

Automation is suggestion-only for support macro selection, payout queue priority, campaign warnings, playbook reminders, moderation routing, entitlement escalation, and recommendation complaint triage. Payout release, refund override, account restriction, partner publication, content takedown, and Akuso public-copy publication always remain human actions.

High- and critical-risk governance records require at least two distinct accountable review roles. One reviewer cannot satisfy multiple required roles on the same decision. Approved or conditional decisions retain an expiry, follow-up date, evidence, and rollback path.

## Creator and admin interfaces

Creator API:

- POST /api/creator/launch-plans
- PATCH /api/creator/launch-plans/:planId
- POST /api/creator/referrals

Referral API:

- GET /r/:token records an aggregate link open, places an HTTP-only referral token, and redirects only to a validated internal destination.
- POST /api/referrals/:token/milestones records an authenticated, deduplicated milestone only after the follow, preview, paid purchase, subscription, signup, or D7-return authority confirms the action.

Admin API:

- GET /api/admin/analytics/expansion-platform-operating-system
- PATCH /api/admin/growth/creator-launch-plans/:planId/review
- POST or PATCH /api/admin/growth/experiments[/:experimentId]
- POST or PATCH /api/admin/operations/automation-suggestions[/:suggestionId]
- POST or PATCH /api/admin/governance/decisions[/:decisionId]

Admin mutations are authenticated, rate-limited, reason-bearing, and audit logged. Admin Analytics and its JSON export use the same server-built report.

## Privacy and reporting truth

Referral sources cover creator profile shares, content shares, campaigns, partners, fan invites, and live-event invites. The funnel reports invite, open, signup, first follow, first preview, first purchase, first subscription, and D7 return in aggregate. Authenticated milestone requests cannot create counters without matching server-owned account, analytics, or purchase evidence. Actor deduplication uses a one-way hash; creator, partner, and sponsor views receive no fan identifier or private action row. Referral destinations reject external, double-slash, backslash-normalized, control-character, and line-break targets.

The fan relationship model derives discovered, interested, engaged, paying, subscribed, advocate, dormant, and at-risk aggregates from existing server events and purchases. Consent, prompt frequency, complaints/reports, refund/dispute context, and creator trust holds suppress prompts. No fan-level relationship row is returned.

Unit economics reports gross paid revenue, known creator share, stored payment fees, refund/dispute leakage, and explicitly instrumented cost proxies. Missing share rates and missing support, infrastructure, model, partner, or campaign cost proxies are reported as instrumentation gaps. Missing values are never replaced with invented rates or costs.

Cohort reviews combine the existing expansion scorecard with observed activation, commerce, support, moderation, reliability, Akuso, and partner signals. If no scorecard bet is in controlled_launch or expand, active cohort count is zero. The ranked next-roadmap output is a recommendation requiring leadership confirmation, not an automatic roadmap change.

## Akuso boundary

Akuso can explain creator playbooks, campaign packages, referrals, and fan lifecycle flows, and can draft support macros, cohort summaries, and partner-safe summaries. Public, partner-facing, financial, moderation-impacting, and governance text remains a draft until an authorized human reviews it. Akuso cannot approve a launch, run an experiment, publish a report, move money, override a refund, restrict an account, or execute an automation suggestion.

Expansion eval coverage includes scorecard guidance, creator campaign setup, referral privacy, payout/refund escalation, partner-report safety, unsupported automation refusal, fan lifecycle guidance, and support macro drafting. Deterministic fallbacks remain available for the new writing modes.

## Rollback and containment

- Pause or cancel an unsafe creator plan; elevated plans cannot bypass review.
- Pause or cancel an experiment and retain its decision history.
- Reject or let an automation suggestion expire; suggestions have no execution authority.
- Revoke or expire a governance decision and follow its recorded rollback path.
- Disable or withdraw referral and campaign links without deleting aggregate audit evidence.
- Restore existing manual payout, refund, moderation, publication, campaign, and partner-report procedures; none were replaced by the new planning layer.
- Treat missing or degraded data as a stop condition for expansion rather than inferring a favorable result.

## Verification anchors

- Backend contracts: backend/tests/expansionPlatformOperatingService.test.js and backend/tests/expansionPlatformRoutes.test.js
- Creator planner: frontend/src/components/creator/__tests__/CreatorLaunchPlannerPanel.test.jsx
- Admin operating view: frontend/src/components/admin/__tests__/ExpansionPlatformOperatingPanels.test.jsx
- Akuso expansion cases: backend/services/akusoEvalRunner.js
- Executable implementation: backend/services/expansionPlatformOperatingService.js
