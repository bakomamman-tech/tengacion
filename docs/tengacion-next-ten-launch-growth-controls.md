# Tengacion Next-Ten Launch and Growth Controls

Last updated: 27 August 2026

## Scope

This contract records the ten roadmap packages implemented after the executive operating dashboard:

1. controlled payout automation
2. mature creator lifecycle programs
3. mature fan lifecycle and subscription retention
4. launch and governance review
5. launch readiness command center integration
6. first creator launch cohort preparation
7. first-week fan activation instrumentation
8. reversible revenue campaigns
9. public support and trust operations
10. repeatable creator cohort programs

The packages share one server-owned operating report instead of maintaining separate browser-only state. Admin Analytics reads that report from `GET /api/admin/analytics/launch-growth-operating-system`.

## Money movement boundary

Payout automation is limited to eligibility checks, available-balance snapshot validation, duplicate detection, batch preflight, and failed-request retry eligibility. It does not create a transfer, mark a payout paid, bypass the existing payout batch workflow, or authorize money movement.

The preflight keeps a human decision for:

- a creator's first payout
- payouts at or above the configured high-value threshold
- unusual earning spikes
- high refund or report rates
- recently changed or stale payout details
- missing identity or recipient verification
- provider mismatches and manual overrides

Operators can run a fresh, audited preflight through `POST /api/admin/finance/payout-automation/preflight`. `PAYOUT_AUTOMATION_ENABLED=false` disables automatic candidate classification while preserving the existing manual review and payout-batch paths.

## Creator lifecycle authority

`CreatorLifecycleEnrollment` is the durable authority for creator program membership. It records the creator, program, lifecycle stage, accountable owner, checklist, metric snapshot, current status, entry reason, and status history.

The supported programs are:

- new creator activation
- first paid drop
- subscription launch
- live event launch
- dormant creator reactivation
- high-potential creator growth

The operating report recommends a program from real profile, catalog, purchase, payout-readiness, activity, and report evidence. Recommendation alone does not enroll a creator. An admin must confirm enrollment through `POST /api/admin/growth/creator-programs/enroll`. The route writes an admin audit record.

A creator cannot appear launch-ready until the catalog, category, profile, payout, and trust checks pass and a durable enrollment confirms the manual external-promotion decision.

## Fan lifecycle and activation

Fan stages are derived from server events and purchases:

- first meaningful action
- first creator follow
- first paid unlock
- first subscription
- renewal risk
- dormant fan reactivation
- active creator relationship

The first-week funnel uses account creation as its signed-up authority and records browse, follow, save, preview, paid, subscribed, and returned states. Attribution uses allowlisted analytics metadata such as direct invite, creator share, organic discovery, notification, referral, or campaign source. The report keeps launch-cohort traffic separate by source and identifies the first incomplete state without claiming that an untracked action occurred.

Subscription diagnostics expose failed renewals, scheduled cancellations, recovery after a failed renewal, recorded cancellation reasons, and renewals following creator activity. Recovery counts require a later paid subscription record; a notification send alone never counts as recovery.

## Reversible campaign authority

`RevenueCampaign` is the durable authority for controlled revenue campaign definitions and status. A campaign cannot move to `ready` or `active` unless it has:

- a named owner
- a valid start and end window
- eligible creator or content scope
- an explicit price or discount rule
- expected margin impact
- refund and dispute handling
- a success metric
- a ledger tracking key
- a rollback plan

Allowed lifecycle transitions prevent completed or cancelled campaigns from being silently reactivated. Every status transition requires a reason and is appended to campaign history. Admin route mutations also write audit records.

The supported campaign types are creator drops, subscription launches, bundle offers, live event passes, marketplace creator spotlights, and partner-sponsored features.

## Launch, support, and governance

The existing Assurance launch command center remains the authority for checkout, entitlement, payout, upload, playback, live, discovery, notification, Akuso, support, and moderation launch gates. The next-ten report reuses its gates, rollback plans, and grounded support macros.

Support and moderation SLA checks cover assistant-output reports, content reports, marketplace disputes, recommendation reports, and creator-profile reports. Open queue age determines `ready`, `watch`, or `blocked`; a quiet queue is not treated as evidence that a report was resolved.

The launch report separates:

- what is live
- what remains manual
- what is safely automated
- known risks
- blocked items
- next investment areas

Expansion is held when a launch gate is blocked, rollback is required, or a support queue has breached its SLA.

## Privacy and completeness

The admin report is protected by the existing admin authentication and role middleware. It does not expose payout account numbers or purchase-provider secrets. Creator and fan diagnostic rows are bounded, and the response carries its row limits and completeness note so exports cannot be represented as an unbounded population report.

## Verification

Focused verification covers:

- low-risk and high-risk payout decisions, including the no-money-movement invariant
- manual creator promotion confirmation and lifecycle classification
- first-week source attribution and subscription renewal risk
- campaign readiness blockers
- support SLA breaches and escalation ownership
- the complete ten-package operating response
- the Admin Analytics presentation and navigation to authoritative operations surfaces

The required release checks are the focused backend and frontend tests, backend syntax validation, frontend lint, inert-control and encoding audits, `git diff --check`, and a production frontend build.
