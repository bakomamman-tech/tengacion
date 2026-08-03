# Tengacion High-Risk Journey Test Matrix

Last updated: 3 August 2026

This document is the evidence matrix for Phase 0 package `TEST-002`. A journey counts as covered only when automated tests exercise its server authority, access boundary, and user-visible success or failure semantics where applicable.

| Surface | High-risk journey | Enforced outcome | Automated evidence |
|---|---|---|---|
| Groups | Create, list, post, share, and discover groups | Group API and model are authoritative; private discovery and member-only writes are enforced; browser caches are cleanup-only. | `backend/tests/groups.test.js` and the Groups workspace, store, share, and Messenger tests recorded in route truth. |
| Notifications | List, read one, read all, update preferences, and receive UI state changes | Only the recipient can read or mutate an alert. Expired alerts are excluded. Failed optimistic reads roll back instead of claiming success. Preference keys are allowlisted. | `backend/tests/notificationsRoutes.test.js`, `frontend/src/context/NotificationsContext.test.jsx`, `frontend/src/__tests__/notificationUtils.test.js` |
| Rooms | Create, discover, join, leave, read private content, and send messages | Rooms are persisted by the API. Unrelated private rooms are not listed; private feeds/messages require membership; message writes require membership; owners cannot orphan a room by leaving. UI membership changes reload server truth and expose failures. | `backend/tests/roomsRoutes.test.js`, `frontend/src/pages/Rooms.test.jsx` |
| Birthdays | Load community birthdays and send a wish | Private birthdays are excluded. Friend-visible birthdays are limited to friends or the account owner. Public birthdays remain discoverable. Wishes clear only after the Messages API confirms persistence and failed drafts remain visible. | `backend/tests/birthdayRoutes.test.js`, `frontend/src/features/birthdays/BirthdayWorkspacePage.test.jsx`, `frontend/src/__tests__/notificationUtils.test.js` |
| Marketplace | Browse/filter listings, enforce seller publication controls, start checkout, verify payment, and create settlement records | Marketplace APIs remain authoritative for products, seller eligibility, orders, price/fee integrity, payouts, and filtered discovery. Checkout failure produces a durable recovery state rather than a success claim. | `backend/tests/marketplaceRoutes.test.js`, `frontend/src/pages/__tests__/MarketplaceJourneys.test.jsx` |
| Settings | Persist privacy, notification, security/session, and audio controls | Authenticated user APIs are authoritative. Privacy and notification values are allowlisted; audio volume is normalized; unrelated accounts and fields are not mutated. UI success waits for server confirmation and errors remain visible. | `backend/tests/userSettingsRoutes.test.js`, `backend/tests/notificationsRoutes.test.js`, `backend/tests/mfaRiskSecurity.test.js`, `backend/tests/sessionAuth.test.js`, `frontend/src/pages/__tests__/SettingsJourneys.test.jsx` |

## Package completion rule

`TEST-002` is complete when every row above is represented in the route truth registry, all focused suites pass, frontend lint and production build pass, and the complete frontend regression suite remains green.

