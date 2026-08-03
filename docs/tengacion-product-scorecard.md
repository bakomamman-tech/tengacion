# Tengacion baseline product scorecard

Status: capture tooling implemented under `METRIC-002`; production baseline not yet captured.

## Purpose

The baseline product scorecard turns the governed `route_viewed` event into an operating view of product-surface adoption. It answers which registry features are being reached, how views divide across lifecycle, surface and access classes, and whether the production telemetry window is long enough to record the first baseline.

The scorecard does not claim task completion, retention, conversion or KPI success. Those outcomes require their own domain events. Route views are the common product-reach baseline.

## Access and export

- Admin endpoint: `GET /api/admin/analytics/product-scorecard`
- Supported filters: the standard analytics `range`, `startDate` and `endDate` filters
- Default window: `30d`
- Admin UI: `/admin/analytics`, in **Baseline Product Scorecard**
- Export: **Export Scorecard** downloads the current aggregate as JSON

The endpoint is protected by the existing admin authentication and role boundary.

## Capture gate

A baseline is eligible for capture only when all of the following are true:

1. the selected range covers at least 30 calendar days;
2. accepted production `route_viewed` events exist in that range;
3. the first and last accepted events span at least 30 calendar days; and
4. the scorecard reports `capture.ready: true`.

The API reports one of four capture states:

| State | Meaning |
|---|---|
| `no_data` | No accepted route telemetry exists in the selected range. |
| `insufficient_selected_window` | The operator selected fewer than 30 calendar days. |
| `insufficient_telemetry_window` | Events exist, but the observed production window is not yet 30 calendar days. |
| `ready` | The selected and observed windows satisfy the baseline gate. |

`METRIC-002` remains `IN PROGRESS` until a production export in the `ready` state is reviewed and recorded in the implementation tracker.

## Scorecard fields

The scorecard includes:

- total, authenticated and anonymous governed route views;
- authenticated-account reach without returning account identifiers;
- registry-wide and production-feature view coverage;
- lifecycle, surface, access and contract-version distributions;
- daily authenticated and anonymous view totals;
- per-feature view totals, share, account reach and parameterized route-pattern totals; and
- production features with zero observed views, including their accountable role and registry KPI.

`unclassifiedViews` must be zero. A non-zero value means stored telemetry no longer maps to the current registry and must be investigated before the baseline is accepted.

## Privacy boundary

The scorecard aggregates only server-derived route-truth dimensions. It never returns account IDs, raw URLs, resolved usernames or resource IDs, query strings, hash state, browser titles or referrers. Anonymous visitors are not assigned an analytics identifier, so unique reach covers authenticated accounts only.

## Production capture procedure

1. Open Admin Analytics with the `30d` range after the production telemetry window has matured.
2. Confirm the scorecard reports `Ready` and `unclassifiedViews` is zero.
3. Review zero-view production features with the registry owner roles; a zero may represent low adoption, a navigation problem or missing instrumentation.
4. Select **Export Scorecard** and retain the JSON as the dated baseline evidence.
5. Record the exact start/end window, review participants, material findings and artifact location in `docs/tengacion-world-class-roadmap-tracker.md`.
6. Mark `METRIC-002` complete only after that production evidence review.

## Verification

- `backend/tests/productScorecard.test.js` covers aggregation, privacy, the 30-day readiness gate, empty/short windows and admin access.
- `frontend/src/pages/__tests__/AdminAnalyticsProductScorecard.test.jsx` covers visible readiness, adoption totals and scorecard loading in Admin Analytics.

