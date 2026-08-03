# Tengacion Route and Access Contracts

Last updated: 3 August 2026

This document records the route decisions enforced by ROUTE-001. The route truth registry remains the machine-readable authority; this document explains the public contract for maintainers.

## Public creator profiles

The canonical public creator family is username-based:

| Surface | Canonical route | Read access |
|---|---|---|
| Profile home | `/creator/:username` | Public |
| Music | `/creator/:username/music` | Public |
| Albums | `/creator/:username/albums` | Public |
| Podcasts | `/creator/:username/podcasts` | Public |
| Books | `/creator/:username/books` | Public |
| Posts | `/creator/:username/posts` | Public |
| Store | `/creator/:username/store` | Public |

The Public Creator Profile API resolves either a username or creator ID and returns the authoritative `canonicalPath` and `tabPaths`. Route builders must use those returned paths when available.

## Compatibility routes

| Compatibility route | Resolution |
|---|---|
| `/creators/:creatorId` and supported tab paths | Resolve the creator ID and replace or redirect to the matching username route. |
| `/creators/:creatorId/songs` | Resolve to canonical `/creator/:username/music`. |
| `/creators/:creatorId/comedy` | Resolve to canonical creator home; comedy is not a separate canonical tab. |
| `/artist/:username` | Public alias for `/creator/:username`; it does not require login. |
| `/pyrexx_singz`, `/artist/pyrexx-singz`, `/artist/pyrexx_singz` | Resolve to the dedicated `/pyrexx-singz` page. |

For an active creator, direct compatibility requests receive an HTTP 308 redirect and preserve the query string. In-app ID compatibility navigation resolves the creator through the public API, replaces browser history with the canonical username path, and preserves query and hash state. Unknown creator references retain the existing not-found response.

## Authenticated actions and private creator workspace

Public profile reads do not make state-changing actions public. Follow, message, purchase, and subscribe flows continue to require authentication. The subscription route remains `/creators/:creatorId/subscribe` and is protected.

The `/creator` workspace namespace remains private when its first segment is one of the following reserved values:

- `register`
- `dashboard`
- `categories`
- `fan-page-view`
- `music`
- `books`
- `podcasts`
- `earnings`
- `payouts`
- `settings`
- `verification`
- `support`

These reserved segments cannot be interpreted as public creator usernames. Creator workspace routes remain behind authentication and creator authorization/category gates.

## Enforcement and evidence

- Frontend route builders: `frontend/src/lib/publicRoutes.js`
- Backend route builders: `backend/services/publicRouteService.js`
- Machine-readable registry: `frontend/src/config/routeTruthRegistry.json`
- SPA routing and access gates: `frontend/src/App.jsx`
- Server canonical redirects: `backend/server.js` and `backend/services/seo/pageSeoService.js`
- Contract tests: `frontend/src/lib/__tests__/publicRoutes.test.js`, `frontend/src/__tests__/App.creatorRoutes.test.jsx`, `frontend/src/pages/creator/__tests__/CreatorFanPageCanonicalRoute.test.jsx`, `backend/tests/seoRoutes.test.js`, and the frontend/backend route-truth registry tests

