# Tengacion World-Class Roadmap Implementation Tracker

Last updated: 3 August 2026

This document is the authoritative implementation record for the Facebook benchmark roadmap. A work package is marked complete only after its definition of done is implemented and verified. Planning documents and code presence alone do not count as completion.

## Status legend

- `NOT STARTED`: No implementation work has begun.
- `IN PROGRESS`: Implementation has begun but the definition of done is not fully verified.
- `BLOCKED`: Work cannot continue without a recorded decision or external dependency.
- `COMPLETE`: Implementation and required verification are finished.

## Phase 0: product truth and control

| ID | Work package | Status | Verification record |
|---|---|---|---|
| TRUTH-001 | Create the route truth registry | COMPLETE | One shared registry classifies all 181 App paths exactly once and records lifecycle, access, authority, owner role, KPI, flag and test evidence. |
| TRUTH-002 | Contain deceptive Preview routes | COMPLETE | Dashboard, Memories, Saved, Events and Ads Manager show honest Preview states; Feedback's former fabricated browser-only success was removed before FEEDBACK-001 introduced server submission. |
| TRUTH-003 | Make navigation status-aware | COMPLETE | Navbar, Create menu and Quick Access derive visibility and Beta/Experimental labels from the shared registry; Preview routes are not promoted. |
| TRUTH-004 | Make Akuso capability-aware | COMPLETE | Akuso derives availability from the registry, excludes Preview recommendations/actions and explains Preview requests without a navigation path. |
| GROUP-001 | Remove local authority from Groups | COMPLETE | Groups workspace, group post sharing and Messenger group discovery now read/write only through the Group API; legacy group caches are deleted, failure states are explicit, and backend/frontend authority tests pass. |
| ACTION-001 | Audit and remove inert controls | COMPLETE | Executable source audit now enforces that every native button/link acts, submits, navigates or is honestly disabled; 45 inert/placeholder violations were resolved and the audit reports zero remaining. |
| FEEDBACK-001 | Correct feedback persistence and submission semantics | COMPLETE | Authenticated feedback is persisted through the Support Complaint API, tagged `product_feedback`, queued in Admin Messages, analytics-recorded, and shown as successful only after a server reference is returned. |
| ROUTE-001 | Canonicalize route and access contracts | COMPLETE | `/creator/:username` is the canonical public creator family; creator-ID, artist and branded aliases resolve consistently, state-changing actions and workspace routes retain authentication gates, and the enforced contract is documented and tested. |
| TEST-001 | Add route truth smoke coverage | COMPLETE | Registry completeness, Preview rendering, navigation containment and Akuso lifecycle enforcement are covered by automated tests. |
| TEST-002 | Fill high-risk journey coverage gaps | COMPLETE | Groups, Notifications, Rooms, Birthdays, Marketplace and Settings now have automated server-authority, access-boundary and user-visible success/failure journey coverage recorded in route truth and the high-risk test matrix. |
| METRIC-001 | Define the route analytics event contract | COMPLETE | Versioned `route_viewed` ingestion records registry-derived lifecycle, surface, access and canonical route metadata; raw URLs, dynamic identifiers, query/hash state, titles and referrers are excluded and contract-tested. |
| METRIC-002 | Capture the baseline product scorecard | IN PROGRESS | Privacy-safe scorecard aggregation, readiness gates, admin visibility and JSON export are implemented and tested; completion still requires a reviewed 30-day production telemetry capture. |
| OWNER-001 | Assign named accountable owners | NOT STARTED | Registry currently records accountable roles, not named people. |
| QUALITY-001 | Correct visible encoding defects | NOT STARTED | Scheduled after product-truth controls. |

## Later roadmap phases

| Phase | Objective | Status |
|---|---|---|
| Phase 1 | Reliability, measurement and user control | NOT STARTED |
| Phase 2 | Trust, data rights and server authority | NOT STARTED |
| Phase 3 | Complete high-value product loops | NOT STARTED |
| Phase 4 | Recommendation quality and responsible monetization | NOT STARTED |
| Phase 5 | Regional ecosystem scale | NOT STARTED |

## Change log

### 3 August 2026

- Started TRUTH-001 through TRUTH-004.
- Added the first shared route truth registry with lifecycle, access, authority, ownership role, KPI and test-evidence fields.
- Classified every one of the 181 declared `App.jsx` paths exactly once; all legacy assistant features also resolve to a registry classification.
- Replaced fabricated Dashboard, Memories, Saved, Events and Ads Manager content—and browser-only Feedback submission claims—with honest Preview states and production alternatives.
- Made the Navbar, Create menu, Quick Access, birthday shortcuts, promotional discovery and assistant action executor lifecycle-aware; Preview items are contained and Beta/Experimental entries carry labels.
- Made Akuso lifecycle-aware: Preview capabilities have no routes or actions and cannot enter visible or recommended feature lists.
- Completed TEST-001 alongside the truth package.
- Verification passed: frontend tests (112 files, 394 tests), frontend lint, frontend production build, backend route-truth tests (10), and existing Akuso service tests (34).
- Completed GROUP-001: removed browser-backed group creation, posting, sharing, directory reads and fallback behavior; the Group API and database are now authoritative.
- Deleted legacy `tengacion:user-groups:v1` and `tengacion:group-shares` records on Groups entry and removed their read/write APIs.
- Added Groups API contract coverage plus frontend coverage for API failure, confirmed creation/posting, share persistence and Messenger group discovery. TEST-002 is now in progress because the Groups gap is covered while five named high-risk areas remain.
- GROUP-001 verification passed: 11 targeted frontend tests, 4 backend Groups API tests, 10 backend route-registry tests, frontend lint and the frontend production build.
- The full frontend regression run passed 401 of 402 tests across 114 of 115 files; the unrelated AdminPanel Escape-close timing assertion failed during the loaded run and passed its isolated 2-test rerun. This is recorded as a flaky existing regression, not counted as GROUP-001 verification.
- Completed ACTION-001 with an executable frontend source audit and a detailed action-truth inventory.
- Resolved 45 action-truth violations: connected 17 controls to existing production destinations, converted two fake controls to status text, and visibly disabled 26 controls whose backend workflow does not exist.
- Replaced placeholder clicks for Group invitations and Messenger voice/video calls with explicit disabled states. Unsupported Group post actions, settings/search tools, creator shortcuts and legacy editor actions are recorded for later product packages.
- ACTION-001 verification passed: zero violations from `npm run audit:actions --prefix frontend`, 14 focused frontend tests, frontend lint, frontend production build, and the full frontend suite (115 files, 402 tests).
- Completed FEEDBACK-001: replaced the Preview-only feedback page with a Beta form for product feedback, bug reports, feature ideas, accessibility feedback and safety concerns.
- Feedback submissions now use the authenticated Support Complaint API and `AdminComplaint` authority, carry a `product_feedback` flow tag, enter Admin Messages, notify the review team and emit the existing support analytics event. The form clears only after a durable server reference and keeps the user's text on any failure or incomplete response.
- Updated route truth and Akuso so Feedback is a navigable Beta capability with its real server authority and support help path.
- FEEDBACK-001 verification passed: 9 focused frontend tests, 14 focused backend tests, frontend lint, inert-control audit, production build, and the full frontend suite (116 files, 404 tests).
- Completed ROUTE-001: established `/creator/:username` as the canonical public creator profile family for home, music, albums, podcasts, books, posts and store views.
- Creator-ID compatibility routes now resolve through the Public Creator Profile API and replace browser history with the username route while preserving query and hash state. Direct server requests issue query-preserving HTTP 308 redirects; legacy `songs` resolves to music and `comedy` resolves to creator home.
- Made `/artist/:username` an explicitly public compatibility alias while retaining authentication for follow, message, purchase and subscribe actions. Reserved `/creator` workspace segments remain protected and cannot be interpreted as public usernames.
- Canonicalized the Pyrexx underscore and artist aliases to `/pyrexx-singz`, recorded the maintainers' contract in `docs/tengacion-route-contracts.md`, and synchronized the route truth registry.
- ROUTE-001 verification passed: 16 initial focused frontend tests plus 5 final canonical-route tests, 42 focused backend contract tests plus a final 14-test SEO rerun, frontend lint, zero inert-control violations, backend syntax checks, frontend production build, and the full frontend suite (119 files, 413 tests).
- Completed TEST-002 across Groups, Notifications, Rooms, Birthdays, Marketplace and Settings, with the enforced journey inventory recorded in `docs/tengacion-high-risk-journey-test-matrix.md` and linked from route truth.
- Notification read state now rolls back and resynchronizes with the server after failed single or bulk mutations. Recipient isolation returns explicit 404 responses, invalid identifiers return 400, expired alerts stay out of the inbox, and preference writes accept only allowlisted Boolean values.
- Room discovery no longer exposes unrelated private rooms. Private feeds and messages require membership, message writes require membership for every room, owners cannot orphan rooms by leaving, and the UI reloads server-confirmed membership while retaining visible failures.
- Friend-visible birthdays are now disclosed only to friends or the account owner; public birthdays remain discoverable and private birthdays remain excluded. Birthday wish drafts clear only after the Messages API confirms persistence.
- Added marketplace browse/filter and checkout-recovery coverage plus settings privacy, notification, audio, security and session persistence coverage. Existing marketplace payment tests continue to enforce buyer-price, fee and payout integrity.
- TEST-002 verification passed: 15 focused frontend tests, 30 focused backend tests, frontend lint, zero inert-control violations, backend syntax and diff checks, production build, and the full frontend suite (124 files, 424 tests).
- Completed METRIC-001 with a versioned `route_viewed` contract owned by the shared route truth registry and documented in `docs/tengacion-route-analytics-contract.md`.
- The React Router tracker now records both public and authenticated navigation through a dedicated rate-limited endpoint, suppresses duplicate router locations, and sends only feature ID plus parameterized route pattern. Configured Google Analytics receives the same privacy-safe pattern and registry title.
- The analytics API strictly rejects extra browser fields, unsupported versions, query/hash data and unregistered feature-pattern pairs. Lifecycle, surface, access and canonical path are derived server-side; authentication is associated only from a validated optional session.
- Route matching now expands nested creator-workspace declarations so `/creator/dashboard` and other reserved workspace paths cannot be counted as public creator usernames.
- METRIC-001 verification passed: 7 focused frontend tests, 17 combined backend analytics/route-truth tests, frontend lint, zero inert-control violations, backend syntax checks and the production build. The full frontend run passed 426 of 427 tests across 124 of 125 files; the unrelated Public Contact submission test exceeded its 20-second timeout only under the loaded run and passed all 4 tests in the isolated rerun.
- Started METRIC-002 with a versioned baseline product scorecard over the server-derived `route_viewed` contract. The admin-only aggregation reports governed feature reach, authenticated/anonymous mix, registry and production coverage, lifecycle/surface/access distributions, daily totals, parameterized route totals and zero-view production features without returning account or resolved route identifiers.
- Added an explicit 30-calendar-day capture gate with `no_data`, `insufficient_selected_window`, `insufficient_telemetry_window` and `ready` states. Admin Analytics surfaces the honest state and can export the current scorecard as JSON.
- Documented the production capture and review procedure in `docs/tengacion-product-scorecard.md`. METRIC-002 remains in progress because no 30-day production telemetry window exists yet.
- METRIC-002 implementation-layer verification passed: 3 focused backend test files (20 tests), the focused Admin Analytics test, backend syntax checks, frontend lint with one pre-existing warning, zero inert-control violations and the frontend production build. Production capture evidence is still outstanding.
- No Phase 1 or later work package is recorded as complete.
