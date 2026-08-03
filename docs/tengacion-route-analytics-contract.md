# Tengacion route analytics event contract

Status: implemented and verified under `METRIC-001` on 3 August 2026.

## Purpose

Tengacion records route views against the authoritative route truth registry. The event answers which governed feature surface was viewed and what lifecycle/access contract applied at that time. It is not a clickstream record and must not contain raw URLs, resource identifiers, search terms or page content.

The shared definition lives in `frontend/src/config/routeTruthRegistry.json` under `routeAnalyticsContract`.

## Event

- Event type: `route_viewed`
- Contract version: `1`
- Ingestion endpoint: `POST /api/analytics/route-views`
- Success response: HTTP `202` with `accepted: true`
- Storage authority: `AnalyticsEvent`, using the configured analytics retention policy
- Authentication: optional; a valid access token associates the event with the authenticated account, while public routes can be recorded anonymously

## Browser payload

The browser may send exactly these fields:

| Field | Type | Meaning |
|---|---|---|
| `contractVersion` | number | Must equal the currently supported contract version. |
| `featureId` | string | Stable feature ID from route truth. |
| `routePattern` | string | Registry pattern such as `/creator/:username/books`, never the resolved browser path. |

Example:

```json
{
  "contractVersion": 1,
  "featureId": "public_creator_profiles",
  "routePattern": "/creator/:username/books"
}
```

The endpoint rejects missing fields, extra fields, unsupported versions, query/hash characters, and feature-pattern pairs that do not exist in route truth.

## Server-derived record

The server resolves the accepted pair back to route truth and records:

| Field | Authority |
|---|---|
| `eventType` | Contract definition |
| `contractVersion` | Contract definition |
| `featureId` | Matched registry feature |
| `routePattern` | Matched registry pattern |
| `canonicalPath` | Registry feature |
| `lifecycle` | Registry feature status |
| `surface` | Registry feature surface |
| `access` | Registry feature access class |

`userId` is derived only from validated optional authentication. `actorRole` is recorded as `authenticated` or `anonymous`; the browser cannot claim an account or role. `targetId`, `targetType` and `contentType` provide stable aggregation dimensions for the feature and surface.

## Privacy boundary

The contract forbids `url`, `location`, `pathname`, `query`, `search`, `hash`, `referrer` and `title`. The browser strips query and fragment state before route matching and sends a parameterized pattern rather than usernames, creator IDs, post IDs, purchase IDs or other resource identifiers. Unknown/unclassified routes are not emitted.

Google Analytics, when configured, receives the same parameterized route pattern and the registry feature title. It does not receive the raw SPA URL, query/hash state, dynamic identifier, document title or referrer through this tracker.

## Counting semantics

- One event is attempted for each committed React Router location key.
- The SEO-ready event or the 250 ms fallback can trigger the attempt, but the first trigger wins.
- Repeated delivery for the same router location key is suppressed in the browser.
- A later navigation may record the same route pattern again; this is a new view but still contains no resolved resource identifier.
- Delivery is best effort and never blocks navigation. A failed ingestion response is not represented as accepted.

## Evidence

- `frontend/src/config/__tests__/routeTruthRegistry.test.js` enforces the shared contract and nested route classification.
- `frontend/src/lib/analytics.test.js` proves raw dynamic paths, queries and fragments are absent from the browser payload and verifies duplicate/unclassified suppression.
- `backend/tests/analyticsRoutes.test.js` proves anonymous/authenticated ingestion, server-derived metadata, strict field/version/pair validation and private URL-data rejection.
