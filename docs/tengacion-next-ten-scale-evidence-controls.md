# Tengacion Next-Ten Scale Evidence Controls

Last updated: 27 August 2026

## Scope

This contract records the ten sequential roadmap packages after the first creator cohort-program launch:

1. four-week campaign and drop calendar
2. fan lifecycle retention interventions
3. privacy-safe partner reporting
4. Akuso launch copilot
5. production SLOs and error budgets
6. performance, cost, and low-bandwidth controls
7. partner and sponsor pilots
8. governance and compliance readiness
9. the 90-day launch and scale report
10. the expansion scorecard

The admin read model is `GET /api/admin/analytics/scale-evidence-operating-system`. It composes the existing launch-growth and reliability authorities rather than copying their state into the browser.

## Campaign calendar and measurement

`GrowthCalendarEntry` is the durable authority for featured drops, live events, subscription pushes, marketplace spotlights, fan reminders, and editorial collections. A calendar item cannot become ready or live without a named owner, valid window, audience, objective, call to action, reporting key, and creator or content scope.

The report covers the next four weeks and makes missing calendar types visible. Each entry reports campaign-key events and scoped purchase evidence for impressions, clicks, previews, purchases, subscriptions, refunds, creator earnings, support contacts, hides, and reports. Purchase comparison uses the same eligible creators in the immediately preceding equal-length window and labels this as `eligible_creator_window` attribution. Creator earnings use only a stored creator-share rate; the service does not infer a missing rate.

Admin mutations:

- `POST /api/admin/growth/calendar`
- `PATCH /api/admin/growth/calendar/:entryId`

Status transitions require reasons and are written to both the entry history and the admin audit log.

## Fan retention and consent

The lifecycle intervention service detects:

- no first follow
- follow without return
- preview without purchase
- purchase without repeat purchase
- renewal risk
- live reminder without join
- saved content not resumed

Eligibility is tuned with lifecycle state, creator relationship, freshness, engagement, consent, complaint history, and a maximum of two lifecycle sends per day. Suppressed rows carry a visible reason such as `system_notifications_disabled`, `notification_complaint_open`, or `frequency_cap_reached`. A suppression never counts as a send or successful return.

## Partner reporting privacy boundary

The partner report supports labels, publishers, communities, venues, and brands through aggregate creator-cohort, campaign, live, subscription, retention-source, commerce, payout-timeliness, support, and moderation measures.

It excludes user identity and contact details, provider/payment references, payment credentials, private content, safety case details, and Akuso memory. The contract declares aggregate-only reporting and a minimum cohort size of ten for partner-facing publication. Admin diagnostic rows elsewhere in the operating system are not part of the partner payload.

## Akuso launch copilot

Akuso's existing authenticated template path now accepts six bounded launch content types:

- creator launch checklist
- campaign copy
- fan support navigation
- payout explanation
- renewal help
- incident summary

The content type flows through the same policy, prompt-injection, authentication, rate-limit, memory, observability, and review controls as other Akuso template requests. Deterministic fallbacks exist when a model is unavailable. Campaign, finance, checklist, and incident content remains reviewable draft copy; Akuso cannot publish it, approve a payout, move money, expose private campaign users, or promise an unverified incident resolution.

The eval suite adds campaign, creator-cohort, support-escalation, unsafe-finance-refusal, and privacy-boundary fixtures.

## SLO and expansion gate

`ProductionSloPolicy` stores reviewed target overrides, windows, error-budget minutes, owners, runbooks, user impact, rollback plans, tickets, reasons, and change history for:

- checkout initialization
- payment verification
- entitlement delivery
- payout review and completion
- media upload
- live create and join
- discovery availability
- notification delivery
- Akuso availability and eval quality

The read model combines these policies with the existing reliability snapshots. Error-budget exhaustion, a blocked surface, or a missing critical delivery instrument pauses expansion. In particular, notification `sent` events do not prove provider delivery; notification availability stays at `watch` and blocks expansion until delivered/failed callbacks are instrumented.

Admin target changes use `PATCH /api/admin/reliability/slo-policies/:key` and require a reason. Critical expansion gates cannot be bypassed by changing an `ExpansionBet` in the browser.

## Performance and low bandwidth

The operating view reports bounded route latency, payload size, Akuso latency/cost instrumentation, and notification-send evidence. Missing measurements are explicit gaps.

The frontend mounts one network-aware controller. In automatic mode, the browser's Save-Data signal or a `slow-2g`/`2g` effective connection switches media elements to `preload="none"`. A local `low`, `full`, or `auto` preference can override detection. Core creator, preview, saved/continue, admin, and Akuso surfaces retain compact or deterministic paths; heavier model-backed Akuso work remains policy- and task-gated.

## Partner pilots

`PartnerPilot` supports label/artist, publisher/author, live-partner, campus/community, and brand-collection pilots. Every pilot records its owner, creator and fan scope, geography, offer, report package, rights/moderation plan, finance plan, exit criteria, and review date.

Sponsored pilots cannot be saved without a visible disclosure label and cannot become ready or active without all readiness evidence. Status changes require a reason and are audited.

Admin mutations:

- `POST /api/admin/partnerships/pilots`
- `PATCH /api/admin/partnerships/pilots/:pilotId`

## Governance and 90-day decision

The operational governance checklist covers payment/payout, refund/dispute, rights/takedown, verification/impersonation, privacy/retention, notification consent, recommendation complaints, and Akuso safety/evals/memory. Legal sufficiency and jurisdiction-specific advice remain with qualified counsel. Manual overrides require actor, reason, prior state, next review, and audit evidence.

The 90-day report assembles launch, cohort, earnings, commerce, subscriptions, retention, campaigns, partners, reliability, incidents, support, moderation, Akuso, risks, and investment evidence. Its decision must be one of expansion, another creator cohort, reliability/support investment, creator-supply investment, fan-retention investment, or partner-pilot investment.

## Expansion scorecard

`ExpansionBet` records ten scores from zero to five: creator supply, fan demand, local payment fit, category strength, support capacity, moderation/rights readiness, partner access, acquisition efficiency, retention evidence, and payout feasibility.

Every bet also requires a named owner, cohort definition, advancement gate, cost cap, success metric, stop condition, and review date. States are `research`, `seed`, `controlled_launch`, `expand`, `hold`, and `exit`. An exhausted or uninstrumented critical SLO prevents transition into controlled launch or expansion.

Admin mutations:

- `POST /api/admin/growth/expansion-bets`
- `PATCH /api/admin/growth/expansion-bets/:betId`

## Verification contract

Release verification covers pure service behavior, authenticated persistence and audit routes, Akuso evals, low-bandwidth resolution, Admin Analytics rendering, backend syntax, frontend lint, action and encoding audits, diff checks, and a production frontend build.
