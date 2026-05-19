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

- billing and legacy music commerce surfaces now have provider-backed and entitlement-aware coverage, but still need broader production monitoring
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
- Current implementation anchors:
  - `/api/billing/purchase` and `/api/billing/subscribe` initialize real Paystack or Stripe checkouts through the shared payment service
  - `/api/music/tracks` now bridges legacy track creation, preview, and stream routes into the real track pipeline instead of returning service-unavailable stubs
  - entitlement-aware stream access is covered for unpaid previews and paid full playback

#### 2. Harden entitlements and library access

- Guarantee that paid content unlocks correctly after successful payment
- Add clear entitlement checks around:
  - tracks
  - books
  - creator membership access
- Add admin-visible audit trail for payment to entitlement transitions
- Current implementation anchors:
  - paid track, book, album, and video purchases are now covered by an idempotent entitlement reconciliation job that backfills missing entitlement records and logs grant events for admin audit trails

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
- Current implementation anchors:
  - `buildPayoutReadiness` now centralizes creator payout readiness states, creator-facing copy, support flow routing, blocking reasons, primary actions, and the request gate without introducing automated payout execution
  - the creator payouts page renders payout request availability and follows the readiness API's recommended next action instead of sending every creator to settings
  - focused backend and creator wallet page tests cover masked account display, state-specific actions, profile-vs-payout blocker copy, and ready payout request availability

#### 4. Add baseline analytics and operations visibility

- Track:
  - purchase attempts
  - purchase success and failure
  - webhook processing outcomes
  - entitlement grant success/failure
  - creator onboarding step completion
- Make these visible through admin/internal dashboards or reports
- Current implementation anchor:
  - `/api/admin/analytics/commerce-ops` now returns a focused operations snapshot for purchase attempts, checkout failures, payment success/failure, webhook status outcomes, replay counts, entitlement continuity gaps, and creator onboarding step completions
  - admin analytics now renders the commerce ops snapshot beside the existing revenue and operational health views, and analytics exports include the new baseline ops fields
  - daily analytics backfills now persist purchase attempt, checkout, webhook, entitlement grant, and entitlement gap counters so operations reviews can be rebuilt from the same source of truth

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
- Current implementation anchor:
  - negative assistant feedback and Akuso feedback now flow into the admin assistant review queue with triage metadata for quality, safety, grounding, and abuse review
  - `/api/admin/assistant/eval-candidates` converts unresolved review items into feedback-derived eval fixture drafts with quality buckets, suite suggestions, tags, expected-behavior labels, source review links, and human-labeling flags
  - the Akuso Assistant Ops page now includes an Eval Candidates tab so admins can inspect review-derived fixture drafts beside the existing metrics and review queue before promoting them into seeded evals

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
- Current implementation anchor:
  - creator activation analytics now tracks the full six-step onboarding path, including first upload started and first upload completed milestones from creator music, podcast, book, album, and video upload flows

#### 2. Complete creator subscription flow

- Ship subscription checkout and lifecycle handling:
  - subscribe
  - renew
  - cancel
  - grace period
  - expired
- Make subscription benefits explicit in creator and fan-facing surfaces
- Add creator settings for subscription configuration
- Current implementation anchor:
  - creators can configure monthly subscription price, checkout description, and supporter benefits from profile settings; public creator pages and subscription checkout now render the saved membership packaging
  - cancelled creator memberships now expose a resume-renewal action before expiry, so users can move from cancel-scheduled or grace-period status back to active renewal without starting a duplicate checkout

#### 3. Improve creator dashboard from status page to operating console

- Show:
  - recent sales
  - recent subscribers
  - top-performing content
  - payout readiness
  - content needing metadata fixes
- Add actionable prompts, not just stats
- Current implementation anchor:
  - `/api/creator/me/content-summary` now returns an `operatingConsole` payload with funnel counters, action prompts, top content, metadata fixes, recent sales, and recent subscribers
  - the creator dashboard renders payout readiness, recent commerce activity, top-performing content, and metadata repair prompts in the main workspace

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
- Current implementation anchor:
  - `backend/services/akusoEvalRunner.js` now includes a `creator_workflow` eval suite covering onboarding navigation, subscription packaging, book metadata help, and creator support triage

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
- Current implementation anchor:
  - `/api/admin/assistant/metrics` now returns an `operationsReview` payload that combines commerce failures, webhook outcomes, creator onboarding drop-off, assistant fallback rates, negative feedback, and unresolved Akuso review backlog
  - the admin Akuso Assistant Ops page renders a weekly quality loop with product, assistant, and instrumentation action prompts tied to the relevant admin surfaces
  - the creator support page now submits flow-tagged escalation tickets for blocked onboarding, payout readiness, upload/catalog, and verification issues through the admin complaint inbox
  - the assistant review queue now exposes per-item triage recommendations, queue-level backlog summaries, and admin-editable category/severity/status fields so weekly reviews can produce structured assistant fixes and eval candidates

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
- Current implementation anchor:
  - discovery ranking now supports configurable featured collections for cold-start users through `DISCOVERY_FEATURED_CREATOR_IDS`, `DISCOVERY_FEATURED_AUTHOR_USER_IDS`, `DISCOVERY_FEATURED_USERNAMES`, `DISCOVERY_FEATURED_TOPICS`, and `DISCOVERY_FEATURED_CONTENT_TYPES`
  - featured matches receive a bounded cold-start boost, return a `featured_collection` explanation label, and persist featured collection diagnostics into recommendation logs for audit and analytics

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
- Current implementation anchor:
  - recommendation logs now retain creator exposure counts, best ranks, and ranked item refs for aggregate creator-facing analysis
  - `GET /api/creator/discovery/insights` returns 7/30/90-day recommendation impressions, clicks, follows, negative feedback, surface breakdowns, and action prompts
  - `GET /api/creator/discovery/content/:itemType/:itemId` returns item-level recommendation impressions, clicks, preview/stream/download actions, purchases, revenue, conversion rates, surface/rank breakdowns, and action prompts for creator-owned content
  - `GET /api/creator/subscriptions/analytics` returns subscription churn, retention, renewal, repeat-subscriber, cohort revenue, recent subscriber, and action-prompt analytics; the creator content summary includes the same 30-day payload for dashboard use
  - the creator dashboard renders discovery insights beside the operating console so creators can see how recommendation surfaces are introducing fans to their catalog

#### 3. Ship first-pass personalized recommendations

- Scope this narrowly at first:
  - creator discovery ranking
  - content recommendations
  - news/feed personalization
- Keep cold-start fallbacks deterministic
- Add guardrails for diversity and overfitting
- Current implementation anchor:
  - the home feed now requests `/api/discovery/home` first, carries recommendation metadata through `PostCard`, and falls back to the legacy `/api/posts` feed if discovery is unavailable
  - the live directory now requests `/api/discovery/live` first, shows ranked explanation labels, tracks `live_joined` clicks, and falls back to `/api/live/active` when discovery is unavailable
  - creator public pages now render a `Recommended for you` rail from `/api/discovery/creator-hub`, joining ranked IDs back to entitlement-aware content objects before preview, stream, download, or checkout actions
  - discovery responses now include backend eligibility and fallback diagnostics, with blocked/muted/restricted authors filtered before ranking and the same metadata retained in recommendation logs for audit and analytics
  - focused frontend coverage verifies personalized home, live, and creator-hub rendering plus fallback continuity

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
- Current implementation anchor:
  - `backend/services/akusoEvalRunner.js` defines route-quality fixtures and target thresholds for these routes
  - `backend/scripts/runAkusoEvals.js` reports route pass rates and fails full eval runs when an enforced route target regresses

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
- Current implementation anchor:
  - `/api/admin/assistant/metrics` now returns a fine-tuning readiness gate with repeated-use-case, labeled-example, backlog, quality, safety, and reliability criteria
  - the Akuso Assistant Ops metrics view renders the readiness decision, blockers, top repeated use cases, and links back to reviews and eval candidates so admins can keep fine-tuning behind evidence instead of instinct

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
- current implementation anchor:
  - `backend/services/akusoEvalRunner.js` maintains seeded eval fixtures with suite, severity, and tag summaries
  - `backend/scripts/runAkusoEvals.js` can generate JSON reports for weekly review or deployment artifacts

### Phase 2: Route and feature grounding

- expand feature registry coverage for all monetization, onboarding, and creator surfaces
- add route-aware hints where users routinely stall
- add better conservative fallbacks for unsupported features
- current implementation anchor:
  - Akuso's assistant feature registry now covers creator content detail pages, payment callback/status routes, public creator profile hubs, and marketplace buyer/seller/order/payout surfaces
  - `/creators` route matching is now precise enough that creator subscriptions and catalog pages stay grounded to their specific surfaces instead of falling back to generic discovery
  - focused service and assistant route tests verify marketplace monetization navigation, payment status grounding, content unlock grounding, public creator hub grounding, and route-aware marketplace payout hints

### Phase 3: Quality automation

- run Akuso evals before deployment
- compare:
  - helpful rate
  - fallback rate
  - denial quality
  - route-specific failure rate
- gate releases when critical evals regress
- current implementation anchor:
  - route-quality summaries now include `byRoute`, `routeTargets`, and `failedRouteTargets`
  - filtered eval runs keep route target diagnostics visible while full eval runs enforce the route gates

### Phase 4: Personalization and memory refinement

- refine low-risk memory only after baseline quality is stable
- keep memory bounded and role-aware
- do not let memory become a proxy for unsafe personalization
- current implementation anchor:
  - Akuso conversation memory now stores a low-risk memory version with redacted secrets, payment/account identifiers, and unsafe external routes removed before persistence
  - saved memory is tagged with authenticated, creator, or admin role scope, and higher-privilege memory is suppressed when a later request no longer has that access level
  - Akuso service coverage verifies redaction, route sanitization, creator/admin role scoping, and suppressed-memory behavior

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
