# Tengacion Platform, Ecosystem, and Network Control Contract

Date: 1 September 2026

This document records the implementation contract for the twenty-five work packages following `PLATFORM-006` in the authoritative sequence: `PLATFORM-007` through `PLATFORM-015`, `ECOSYSTEM-001` through `ECOSYSTEM-015`, and `NETWORK-001`.

Implementation completion does not manufacture operating evidence. Environments without creator-service outcomes, community-loop activity, partner access, market reviews, reconciled costs, or completed scale drills report zero, `not_observed`, or an explicit blocker. `NETWORK-001` defines the creator business network model; it does not launch a creator network.

## Implemented package map

| Packages | Implemented surface |
|---|---|
| `PLATFORM-007` to `PLATFORM-010` | Shared campaign state and control dimensions, relationship-aware lifecycle actions and suppression, repeatable partner access states, and review-gated Akuso/automation support |
| `PLATFORM-011` to `PLATFORM-015` | One operating view, margin and instrumentation controls, governance checks, seven evidence-bearing scale drills, and a readiness recommendation with explicit blockers |
| `ECOSYSTEM-001` to `ECOSYSTEM-005` | Eight creator-service definitions, eight guarded community loops, six partner integration levels, a finance dimensional model, and ten multi-market gates |
| `ECOSYSTEM-006` to `ECOSYSTEM-010` | Durable service pilots, community-loop controls, permissioned partner access, combined health/finance reporting, and six Akuso ecosystem eval suites |
| `ECOSYSTEM-011` to `ECOSYSTEM-015` | Evidence-bounded service, community, partner, risk, and readiness reviews with scale/repeat/concierge/pause/retire decisions |
| `NETWORK-001` | A consent-based creator business network object model with membership, shared-program, offer, decision, finance, privacy, and launch boundaries |

## Durable authorities

- `CreatorServiceEnrollment` owns creator, program, basic/premium tier, consent, owner, commitment, expected outcome, metric, steps, baseline and outcome snapshots, satisfaction, operating effort/cost, status, review date, and history. Premium services require explicit commercial terms. Enrolled, active, and completed services require recorded creator consent.
- `CommunityLoopProgram` owns the loop, scope, eligibility, primary metric, guardrails, message cap, ignored-prompt limit, complaint threshold, abuse checks, dates, stop condition, approval, and history. It has immutable no-private-fan-row semantics.
- `PartnerIntegration` owns the partner, access level, workflow state, allowlist, mandatory prohibitions, consent, privacy review, sponsor label, expiry, revocation, audit event, renewal metric, and history. API candidates cannot become active in this cycle.
- `MarketReadinessReview` owns the market/community, state, owner, cost cap, primary metric, stop condition, review date, and all ten gates. Controlled launch and growth require reviewed evidence for every gate plus recorded human approval.
- Existing campaign, offer, experiment, referral, purchase, ledger, payout, partner-pilot, governance, support, moderation, reliability, recommendation, and Akuso release authorities remain authoritative. The new layer composes their evidence and cannot replace their decisions.

## Creator services

The service catalog covers launch coaching, catalog quality, pricing and packaging, subscription growth, live-event planning, campaign readiness, rights/takedown readiness, and payout/finance readiness. Every definition includes eligibility, creator commitment, support owner, bounded Akuso scope, required data, expected outcome, success metric, graduation condition, escalation path, and a repeatable checklist.

The creator dashboard shows program definitions and only the authenticated creator's enrollments. No enrollment is inferred. Basic support remains separate from premium service, and premium terms are never implied.

Service review reports participation, completion, stored outcome evidence, satisfaction, support effort, and operating-cost estimates. Missing outcome snapshots remain `not_observed`; service, campaign, and partner effects are not merged.

## Fan community loops

The catalog covers creator invites, supporter milestones, live follow-up, saved-content completion, subscription recovery, creator-club updates, fan campaign shares, and similar-creator suggestions after purchase.

Loop reporting is aggregate-only. The operating view counts only attributed server events and never returns the actor or private metadata. Stored complaint, abuse, opt-out, or ignored-prompt evidence changes the guardrail state to `pause_and_review`. Consent, frequency, report, refund/dispute, creator-trust, and notification suppression remain active.

## Partner integration levels

Levels are manual report, scheduled export, scoped dashboard access, campaign collaboration, sponsor package, and API candidate. Every level defines allowlisted data, prohibited data, accountable review, creator-consent rule, sponsor labeling, expiry, revocation, audit, and renewal review.

Payment identifiers, private user behavior, identity-verification data, moderation-sensitive detail, and Akuso memory are prohibited. Approved or active access requires a completed privacy review and any required creator consent. Sponsored access also requires a visible label. `api_candidate` is schema-proposal status only.

## Ecosystem finance and margin truth

The operating model defines creator, service-program, fan-cohort, campaign, offer, partner, sponsor, market/community, and acquisition-channel dimensions. Measures include GMV, creator earnings, platform commission, partner and sponsor revenue, provider fees, refunds, disputes, payout state, support/infrastructure/model cost proxies, and contribution margin.

Only stored purchase rates, fee amounts, leakage, and cost events are used. Missing rates and costs remain instrumentation gaps. Creator-service cost remains a stored estimate, not a ledger actual. Every external finance, partner, investor, or public claim requires ledger reconciliation.

## Multi-market controls

Every market/community review covers payment fit, payout fit, creator supply, fan demand, support coverage, moderation capacity, rights/takedown, partner readiness, low-bandwidth performance, and data/privacy. States are research, partner seed, creator seed, controlled launch, growth, hold, and exit. Hold and exit are normal results.

The model prevents controlled launch or growth when any gate is missing, blocked, unreviewed, or lacks evidence. A human approval, cost cap, metric, stop condition, and review date are mandatory.

## Platform governance and resilience

Automated governance checks cover campaign approvals, sponsored approval expiry, partner-report privacy, high-risk payout changes, refund/dispute and recommendation complaint thresholds, Akuso release gates, and stale decisions. Checks flag evidence; they cannot approve a sensitive action.

Seven drill contracts cover campaign traffic, partner deadlines, payout backlog, entitlement delay, live surge, recommendation complaints, and Akuso regression. A drill definition is never counted as execution. Only a server-owned drill event creates observed evidence and may attach an outcome, cost, follow-up owner, and rollback record.

## Akuso boundary

Akuso can explain creator services, community loops, partner integration levels, ecosystem finance, market readiness, governance checklists, and escalation paths. Deterministic fallbacks are provided for each new explanation type. Six eval suites cover creator-service claims, fan messaging, partner privacy, finance/payout escalation, multi-market readiness, and API/export refusal.

Partner-facing, finance-facing, investor-facing, public, moderation-impacting, and market-launch text remains a draft pending authorized review. Akuso cannot enroll a creator, message a fan, grant partner access, export data, approve a sponsor, reconcile finance, move money, change a market state, or launch a network.

## Creator business network boundary

`NETWORK-001` defines network, membership, shared program, network offer, and network decision objects. Membership requires explicit creator consent, visible benefit and commitment, creator ownership of catalog and payouts, a leave/revocation path, and no private fan-data sharing.

Pooled creator wallets, automatic revenue splits, cross-creator fan exports, unreviewed sponsor access, and Akuso membership decisions are prohibited. Purchases, creator shares, payouts, refunds, and settlement remain attributable to existing ledger authorities. Network pilots are reserved for later packages.

## Protected interfaces

Read/report interface:

- `GET /api/admin/analytics/ecosystem-network-operating-system`

Audited admin mutations:

- `POST /api/admin/growth/creator-services`
- `PATCH /api/admin/growth/creator-services/:enrollmentId`
- `POST /api/admin/growth/community-loops`
- `PATCH /api/admin/growth/community-loops/:loopId`
- `POST /api/admin/partnerships/integrations`
- `PATCH /api/admin/partnerships/integrations/:integrationId`
- `POST /api/admin/growth/market-readiness`
- `PATCH /api/admin/growth/market-readiness/:marketId`

Admin Analytics and JSON export consume the same server-built report. The Creator Dashboard receives only the current creator's service portfolio.

## Verification anchors

- Backend contracts and model invariants: `backend/tests/ecosystemNetworkOperatingService.test.js`
- Protected route, persistence, and audit coverage: `backend/tests/ecosystemNetworkRoutes.test.js`
- Admin operating view: `frontend/src/components/admin/__tests__/EcosystemNetworkOperatingPanels.test.jsx`
- Creator service view: `frontend/src/components/creator/__tests__/CreatorServicesPanel.test.jsx`
- Executable implementation: `backend/services/ecosystemNetworkOperatingService.js`
- Akuso ecosystem fallbacks and evals: `backend/services/assistant/writingProfiles.js` and `backend/services/akusoEvalRunner.js`
