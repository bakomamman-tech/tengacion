# Tengacion Next 30/60/90 Day Execution Roadmap

Follow-on roadmap:
[Tengacion Scale 30/60/90 Day Execution Roadmap](./tengacion-scale-30-60-90-roadmap.md)

## Purpose

This roadmap is the next execution cycle after the first Tengacion 30/60/90 roadmap. The first cycle made the marketplace, creator commerce, discovery, analytics, and Akuso foundations real. This cycle is about turning that foundation into a production operating system:

1. Reliability and observability
2. Revenue operations and payout confidence
3. Creator growth loops
4. Fan retention and community depth
5. Trust, safety, and Akuso governance

The goal is to move Tengacion from "features exist" to "the business can run every week with confidence."

## Starting baseline

This plan assumes the previous roadmap has produced these anchors:

- provider-backed Paystack and Stripe checkout flows
- entitlement reconciliation and admin audit visibility
- creator payout readiness states and creator-facing guidance
- baseline commerce operations analytics
- creator onboarding analytics and a more actionable creator dashboard
- creator subscription checkout, cancellation, grace, and resume-renewal flows
- discovery ranking across home, live, and creator hub surfaces
- creator-facing discovery and subscription analytics
- Akuso feature grounding, feedback review, eval candidates, route-quality targets, memory safeguards, and a fine-tuning readiness gate

The remaining problem is not a lack of surfaces. It is consistency, trust, weekly execution, and measurable growth.

## North-star outcomes for the next 90 days

By the end of this plan, Tengacion should have:

- production monitoring for checkout, entitlements, payouts, media, discovery, and Akuso
- creator payout operations that can be reviewed, approved, retried, and audited
- creator growth tooling that helps creators improve catalog quality and repeat earnings
- fan retention loops across follows, saves, notifications, subscriptions, live, and paid content
- trust and risk controls for commerce, recommendations, content, and assistant behavior
- a weekly operating dashboard that shows what moved, what broke, and what must ship next

## Product principles

- Stabilize before expanding: growth work pauses when commerce or access control is unstable.
- Every money movement needs a ledger trail: purchases, refunds, commissions, payouts, and reversals must be explainable.
- Creators need actions, not just metrics: every creator analytics view should suggest the next practical step.
- Recommendations must remain accountable: every ranked result should have an eligibility reason, score explanation, and fallback path.
- Akuso remains assistive, not autonomous: sensitive account, payment, payout, moderation, and admin actions stay backend-authorized.
- Local market fit matters: NGN-first commerce, creator payout clarity, mobile performance, and low-bandwidth media paths are priority constraints.

## Core workstreams

### Workstream A: Production reliability

Objective:
Make critical systems observable, alertable, and recoverable.

Primary areas:

- payment callbacks and webhooks
- entitlement reconciliation
- media upload and playback
- live session creation and token issuance
- discovery ranking fallbacks
- Akuso latency, fallback, refusal, and eval health
- admin operations dashboards

### Workstream B: Revenue and payout operations

Objective:
Move from payout readiness to controlled payout execution and finance review.

Primary areas:

- creator wallet and ledger records
- payout request review
- payout batch export or provider execution
- refund and dispute tracking
- platform commission reporting
- admin finance controls

### Workstream C: Creator growth and catalog quality

Objective:
Help creators publish better, package better, and earn repeatedly.

Primary areas:

- creator dashboard prompts
- catalog metadata quality
- subscription packaging
- bundles and fan offers
- creator announcements
- Akuso creator workflow guidance

### Workstream D: Fan retention and community depth

Objective:
Turn one-time discovery into repeat engagement and paid relationships.

Primary areas:

- follows and subscriptions
- saved content and continue flows
- notifications
- live reminders
- repeat buyer and repeat listener loops
- personalized but explainable content rails

### Workstream E: Trust, safety, and governance

Objective:
Protect marketplace trust as recommendation, commerce, and assistant systems grow.

Primary areas:

- fraud and abuse signals
- creator quality and trust scores
- content reports and moderation queues
- recommendation complaint and hide rates
- Akuso review queues and eval gates
- admin audit logs

## Success metrics

Track these weekly:

- checkout success rate
- webhook success rate
- entitlement delay rate
- refund and dispute rate
- payout request approval time
- payout failure rate
- GMV
- net creator earnings
- platform commission
- creator first publish rate
- creator second publish rate
- creator D7 and D30 retention
- subscription activation and renewal rate
- repeat buyer rate
- fan D7 and D30 retention
- discovery CTR
- recommendation hide/report rate
- media upload failure rate
- live join success rate
- Akuso helpful rate
- Akuso fallback rate
- Akuso route-target pass rate
- unresolved admin operations backlog

## First 30 days

### Theme

Make the product operable.

### Product goals

- add production-grade monitoring around the highest-risk flows
- define a finance ledger and payout review model
- tighten creator dashboard actions around catalog and revenue readiness
- improve fan return paths through saves, follows, and notifications
- formalize trust and Akuso weekly review gates

### Deliverables

#### 1. Establish reliability dashboards and alerts

- Add health snapshots for:
  - payment initialization
  - Paystack verification
  - Stripe webhook processing
  - entitlement reconciliation
  - media upload failures
  - live session creation failures
  - discovery endpoint fallback rate
  - Akuso request latency and fallback rate
- Add severity levels:
  - watch
  - degraded
  - incident
  - blocked
- Create admin-facing incident notes with:
  - affected surface
  - start time
  - current status
  - owner
  - next action
- Add runbook docs for checkout failure, webhook delay, entitlement mismatch, payout blocker, discovery fallback spike, and Akuso eval regression.
- Current implementation anchor:
  - `/api/admin/analytics/reliability-health` now returns production health snapshots for payment initialization, Paystack verification, Stripe webhooks, entitlement reconciliation, payout blockers, media uploads, live session/token failures, discovery fallback rate, and Akuso latency/fallback health.
  - Admin Analytics now renders the reliability snapshot, severity states, incident notes, owners, next actions, and runbook links beside the existing commerce operations and system alerts surfaces.
  - live session creation and token issuance now emit success/failure analytics events so LiveKit configuration or quota failures can show up in weekly operations review.
  - `docs/production-reliability-runbooks.md` defines response paths for checkout failure, Paystack verification delay, Stripe webhook processing, entitlement mismatch, payout blockers, media upload failure, live creation failure, discovery fallback spikes, and Akuso eval regression.

### Exit criteria

- admin can see whether money, access, discovery, media, live, and Akuso are healthy
- each critical alert has a named response path
- weekly operations review starts from one shared dashboard

#### 2. Create the revenue ledger foundation

- Introduce ledger entries for:
  - purchase authorized
  - payment settled
  - platform commission reserved
  - creator earning credited
  - refund initiated
  - refund settled
  - payout requested
  - payout approved
  - payout sent
  - payout failed
  - payout reversed
- Ensure every ledger entry stores:
  - actor
  - source object
  - amount
  - currency
  - provider reference
  - previous balance
  - resulting balance
  - audit metadata
- Keep payout execution manual or review-gated until finance reports reconcile cleanly.
- Current implementation anchor:
  - `RevenueLedgerEntry` now records finance-facing ledger events for purchase authorization, settled payments, platform commission reservation, creator earning credits, refund initiation/settlement, and marketplace payout request/status events with actor, source object, amount, currency, provider reference, previous balance, resulting balance, and audit metadata.
  - purchase checkout, payment settlement, admin refunds, creator wallet reconciliation, marketplace order settlement, and pending marketplace payout creation now write idempotent revenue ledger entries without replacing the existing wallet balance ledger.
  - `/api/admin/finance/revenue-ledger` exposes event counts, amount totals, latest resulting balances by account scope, and recent ledger entries; the Earnings From Creators admin page renders the ledger beside the repository view.

### Exit criteria

- creator balances can be explained from ledger entries
- finance admins can trace a purchase into earnings, commission, and payout eligibility
- refunds and reversals do not create silent balance drift

#### 3. Turn payout readiness into payout operations

- Add creator payout request flow:
  - request amount
  - validate available balance
  - validate payout readiness
  - submit for review
  - show creator status and expected next step
- Add admin review states:
  - pending_review
  - needs_creator_action
  - approved
  - rejected
  - processing
  - paid
  - failed
- Add admin notes and creator-visible support messages.
- Add retry handling for failed payout attempts without duplicating ledger movement.
- Current implementation anchors:
  - creators can submit payout requests from `/creator/payouts` after readiness and wallet available-balance checks; open requests reserve available balance so duplicate pending withdrawals cannot overdraw the creator wallet
  - finance admins can review payout requests from the Earnings From Creators admin page, move requests through pending, needs-action, approved, processing, paid, failed, or rejected states, and attach admin notes, payout references, and creator-visible messages
  - paid requests create one idempotent `payout_debit` wallet entry and a `payout_sent` revenue-ledger debit; failed retry attempts create audit-visible `payout_failed` ledger events without moving wallet balance

### Exit criteria

- creators can request payouts when eligible
- admins can review payout requests without leaving audit gaps
- failed payouts are visible, recoverable, and not double-paid

#### 4. Improve creator catalog quality prompts

- Add catalog health scoring for:
  - missing cover art
  - weak or missing descriptions
  - missing genre/category/topic tags
  - missing price or subscription package
  - low preview-to-purchase conversion
  - high abandonment after preview
- Add creator dashboard prompts:
  - improve metadata
  - add preview
  - package into subscription
  - promote to followers
  - review pricing
- Add Akuso templates for:
  - stronger track descriptions
  - book blurbs
  - subscription benefit copy
  - launch announcement drafts

### Exit criteria

- creators see the highest-impact catalog fix first
- Akuso can help produce bounded copy without claiming unsupported features
- dashboard prompts tie back to measurable catalog issues

#### 5. Add fan return-path primitives

- Make these actions measurable and easy to resume:
  - follow creator
  - save content
  - continue listening or reading
  - subscribe to creator
  - set live reminder
- Add notification events for:
  - creator published new paid content
  - subscribed creator went live
  - saved content has an update
  - payment succeeded and content is unlocked
  - subscription renewal is upcoming or failed
- Keep notification frequency bounded to avoid spam.

### Exit criteria

- fan return actions are tracked as retention signals
- creators can earn repeat attention after first discovery
- notifications support commerce and creator relationships without overwhelming users

### Day 30 exit criteria

- production health is visible
- finance ledger model exists and reconciles core purchase events
- payout requests are reviewable
- creator dashboard gives quality actions, not only metrics
- fan return-path events are tracked
- Akuso and discovery health are part of weekly operations review

## Days 31-60

### Theme

Turn operations into growth.

### Product goals

- ship controlled payout execution or payout batch processing
- make creator growth prompts more personalized
- build fan retention loops from real behavior
- improve recommendation quality with trust and conversion feedback
- enforce Akuso quality gates before assistant changes ship

### Deliverables

#### 1. Launch payout batch workflow

- Add admin payout batches:
  - select approved payout requests
  - validate balances and payout method freshness
  - export provider-ready batch or send through provider integration
  - record batch status
  - reconcile paid, failed, and partially paid items
- Add payout batch audit trail:
  - reviewer
  - approver
  - processor
  - provider response
  - reconciliation result
- Add payout SLA tracking:
  - requested to reviewed
  - reviewed to paid
  - failed to resolved

### Exit criteria

- finance can process multiple payouts predictably
- payout failures do not disappear into support messages
- creators can see payout progress without needing manual clarification

#### 2. Add creator growth experiments

- Add small, measurable creator growth tools:
  - first paid product launch checklist
  - subscription packaging checklist
  - profile completion and trust badge readiness
  - catalog freshness prompts
  - follower announcement composer
- Track experiment outcomes:
  - prompt shown
  - prompt acted on
  - publish completed
  - purchase or subscription lift
  - prompt dismissed
- Use Akuso to assist only within grounded, reviewable templates.

### Exit criteria

- creator dashboard recommendations are personalized by creator stage
- growth prompts produce measurable actions
- dismissed prompts improve future prompt selection

#### 3. Build fan retention cohorts

- Add retention cohorts for:
  - new fan after first follow
  - new buyer after first purchase
  - new subscriber after first renewal cycle
  - live viewer after first live join
  - reader/listener after first completion
- Add cohort-level views for:
  - D1, D7, D30 return
  - repeat purchase
  - subscription conversion
  - creator follow conversion
  - notification opt-out rate
- Use these cohorts to prioritize fan return surfaces.

### Exit criteria

- team can see which fan behaviors produce durable retention
- notification and recommendation work is guided by cohort results
- repeat buyer and subscriber paths are measurable

#### 4. Improve recommendation trust and diversity controls

- Add recommendation diagnostics for:
  - repeated creator exposure
  - repeated content type exposure
  - hidden or dismissed recommendations
  - reports after recommendation
  - purchases after recommendation
  - follows after recommendation
- Add ranking controls:
  - max repeated creator count in top results
  - max repeated content type streak
  - minimum safe exploration share
  - penalty for high hide or report rates
  - boost for strong conversion with low complaint rate
- Expose admin tuning fields cautiously, with audit logs.

### Exit criteria

- recommendation quality can be tuned without code-only changes
- trust metrics are part of ranking, not an afterthought
- creator discovery does not collapse into a few repeated winners

#### 5. Gate Akuso updates with eval and review policy

- Require eval runs before assistant prompt, registry, route-hint, or memory changes.
- Track:
  - route target pass rates
  - critical safety failures
  - hallucinated feature claims
  - unsupported payment or payout guidance
  - fallback quality
- Add deployment checklist:
  - eval report attached
  - unresolved critical failures reviewed
  - new feature registry entries covered
  - admin review backlog checked

### Exit criteria

- assistant changes ship with measurable quality evidence
- route-specific regressions block release when critical
- review backlog creates eval cases rather than becoming stale notes

### Day 60 exit criteria

- payout batches are operational or export-ready
- creator growth prompts are personalized and measurable
- fan retention cohorts guide roadmap decisions
- recommendation ranking has trust and diversity controls
- Akuso quality gates are part of release discipline

## Days 61-90

### Theme

Scale the operating system.

### Product goals

- connect revenue, retention, discovery, and trust into one executive view
- automate safe parts of payout, monitoring, and creator guidance
- mature creator and fan lifecycle loops
- prepare the product for broader launch, partnerships, or investor review

### Deliverables

#### 1. Launch an executive operating dashboard

- Combine:
  - GMV
  - net creator earnings
  - platform commission
  - checkout success
  - payout status
  - creator activation
  - creator retention
  - fan retention
  - recommendation conversion
  - recommendation complaint rate
  - Akuso quality
  - support backlog
  - incident history
- Add weekly comparison:
  - this week
  - prior week
  - 4-week trend
  - target
  - status
- Add drilldowns to the relevant admin or creator operations pages.

### Exit criteria

- leadership can understand product health without stitching reports manually
- weekly review ends with clear product, operations, and assistant actions
- metric movement is tied to shipped work

#### 2. Add controlled payout automation

- Automate only low-risk payout steps:
  - eligibility checks
  - balance validation
  - duplicate request detection
  - payout batch preflight
  - failed payout retry eligibility
- Keep human approval for:
  - first payout
  - high-value payout
  - suspicious account changes
  - risk-flagged creators
  - provider mismatch or manual override
- Add risk flags:
  - unusual earning spike
  - high refund rate
  - high report rate
  - recently changed payout method
  - identity or verification mismatch

### Exit criteria

- payout operations are faster without becoming opaque
- high-risk money movement remains human-reviewed
- payout automation can be disabled or rolled back safely

#### 3. Mature creator lifecycle programs

- Add lifecycle tracks:
  - new creator activation
  - first sale recovery
  - subscription launch
  - dormant creator reactivation
  - high-potential creator growth
- Each lifecycle track should define:
  - entry trigger
  - creator-facing prompt
  - Akuso support template
  - success metric
  - exit condition
- Add admin view for creators by lifecycle stage.

### Exit criteria

- creators receive help based on where they are stuck
- support and growth teams can prioritize creator outreach
- creator lifecycle movement is visible over time

#### 4. Mature fan lifecycle and subscription retention

- Add fan lifecycle tracks:
  - new user first meaningful action
  - first creator follow
  - first paid unlock
  - first subscription
  - renewal risk
  - dormant fan reactivation
- Add retention actions:
  - continue content rail
  - followed creator updates
  - saved content reminders
  - renewal recovery
  - similar creator suggestions
- Add subscription retention diagnostics:
  - failed renewal reasons
  - grace-period recovery
  - cancellation reasons
  - renewal after creator activity

### Exit criteria

- fan retention is managed as a lifecycle, not only a feed problem
- subscriptions have measurable renewal and recovery paths
- recommendations and notifications support relationship depth

#### 5. Prepare launch and governance review

- Create readiness checklist for:
  - commerce reliability
  - payout operations
  - support coverage
  - moderation queue readiness
  - recommendation trust
  - Akuso quality
  - analytics accuracy
  - backup and incident response
  - mobile performance
  - legal and privacy review
- Create launch report:
  - what is live
  - what is manual
  - what is automated
  - known risks
  - blocked items
  - next investment areas

### Exit criteria

- the team can decide whether to expand usage with evidence
- launch risk is explicit and owned
- roadmap decisions are based on operating data, not instinct

### Day 90 exit criteria

- executive dashboard is live
- payout operations are controlled, auditable, and partly automated
- creator lifecycle programs are measurable
- fan lifecycle and subscription retention are measurable
- launch/governance readiness is documented
- Akuso, discovery, commerce, and payout changes are reviewed through shared quality gates

## Akuso next-cycle roadmap

Akuso should keep running in parallel with product execution.

### Phase 1: Operations grounding

- add runbook-aware answers for checkout, entitlement, payout readiness, and creator onboarding support
- keep sensitive actions behind secure app flows
- convert recurring admin support issues into eval cases
- improve fallback copy for unsupported or risky requests

### Phase 2: Creator growth assistant

- provide bounded templates for:
  - product descriptions
  - subscription benefits
  - launch posts
  - fan updates
  - pricing review prompts
- connect templates to creator stage and catalog health
- require clear "review before publish" UX

### Phase 3: Quality governance

- run evals before assistant changes
- block critical route regressions
- track hallucinated feature claims as a release risk
- turn unresolved review backlog into labeled eval candidates every week

### Phase 4: Measured personalization

- personalize Akuso only with low-risk, role-aware, redacted context
- use creator stage and recent dashboard state before free-form memory
- never infer sensitive finance, identity, or safety conclusions from chat alone
- keep fine-tuning behind the existing readiness gate

## Weekly operating cadence

### Monday

- review executive metrics
- review incidents and open alerts
- lock weekly product, operations, and assistant priorities

### Wednesday

- review payout queue, commerce failures, and support backlog
- review creator activation and fan retention cohorts
- promote new Akuso eval candidates

### Friday

- demo shipped work
- compare weekly metric movement
- close or reassign stale incidents
- update roadmap status and next-week risks

## Decision rules

- If checkout, entitlement, or payout reliability is degraded, growth work pauses.
- If payouts cannot be reconciled, automation pauses.
- If recommendation complaint or report rate rises, ranking expansion pauses.
- If Akuso route-quality gates regress, assistant changes pause.
- If creator prompts do not produce action, simplify the prompt before adding more prompts.
- If notifications increase opt-outs, reduce frequency and improve targeting before adding new notification types.
- If the team is overloaded, protect this order:
  - commerce reliability
  - payout operations
  - creator activation
  - fan retention
  - discovery optimization
  - Akuso expansion

## Repo-linked backlog

### Production reliability

- add commerce, entitlement, media, discovery, live, and Akuso health snapshots
- add admin incident notes and runbook links
- add alert severity states and weekly incident review

### Revenue and payouts

- add ledger entries for purchases, commissions, refunds, and payouts
- add payout request review states
- add payout batch export or provider execution
- add payout reconciliation and retry handling

### Creator growth

- add catalog health scoring
- add personalized creator dashboard prompts
- add launch, subscription, and metadata templates
- add creator lifecycle admin views

### Fan retention

- add save, continue, follow, subscription, and live reminder tracking
- add retention cohorts
- add notification controls and opt-out monitoring
- add subscription renewal and cancellation diagnostics

### Discovery and trust

- add recommendation diversity controls
- add complaint, hide, and report penalties
- add admin-visible recommendation diagnostics
- add audited ranking configuration fields

### Akuso governance

- require eval reports for assistant changes
- expand route and operations eval suites
- promote review backlog items into eval candidates weekly
- keep personalization bounded, redacted, and role-aware

## What not to do yet

- do not fully automate payouts before ledger reconciliation is boring
- do not expand recommendations if trust complaints are rising
- do not send high-frequency notifications before opt-out and complaint metrics are stable
- do not let Akuso execute sensitive finance, account, or moderation actions
- do not introduce complex ML ranking before deterministic diagnostics are trusted
- do not hide manual operations behind dashboards that cannot explain state changes

## Suggested ownership split

- Product and growth: creator lifecycle, fan retention, prompts, subscriptions, launch readiness
- Finance and operations: ledger, payout review, payout batches, refunds, reconciliation
- Backend and infrastructure: monitoring, alerting, webhook reliability, media/live health, audit logs
- Discovery and analytics: ranking controls, retention cohorts, executive dashboard, recommendation diagnostics
- AI and safety: Akuso eval gates, review queues, feature grounding, memory governance, policy quality
- Design and frontend: admin operations UX, creator prompts, fan return paths, lifecycle dashboards

## Review cadence for this document

Update this roadmap every week with:

- shipped items
- blocked items
- incident learnings
- metric movement
- payout and finance status
- creator lifecycle movement
- fan retention movement
- recommendation trust movement
- Akuso eval and review status

If a phase completes early, move forward. If reliability or money movement is unstable, slow down and stabilize the operating system before expanding growth.
