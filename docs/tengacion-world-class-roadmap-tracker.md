# Tengacion World-Class Roadmap Implementation Tracker

Last updated: 15 August 2026

This document is the authoritative implementation record for the Facebook benchmark roadmap. A work package is marked complete only after its definition of done is implemented and verified. Planning documents and code presence alone do not count as completion.

## Status legend

- `NOT STARTED`: No implementation work has begun.
- `IN PROGRESS`: Implementation has begun but the definition of done is not fully verified.
- `BLOCKED`: Work cannot continue without a recorded decision or external dependency.
- `COMPLETE`: Implementation and required verification are finished.

## Phase 0: product truth and control

| ID | Work package | Status | Verification record |
|---|---|---|---|
| TRUTH-001 | Create the route truth registry | COMPLETE | One shared registry classifies all 182 App paths exactly once and records lifecycle, access, authority, owner role, KPI, flag and test evidence. |
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
| QUALITY-001 | Correct visible encoding defects | COMPLETE | Invalid Windows-1252 punctuation in the creator Artist page is normalized to UTF-8, and an executable repository-wide audit enforces zero mojibake, replacement-character or corrupt-entity defects across repository text surfaces. |

## Later roadmap phases

| Phase | Objective | Status |
|---|---|---|
| Phase 1 | Reliability, measurement and user control | IN PROGRESS |
| Phase 2 | Trust, data rights and server authority | IN PROGRESS |
| Phase 3 | Complete high-value product loops | IN PROGRESS |
| Phase 4 | Recommendation quality and responsible monetization | IN PROGRESS |
| Phase 5 | Regional ecosystem scale | NOT STARTED |

### Growth and operating-system work packages

| ID | Work package | Status | Verification record |
|---|---|---|---|
| GROWTH-001 | Add personalized creator growth experiments | COMPLETE | Five stage-aware checklists are served through the creator operating console; shown, acted-on and dismissed events are server-validated and durable, post-action outcomes are measured, and Akuso is limited to a reviewable announcement template. |
| RETENTION-001 | Build fan retention cohorts | COMPLETE | Admin Analytics reports first-follow, first-purchase, first-renewal, first-live-join and first-completion cohorts with mature D1/D7/D30, purchase, subscription, follow and notification opt-out measures. |
| RECOMMEND-001 | Add recommendation trust and diversity controls | COMPLETE | Discovery enforces audited global creator-cap, content-streak, exploration, hide/report and conversion controls; sparse samples cannot affect ranking, server-owned logs establish creator attribution, and Admin Analytics exposes diagnostics and bounded tuning. |
| AI-GATE-001 | Gate Akuso changes with eval and review policy | COMPLETE | The release command generates attachable eval evidence and blocks static regressions; the authenticated gate adds live review-backlog policy and blocks unresolved high-risk safety or abuse reviews. |
| OPS-001 | Launch the executive operating dashboard | COMPLETE | Admin Analytics combines commercial, creator, fan, recommendation, Akuso, support and reliability signals with current/prior week, four-week, target, status and drilldown contracts, including truthful no-data states. |

### Phase 1 work packages

| ID | Work package | Status | Verification record |
|---|---|---|---|
| REL-001 | Separate public readiness probes from operator diagnostics | COMPLETE | Public liveness/readiness probes are non-cacheable and reveal only runtime state, degraded readiness returns HTTP 503 with a retry window, and authenticated Admin Settings exposes the full required/advisory dependency checklist. |
| CONTROL-001 | Provide a self-service portable account snapshot | COMPLETE | Reauthenticated Privacy Settings downloads a server-generated, audited JSON snapshot with an explicit scope/completeness manifest, bounded activity sections and allowlisted fields that exclude authentication/provider secrets and other people's private replies or incoming messages. |
| CONTROL-002 | Make permanent account deletion a verified user-controlled journey | COMPLETE | Authenticated non-admin users can review retention, reauthenticate, explicitly confirm and permanently delete their account; failed reauthentication preserves the valid session, completion revokes every session and is minimally audited, and Akuso can navigate but cannot perform the action. |

### Phase 2 work packages

| ID | Work package | Status | Verification record |
|---|---|---|---|
| SAFETY-001 | Make account blocking authoritative and user-manageable | COMPLETE | Privacy Settings now provides searchable, server-confirmed limited-account lists; canonical blocks remove relationship links and are enforced mutually across people discovery, profiles, feeds, creator follows, contacts, friend requests and every direct-message write transport, while unblocking never fabricates restored relationships. |

## Change log

### 15 August 2026

- Completed GROWTH-001 with five personalized creator experiments, live readiness checklists, durable prompt feedback, daily impression deduplication and server-derived post-action outcome measurement.
- Completed RETENTION-001 with five first-behavior cohorts, exact 24-hour D1/D7/D30 windows, maturity-safe aggregate rates, repeat monetization and follow conversions, opt-out diagnostics and operating priorities.
- Completed RECOMMEND-001 with persisted and audited ranking policy, strict creator/content diversity, safe exploration, stable-sample trust adjustments, recommendation-report feedback and admin diagnostics.
- Completed AI-GATE-001 with a deterministic JSON release report and an authenticated review-backlog gate. The static run passed all 34 Akuso scenarios with no critical or route-target failures.
- Completed OPS-001 with a weekly executive metric contract spanning revenue, payouts, creator/fan retention, recommendations, Akuso, support and incidents, plus target states and drilldowns.
- Documented the contracts and operating boundaries in `docs/tengacion-growth-retention-and-governance-controls.md` and added current implementation anchors to the execution roadmap.
- Verification passed: 23 focused backend route/service/discovery tests, 3 focused roadmap frontend tests, the TengaHarvest route test, backend syntax and diff checks, repository-wide frontend lint, the inert-control and encoding audits, the Akuso release gate, and the frontend production build. TengaHarvest conditionals now follow the enforced brace policy, while its route predicate and root application component live in Fast Refresh-safe modules.

### 9 August 2026

- Completed SAFETY-001 by replacing the raw user-ID privacy form with account search, explicit block-impact confirmation, and reviewable blocked, muted, restricted and story-hidden lists populated by the authenticated User API.
- Established `User.blocks` as the canonical block authority. Startup maintenance and safety-list reads migrate legacy `blockedUsers` identifiers, while compatibility reads remain in place during rollout.
- Confirmed blocks now remove friendship, pending-request, close-friend, following and follower links in both directions. Mutual blocks are excluded from people search, directory, friend hubs, profiles, feeds, creator follows and message contacts without revealing who blocked whom.
- Moved direct-message authorization into the shared persistence service so REST, compatibility, follower-share and Socket.IO writes cannot bypass blocks and ordinary writes honor recipient message preferences; trusted admin follow-ups retain their existing privacy exception unless the user has blocked the admin, while moderation notices use an explicit internal bypass.
- Grounded Akuso in the real Privacy Settings controls and classified block, unblock, mute and restrict requests as sensitive actions that Akuso may explain or navigate to but cannot perform.
- Reconciled the existing AI Professionals in Kaduna State route into route truth, restoring exact coverage across all 182 declared App paths.
- Documented canonical authority, block/unblock semantics, migration behavior and AI boundaries in `docs/tengacion-account-safety-controls.md`.
- SAFETY-001 verification: focused backend safety and Akuso service tests, focused Privacy Settings tests, backend syntax checks, frontend lint, action and encoding audits, route-truth tests, and a production frontend build.
- Completed CONTROL-002 around the existing retention-aware deletion service and public `/account-deletion` page.
- Corrected failed password reauthentication from `401` to `403`, preventing a mistyped password from revoking an otherwise valid login; all deletion responses are now non-cacheable.
- Added a bounded `account_deleted` completion audit event after deletion while keeping audit failure from misreporting an already completed destructive action as failed.
- Registered account deletion as a grounded Akuso capability and classified deletion prompts as sensitive, so Akuso can open the secure page but cannot perform or model-execute the request.
- Documented deletion scope, retained-record handling, administrator restrictions and AI boundaries in `docs/tengacion-account-deletion.md`.
- CONTROL-002 verification: backend deletion integration tests, the frontend account-deletion journey tests, focused Akuso service coverage, syntax checks, frontend lint, action and encoding audits, and a production frontend build.

### 4 August 2026

- Completed CONTROL-001 with the authenticated, current-password-confirmed and rate-limited `/api/users/me/export` contract plus a download control in Privacy Settings.
- The versioned JSON snapshot includes account/profile preferences, relationship and security metadata, creator details, authored posts/stories, genuinely user-authored sent messages and purchases. System-generated reminders, incoming messages, other people's replies/reactions and authentication/provider secrets are excluded.
- Added a per-section 5,000-record safety bound with truthful completeness metadata and a privacy-support next step, plus an `account_data_exported` audit event containing metadata only.
- Documented the account export contract, updated the public Privacy Policy, registered its API authority/test evidence in route truth and taught Akuso to direct account-data requests to the real Privacy Settings control.
- CONTROL-001 verification passed: 3 focused backend test files passed all 15 tests, 3 focused frontend test files passed all 9 tests, backend syntax checks and frontend lint were clean, action and encoding audits passed, and the frontend production build completed successfully.

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
- Completed QUALITY-001 by converting the legacy Artist page from mixed Windows-1252/ASCII bytes to valid UTF-8. Its loading ellipsis, error separator and saving ellipsis now render as the intended punctuation instead of replacement glyphs.
- Added `npm run audit:encoding --prefix frontend`, which scans repository text surfaces for invalid UTF-8 replacement characters, recognized Latin-1/Windows-1252 mojibake sequences and corrupt HTML entities while excluding generated mobile build artifacts and third-party/build directories. The initial clean run scanned 1,268 files with zero defects.
- Replaced the Trending page's literal corrupt-character regression pattern with Unicode code-point escapes and added source-wide audit tests covering both positive detection and the clean repository invariant.
- QUALITY-001 verification passed: the encoding audit scanned 1,268 files with zero defects, 3 focused frontend test files passed all 11 tests, frontend lint reported zero warnings or errors, the action audit found no inert controls, the audit script passed its syntax check and the frontend production build completed successfully.
- Started Phase 1 with REL-001. Public health probes now return non-cacheable, monitor-safe state without dependency names, configuration presence, failure lists or operator messages; degraded and draining readiness responses include a 30-second retry window.
- Added the authenticated `/api/admin/system/readiness` diagnostic contract and connected Admin Settings to its required and advisory dependency checks, status messages, uptime and last-check time.
- Added the deployment-readiness incident runbook and updated Render smoke-test guidance so detailed diagnostics are reviewed only through authenticated operator access.
- REL-001 verification passed: 3 focused backend test files passed all 16 tests, the focused Admin Settings test passed, backend syntax checks and frontend lint were clean, action and encoding audits passed, and the frontend production build completed successfully.
