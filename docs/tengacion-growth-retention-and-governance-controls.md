# Tengacion Growth, Retention, and Governance Controls

Last updated: 15 August 2026

This document defines the operating contract for the five roadmap capabilities shipped after the payout batch workflow: creator growth experiments, fan retention cohorts, recommendation governance, the Akuso release gate, and the executive operating dashboard.

## Creator growth experiments

The Creator Dashboard receives server-selected experiments in `operatingConsole.growthExperiments`. Selection is based on creator activation, catalog, sales, and subscription state. Supported prompt keys are:

- `first_paid_product_launch`
- `subscription_packaging`
- `profile_trust_readiness`
- `catalog_freshness`
- `follower_announcement`

Creators record `shown`, `acted_on`, or `dismissed` through `POST /api/creator/growth-experiments/events`. The server validates both fields, verifies the creator profile, and deduplicates shown events once per prompt per day. Dismissals remain suppressed until a later action supersedes them. Lift counts only publishing, purchase, or subscription outcomes occurring after an acted-on event.

The follower-announcement action copies a bounded Akuso template for creator review. It does not publish content or mutate an account through the assistant.

## Fan retention cohorts

`GET /api/admin/analytics/fan-retention` supports the standard analytics date filters and reports cohorts beginning at a fan's first qualifying event in the selected window:

- first creator follow
- first paid purchase
- second paid subscription purchase, treated as the first observed renewal
- first live join
- first completed track stream or book download

D1, D7, and D30 each mean activity during the 24-hour window beginning exactly 1, 7, or 30 days after cohort entry. A member is excluded from a rate until the complete window is observable. Summary rates use eligible members, not all entrants.

Repeat purchase, subscription conversion, and later creator-follow conversion are measured after entry. Notification opt-out is a current-state diagnostic and should not be interpreted as historical preference state at cohort entry.

The admin response includes `dataQuality`. If the bounded event or purchase scan reaches 100,000 rows, the report is marked incomplete and the UI warns operators rather than treating the result as decision-grade evidence.

## Recommendation trust and diversity

The global policy is stored in `RecommendationPolicy` and read on each discovery request. Defaults are:

- maximum two results from one creator
- maximum two consecutive results of one content type
- minimum 15% exploration share when enough eligible exploration candidates exist
- hide-rate penalty weight 18
- report-rate penalty weight 40
- conversion-rate boost weight 16

Creator outcome rates affect rank only after 10 impressions in the 30-day signal window. Recommendation reports are recorded only after the content report succeeds. When a recommendation request ID is present, creator attribution comes from the server-owned recommendation log.

Admins inspect diagnostics with `GET /api/admin/analytics/recommendations` and update bounded fields with `PATCH /api/admin/analytics/recommendations/policy`. Updates require a reason and create an `admin.recommendation_policy.update` audit event.

Recommendation diagnostics are bounded to 50,000 request logs and expose `dataQuality`. A truncated response is visibly labeled incomplete and is not treated as decision-grade by the executive dashboard.

## Akuso release gate

Run the static deployment gate with:

```text
npm run gate:akuso-release --prefix backend
```

The command writes `artifacts/akuso-release-gate.json`. It blocks on critical eval failures, failed route thresholds, ungrounded feature coverage, unsupported commerce guidance, or fallback regressions. Because the command does not connect to production data, its decision remains pending the authenticated review-backlog check.

`GET /api/admin/assistant/release-gate` repeats the static checks and adds unresolved review counts. An unresolved high-severity safety or abuse item blocks release. Other unresolved reviews produce a `review` decision and must be handled through the normal Admin Assistant queue.

Attach the generated JSON report to the pull request or deployment evidence for any prompt, feature-registry, route-hint, memory, or assistant-policy change.

## Executive operating dashboard

`GET /api/admin/analytics/executive-operating-dashboard` combines weekly commercial, creator, retention, recommendation, assistant, support, and reliability signals. Each metric includes:

- current week
- prior week
- four-week average
- target and direction
- `on_target`, `watch`, `off_target`, or `no_data` status
- an accountable drilldown path

The dashboard is an operating summary, not a replacement for source reports. Weekly review should open the supplied drilldown before deciding an intervention, especially when sample-dependent metrics show `no_data`.
