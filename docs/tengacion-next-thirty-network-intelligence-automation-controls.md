# Tengacion Network, Intelligence, and Automation Control Contract

Implemented: 1 September 2026

Scope: `NETWORK-002` through `NETWORK-015`, `INTELLIGENCE-001` through `INTELLIGENCE-015`, and `AUTOMATION-001`.

## Outcome

This batch establishes a durable creator-business network and governed intelligence layer. It does not claim that real-world pilots have produced outcomes when no evidence exists, that finance is reconciled when it is not, that partner enthusiasm grants access, that predictive warnings are confirmed incidents, or that an automation candidate can execute.

The protected operating view is available at:

```text
GET /api/admin/analytics/network-intelligence-operating-system
```

Creator-owned intelligence feedback is available at:

```text
PATCH /api/creator/intelligence/prompts/:promptId
```

## Durable authorities

| Authority | Purpose | Enforced boundary |
|---|---|---|
| `NetworkProgramEnrollment` | Consented creator network pilots, collaborators/providers, baselines, outcomes, costs, satisfaction, and review | Active/completed participation requires creator consent; earnings cannot exceed stored gross value; no pooled wallet or inferred causality |
| `PartnerAccessGraduation` | Manual report through approved API integration readiness | All 12 gates require reviewed evidence and human approval; permanent protected-data prohibitions remain in force |
| `MetricContract` | Owner, sources, calculation, freshness, limitations, privacy, decisions, export, and trust | Trusted state requires observed evidence; freshness is derived at read time; withdrawn metrics are blocked |
| `IntelligenceProduct` | Governed creator, internal, partner, API-candidate, and Akuso products | Pilot/active use requires human approval; stale, disputed, or blocked sources pause active output |
| `CreatorIntelligencePrompt` | Explainable creator-self suggestions and feedback | Only the owning creator can act, dismiss, hide, mark irrelevant, or request help; private fan rows are excluded |
| `PredictiveWarning` | Confidence-bearing early warnings with owner, runbook, review, and rollback | A warning is hypothesis-only; resolved states require a review note and timestamp |
| `AutomationRegistryEntry` | Candidate owner, trigger, signals, action, risk, approval, audit, visibility, pause, rollback, metrics, and cadence | `AUTOMATION-001` accepts only proposed/designed/review-required governance; pilot/active transitions return `409` |

## Package implementation map

### Network

| Package | Implemented control |
|---|---|
| NETWORK-002 | Eight advocacy-loop definitions expose aggregate movement, opt-in, campaign, and referral totals with frequency, ignore, abuse, complaint, sensitive-category, refund/dispute, and risk suppression. |
| NETWORK-003 | Seven partner/channel levels and explicit allowed/prohibited data, consent, labeling, expiry, audit, revocation, retention, renewal, and owner contracts. |
| NETWORK-004 | Ten finance dimensions, 15 measures, five reconciliation checks, and an immutable ledger/settlement truth boundary. |
| NETWORK-005 | Ten governed data products plus source, audience, privacy, quality, cadence, decision, reviewer, export, and withdrawal contracts. |
| NETWORK-006 | Durable creator network programs capture consent, baseline, steps, collaborators/providers, finance, support, satisfaction, outcome, review, and history. |
| NETWORK-007 | Existing controlled community programs are composed into the network view with aggregate-only reporting and pause scopes by creator, cohort, surface, and loop type. |
| NETWORK-008 | Partner graduation records the first scoped access path without bypassing the existing partner authority. |
| NETWORK-009 | The dashboard composes finance and settlement state but blocks external claims until ledger, report, provider, payout, partner, and campaign checks reconcile. |
| NETWORK-010 | Seven Akuso network topics and seven release evals preserve privacy, finance, partner, API, and execution refusals. |
| NETWORK-011 | Program reviews expose scale, repeat-with-changes, concierge-only, pause, and retire decisions using stored outcomes. |
| NETWORK-012 | Advocacy health remains aggregate and includes visible suppression and guardrail state. |
| NETWORK-013 | API graduation requires data contract, permission, revocation, rate limits, audit, security, privacy, retention, rollback, renewal, finance, and export reliability. |
| NETWORK-014 | Admin Analytics combines programs, advocacy, partner/API, finance, trust, products, risk, and Akuso evidence. |
| NETWORK-015 | A bounded network report names blockers and permitted next decisions without making external claims. |

### Intelligence

| Package | Implemented control |
|---|---|
| INTELLIGENCE-001 | Fifteen core metric contracts use trusted, watch, stale, disputed, and blocked states; only fresh trusted contracts can drive decisions. |
| INTELLIGENCE-002 | Ten intelligence products define audience, owner, cadence, sources, confidence, privacy, permitted action, reviewer, and withdrawal. |
| INTELLIGENCE-003 | Creator surfaces provide explainable optional prompts; admin surfaces expose stage, opportunity, support, payout, service-fit, and watchlist contracts. |
| INTELLIGENCE-004 | Partner, export, dashboard, campaign, sponsor, and API readiness remain separately gated and revocable. |
| INTELLIGENCE-005 | Akuso summaries require source, timeframe, confidence, limitations, and visible trust state; sensitive approval and private inference remain prohibited. |
| INTELLIGENCE-006 | The trusted dashboard reports metric freshness, product quality, creator feedback, fan/community aggregates, partner/API state, finance, warning, and Akuso evidence. |
| INTELLIGENCE-007 | Creator prompts durably track shown, acted, completed, dismissed, hidden, help-requested, feedback, and expiry states. |
| INTELLIGENCE-008 | Fan and community tuning uses aggregate loop health and makes suppression visible. |
| INTELLIGENCE-009 | Partner/API readiness exposes every blocker and reviewed gate rather than substituting commercial interest. |
| INTELLIGENCE-010 | Seven Akuso summaries and seven eval suites cover source quality, confidence, privacy, finance, API, unsupported automation, and stale warnings. |
| INTELLIGENCE-011 | Product reviews permit internal, creator, partner, API-candidate, automation-candidate, pause, and retire outcomes. |
| INTELLIGENCE-012 | Creators can dismiss, hide, mark irrelevant, ask for explanation/help, and review source metadata. |
| INTELLIGENCE-013 | Manual report through limited/approved API candidates require consent, privacy/security, audit, revocation, rate limits, rollback, and renewal evidence. |
| INTELLIGENCE-014 | Ten predictive-warning types carry confidence, impact, owner, sources, runbook, review, rollback, and false-positive disposition. |
| INTELLIGENCE-015 | A bounded intelligence report names trust/product/risk blockers and keeps external use separately approved. |

### Automation

| Package | Implemented control |
|---|---|
| AUTOMATION-001 | A durable registry defines candidate ownership, affected actor, trigger, signals, action, risk, approval, audit, visible status, pause, rollback, success, guardrails, cadence, and lifecycle while explicitly granting no execution authority. |

## Admin mutation routes

```text
POST/PATCH /api/admin/growth/network-programs[/:programId]
POST/PATCH /api/admin/partnerships/graduations[/:graduationId]
POST/PATCH /api/admin/intelligence/metric-contracts[/:contractId]
POST/PATCH /api/admin/intelligence/products[/:productId]
POST       /api/admin/intelligence/creator-prompts
POST/PATCH /api/admin/intelligence/predictive-warnings[/:warningId]
POST/PATCH /api/admin/operations/automation-registry[/:automationId]
```

All mutations require admin authentication, use the existing mutation limiter, validate model invariants, and write an audit record after successful persistence.

## Truth and privacy rules

- Empty pilots and products report zero or `not_configured`; they are never backfilled with invented outcomes.
- Only trusted, fresh, non-withdrawn metrics may drive a governed recommendation.
- Creators receive only creator-self program records and prompts; private fan behavior, payment identifiers, identity-verification material, and moderation-sensitive detail are excluded.
- Partner/API approval is distinct from the existing integration access authority and requires every evidence gate.
- Finance remains internal until existing ledger and settlement authorities reconcile it.
- Predictive warnings are hypotheses and have no restriction, payment, entitlement, removal, messaging, or runbook-execution authority.
- `AUTOMATION-001` is registry-only. No automation was activated by this implementation.

## Verification

Focused verification covers:

- the exact 30-package sequence;
- consent, protected-data, partner-gate, metric-trust, product-approval, warning-review, and automation rollback invariants;
- protected admin report and mutation routes;
- creator ownership of prompt feedback;
- audit records for every new admin mutation family;
- a `409` refusal for automation activation;
- Akuso writing and release-eval coverage;
- Admin Analytics and Creator Dashboard rendering and controls.
