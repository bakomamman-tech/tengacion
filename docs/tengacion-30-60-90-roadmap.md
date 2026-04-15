# Tengacion 30/60/90 Day Execution Roadmap

## Purpose

This roadmap turns the current Tengacion MVP into an execution sequence the team can ship against. It follows the priority order already identified for the product:

1. Payments and payouts
2. Creator onboarding and subscriptions
3. Discovery and analytics
4. Akuso eval loop
5. Personalized recommendations

The goal is not to do everything at once. The goal is to build the product in the order that creates revenue, creator trust, usable feedback loops, and then scalable AI leverage.

## Current baseline

The repo already has:

- creator marketplace MVP flows
- chat, creator pages, uploads, and purchase primitives
- Akuso backend routes, policy pipeline, metrics, and eval scaffolding
- news, live, video, and creator discovery surfaces

Important current gaps:

- billing and music purchase flows still contain placeholder or `501` responses
- creator subscriptions and payout operations are not complete end-to-end
- advanced analytics, recommendations, and fraud/risk systems are still phase-3 level work
- Akuso has a strong backend foundation, but it still needs a disciplined eval and quality loop before broader expansion

## North-star outcomes for the next 90 days

By the end of this plan, Tengacion should aim to have:

- working purchase and payout flows for real creator commerce
- a cleaner creator activation path from signup to earning
- measurable marketplace and assistant quality metrics
- an operating Akuso eval loop tied to real feedback
- the first safe version of personalized discovery and recommendations

## Product principles

- Commerce before novelty: finish the flows that make creators money before adding more surfaces.
- Grounding before scale: Akuso should know real Tengacion capabilities before it becomes more ambitious.
- Metrics before optimization: do not ship ranking or personalization without baseline analytics.
- Safety before automation: account, payment, payout, and moderation actions remain deterministic and backend-authorized.
- Feedback before fine-tuning: improve Akuso through evals, prompts, policy, and grounding before considering model fine-tuning.

## Core workstreams

### Workstream A: Commerce foundation

Objective:
Make Tengacion trustworthy for earning, buying, entitlement checks, and payouts.

Primary repo areas:

- `backend/routes/`
- `backend/controllers/`
- `backend/services/`
- `backend/models/`
- `frontend/src/pages/`
- `frontend/src/components/creator/`

### Workstream B: Creator activation and retention

Objective:
Reduce the time from signup to first meaningful creator action, first publish, and first earnings event.

Primary repo areas:

- creator onboarding and dashboard surfaces
- creator categories and workspace flows
- verification, support, and subscription UX

### Workstream C: Discovery and analytics

Objective:
Make it easier for fans to find creators and easier for creators to understand what is working.

Primary repo areas:

- `docs/personalized-discovery-architecture.md`
- creator discovery services and ranking
- admin and creator analytics dashboards
- feed ranking and measurement services

### Workstream D: Akuso quality and training

Objective:
Turn Akuso into a reliable product layer with eval-driven improvement, not just ad hoc prompt changes.

Primary repo areas:

- `docs/akuso-backend-engine.md`
- `backend/controllers/akusoController.js`
- `backend/services/akuso*`
- `backend/tests/akuso*`
- assistant admin review surfaces

## Success metrics

Track these every week:

- GMV
- successful purchase rate
- payout success rate
- time to creator first publish
- time to creator first earnings event
- creator D7 and D30 retention
- fan purchase conversion rate
- creator discovery CTR
- creator dashboard weekly active usage
- Akuso helpful rate
- Akuso fallback rate
- Akuso prompt injection rate
- Akuso unresolved quality backlog count

## First 30 days

### Theme

Make Tengacion economically real.

### Product goals

- Replace billing and purchase stubs with working provider-backed flows
- Make entitlements reliable and auditable
- Define payout readiness and payout support states
- Instrument baseline commerce and Akuso quality metrics

### Deliverables

#### 1. Ship working purchase flows

- Replace `501` billing responses with real implementations for:
  - one-time content purchases
  - creator membership or subscription checkout
- Standardize provider handling for:
  - NGN via Paystack
  - USD via Stripe
- Add purchase status states:
  - initiated
  - pending
  - paid
  - failed
  - refunded
- Harden webhook handling and replay protection

#### 2. Harden entitlements and library access

- Guarantee that paid content unlocks correctly after successful payment
- Add clear entitlement checks around:
  - tracks
  - books
  - creator membership access
- Add admin-visible audit trail for payment to entitlement transitions

#### 3. Define payout readiness, not full payout automation yet

- Introduce payout readiness states:
  - not_started
  - profile_incomplete
  - verification_pending
  - payout_method_missing
  - ready
  - restricted
- Expose creator-facing explanation and next steps in dashboard UI
- Keep sensitive payout actions deterministic and secured

#### 4. Add baseline analytics and operations visibility

- Track:
  - purchase attempts
  - purchase success and failure
  - webhook processing outcomes
  - entitlement grant success/failure
  - creator onboarding step completion
- Make these visible through admin/internal dashboards or reports

#### 5. Start Akuso training loop with instrumentation, not fine-tuning

- Define top assistant intents from real product goals:
  - app help
  - creator writing
  - purchase and subscription guidance
  - creator onboarding help
  - payout readiness guidance
- Save and review:
  - negative feedback
  - fallbacks
  - unanswered feature gaps
  - policy denials that need better UX copy
- Convert the first batch into eval cases

### Exit criteria for day 30

- creators can sell at least one content type end-to-end
- users can buy and unlock content end-to-end
- payout readiness is visible and understandable
- payment and entitlement events are measurable
- Akuso quality review has a weekly cadence and an initial eval set

## Days 31-60

### Theme

Help creators succeed faster and more often.

### Product goals

- streamline creator onboarding
- add creator subscriptions or fan pass support
- improve creator dashboard and support flows
- connect Akuso to the creator journey more intentionally

### Deliverables

#### 1. Redesign creator onboarding for activation

- Reduce onboarding to the smallest sequence needed to publish
- Separate required vs optional setup
- Add explicit step states:
  - account created
  - creator lane selected
  - profile ready
  - first upload started
  - first upload completed
  - payment readiness started
- Add save-and-resume behavior

#### 2. Complete creator subscription flow

- Ship subscription checkout and lifecycle handling:
  - subscribe
  - renew
  - cancel
  - grace period
  - expired
- Make subscription benefits explicit in creator and fan-facing surfaces
- Add creator settings for subscription configuration

#### 3. Improve creator dashboard from status page to operating console

- Show:
  - recent sales
  - recent subscribers
  - top-performing content
  - payout readiness
  - content needing metadata fixes
- Add actionable prompts, not just stats

#### 4. Make Akuso useful inside creator workflows

- Expand grounded feature coverage for:
  - onboarding
  - subscriptions
  - earnings
  - payouts
  - uploads and catalog management
- Add creator-focused eval sets:
  - onboarding navigation
  - pricing and packaging guidance
  - content metadata help
  - support triage answers

#### 5. Launch a real quality operations loop

- Weekly review for:
  - commerce failures
  - onboarding drop-off
  - creator support pain points
  - Akuso negative feedback and fallback spikes
- Every review should produce:
  - one product fix
  - one assistant fix
  - one instrumentation fix

### Exit criteria for day 60

- creator signup to first publish is materially shorter
- subscriptions are live and measurable
- creator dashboard is used for action, not just observation
- Akuso has creator-workflow eval coverage and a growing quality backlog

## Days 61-90

### Theme

Turn usage into compounding growth.

### Product goals

- improve creator discovery and ranking
- add meaningful creator and marketplace analytics
- ship the first safe recommendation layer
- make Akuso evaluation continuous

### Deliverables

#### 1. Ship discovery ranking improvements

- Upgrade creator discovery using:
  - quality signals
  - category relevance
  - recency
  - engagement
  - conversion indicators
  - diversity controls
- Add editorial or featured collections for cold-start support

#### 2. Launch meaningful creator analytics

- Add:
  - funnel views from impression to click to purchase
  - subscriber churn and retention
  - content-level conversion
  - cohort revenue
  - repeat buyer indicators
- Ensure dashboards answer:
  - what worked
  - what changed
  - what to do next

#### 3. Ship first-pass personalized recommendations

- Scope this narrowly at first:
  - creator discovery ranking
  - content recommendations
  - news/feed personalization
- Keep cold-start fallbacks deterministic
- Add guardrails for diversity and overfitting

#### 4. Move Akuso from reactive help to measured product intelligence

- Run evals on every major assistant update
- Expand assistant metrics review to include:
  - helpful rate by mode
  - quality by feature area
  - policy-denial quality
  - fallback rate by route
- Add route-specific quality targets for:
  - home
  - creator dashboard
  - subscriptions
  - purchases
  - settings

#### 5. Decide whether fine-tuning is justified

Only consider fine-tuning if all of the following are true:

- you have stable repeated use cases
- you have enough labeled examples
- prompts and evals are no longer the main bottleneck
- the behavior you want is style-heavy or domain-repetitive enough to justify it

If those conditions are not met, continue improving:

- prompt construction
- retrieval and grounding
- feature registry coverage
- route-specific evals
- safety and refusal quality

### Exit criteria for day 90

- discovery ranking is measurably better
- creator analytics are actionable
- recommendations improve engagement or conversion without reducing trust
- Akuso is reviewed and improved through a repeatable eval system

## Akuso training roadmap

This workstream should run in parallel with product shipping.

### Phase 1: Data and eval foundation

- review assistant logs and feedback weekly
- create labeled buckets for:
  - wrong navigation guidance
  - hallucinated feature claims
  - low-quality creator writing
  - refusal where help should have been given
  - unsafe answer that should have been blocked
- convert those cases into eval fixtures

### Phase 2: Route and feature grounding

- expand feature registry coverage for all monetization, onboarding, and creator surfaces
- add route-aware hints where users routinely stall
- add better conservative fallbacks for unsupported features

### Phase 3: Quality automation

- run Akuso evals before deployment
- compare:
  - helpful rate
  - fallback rate
  - denial quality
  - route-specific failure rate
- gate releases when critical evals regress

### Phase 4: Personalization and memory refinement

- refine low-risk memory only after baseline quality is stable
- keep memory bounded and role-aware
- do not let memory become a proxy for unsafe personalization

## Weekly operating cadence

### Monday

- review product metrics
- review Akuso metrics
- lock the week's top three shipping priorities

### Wednesday

- review creator onboarding and purchase funnel drop-offs
- triage assistant failures and eval additions

### Friday

- demo shipped work
- compare metrics to prior week
- update the roadmap status

## Decision rules

- If commerce is unstable, discovery work pauses.
- If onboarding is broken, recommendations are not the priority.
- If Akuso is hallucinating feature behavior, expand grounding before changing models.
- If negative assistant feedback rises, review route-specific failures before shipping new assistant modes.
- If the team is overloaded, protect the sequence:
  - payments and payouts
  - creator onboarding and subscriptions
  - discovery and analytics
  - Akuso eval loop
  - personalized recommendations

## Repo-linked backlog

### Payments and payouts

- implement provider-backed billing endpoints
- finish payout readiness and creator finance flows
- add webhook reliability tests
- add entitlement reconciliation jobs

### Creator onboarding and subscriptions

- simplify creator onboarding states and UI
- complete creator membership checkout and lifecycle
- improve creator dashboard actionability
- add support escalation for blocked creator flows

### Discovery and analytics

- ship creator discovery ranking improvements
- add conversion funnels and cohort analytics
- expose analytics in creator and admin dashboards
- define recommendation eligibility and fallback rules

### Akuso training

- expand feature registry coverage
- add route-specific eval cases
- formalize assistant quality backlog triage
- review metrics snapshots and analytics-backed assistant alerts weekly

## What not to do yet

- do not jump to broad fine-tuning before the eval loop is mature
- do not ship unconstrained assistant actions for payments, payouts, or account security
- do not build complex recommendation models before baseline analytics and attribution are reliable
- do not over-expand surfaces before creator earnings flows are trustworthy

## Suggested ownership split

- Product and marketplace: commerce, onboarding, subscriptions, creator dashboard
- Infrastructure and backend: payments, entitlements, webhooks, payout readiness, analytics pipelines
- AI and assistant: Akuso evals, registry coverage, prompts, route hints, metrics review
- Design and frontend: creator conversion surfaces, subscription UX, discovery UX, analytics UX

## Review cadence for this document

Update this roadmap every two weeks with:

- shipped items
- blocked items
- changed priorities
- metric movement
- assistant quality movement

If a phase completes early, move forward. If a phase is blocked, do not fake progress. Re-scope and preserve the order of execution.
