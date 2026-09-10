# Next 45: external readiness implementation

Resumed on 9 September 2026 from the six unfinished external-readiness files left after AUDIT-011.

## Scope and entry points

This batch implements AUDIT-012–016, CERTIFICATION-001–016, INSTITUTIONAL-001–016 and CAPITAL-001–011 (48 packages). CAPITAL-010 completes the software packages for the Days 31-60 capital-readiness phase; CAPITAL-011 implements the first Days 61-90 decision-support deliverable. Open **Admin → External readiness** at `/admin/external-readiness`. Existing audit tests and findings remain their canonical authorities.

The checked-in package catalog preserves each roadmap's requirements and acceptance criteria. Each package has a durable record workflow, requirement responses linked to evidence, named administrator ownership, scope, audit domain, due date, expiration, dependencies, review history and an operational readiness result. Calendar, claim, risk, decision, candidate, financial and allocation records add their relevant fields and gates. These are implemented operating tools; the software does not perform real-world assessments, fundraising, legal decisions or certification.

## Review and evidence contract

Save creates or revises a draft and clears previous signoff and approval. Only the owner can attest it. Submission checks evidence coverage, dates, dependencies, domain findings and the package's structured requirements. An independent administrator who did not author or revise the record reviews it. Every mutation includes a reason, optimistic version checks where applicable, and bounded audit metadata. Errors never expose server internals. Administrator routes enforce the existing role middleware and rate limits.

Retest submission may retain unresolved findings so a reviewer can work on them. Approval cannot bypass those findings: linked retests must have canonical passing results and closure evidence. Control owner attestations require current, observed passing canonical control tests. Missing, expired, disputed, overdue, cyclic or unresolved dependencies block readiness. Updating a packet returns it to draft; old recipient access cannot become valid against a new version.

## Sharing and diligence

Access grants require an approved sanitized packet, a specific authenticated recipient and an expiry no later than the packet or its evidence. The recipient URL is `/readiness/packets/:shareId`. Every read rechecks recipient identity, version, expiry, withdrawal, evidence and findings. The response allowlist contains only title, approved summary, scope, exclusions, audience, version, watermark and expiry/withdrawal information. Internal source references, sample data, evidence responses, private findings, financial inputs and record history are excluded. Routes return `Cache-Control: no-store`.

Creating access does not send any message. Administrators can revoke it. Recipients can submit diligence questions; responses remain invisible until independently approved. A revoked or invalid packet also prevents reading its answers. Shared summaries still require human sanitization and review; software cannot determine whether arbitrary prose is factually true or appropriate to disclose.

## Financial and institutional decisions

Financial scenarios distinguish actual, estimated, assumed, disputed and externally unapproved inputs. Values use one currency and a monthly YYYY-MM period. Missing values remain missing; zero is retained. Monthly cost sums payment, infrastructure, media, support, moderation, AI, vendor and hiring costs. Net burn subtracts platform revenue once; subscription and partner revenue are already included in it. Runway is cash divided by positive net burn, otherwise unavailable with an explicit reason. Financial models do not authorize money movement or attest a finance close.

Risk appetite has warning and blocker thresholds; exceeded thresholds block review. Risk acceptance requires mitigation, a compensating control, a review trigger and a future expiration; critical risks cannot be accepted through these records. Allocation records require budget bounds, currency, milestone, success/risk measures, stop-loss and reversal conditions. Decisions require alternatives and reversal conditions. Candidate scoring remains advisory; human review selects the path.

## Reporting and Akuso

The internal JSON download includes package status, records, blockers, financial summaries, questions, grants, calendar, alerts and canonical finding summaries. It is all-time inventory, independent of Analytics date filters. It is bounded to 250 records/questions/shares and 500 findings; exceeded limits are explicitly marked incomplete and keep the strategy decision on hold. No evidence means no readiness. This report is internal and must not be forwarded as an external packet.

Four Akuso writing profiles support certification summaries, institutional decision briefs, capital scenario explanations and diligence drafts. They preserve source, freshness, scope and human review boundaries. Akuso gains no mutation, access, publication, financial, legal or certification authority.

## Recovery and rollback

Withdraw a record or revoke a share to stop future recipient reads. Correct a record by saving a new draft and obtaining fresh signoff and independent review. Previously downloaded or copied material cannot be remotely erased. Removing the new navigation and API mount disables the feature without deleting its records or changing existing audit history. No deployment or external outreach is included in this batch.

## Package coverage

| Package           | Implemented workflow                                         | Record kind    |
| ----------------- | ------------------------------------------------------------ | -------------- |
| AUDIT-012         | Retest High-risk Findings                                    | retest         |
| AUDIT-013         | Launch Control Owner Certification                           | attestation    |
| AUDIT-014         | Prepare External Review Packets                              | packet         |
| AUDIT-015         | Build Audit Dashboard And Calendar                           | calendar       |
| AUDIT-016         | Decide The Next Assurance Path                               | decision       |
| CERTIFICATION-001 | Build The Certification Candidate Inventory                  | candidate      |
| CERTIFICATION-002 | Select Scope And Readiness Gates                             | scope          |
| CERTIFICATION-003 | Define Trust Center And Evidence Sharing Model               | packet         |
| CERTIFICATION-004 | Create The Claims Register                                   | claim          |
| CERTIFICATION-005 | Map Certification Gaps And Reviewer Workflow                 | review         |
| CERTIFICATION-006 | Launch Internal Trust Center                                 | packet         |
| CERTIFICATION-007 | Run Mock Security, Privacy, Data, And Vendor Review          | review         |
| CERTIFICATION-008 | Run Mock Finance, Creator Earnings, And Payout Review        | review         |
| CERTIFICATION-009 | Run Mock Partner, API, Content, Market, And Reporting Review | review         |
| CERTIFICATION-010 | Run Mock Akuso And AI Governance Review                      | review         |
| CERTIFICATION-011 | Automate Fragile Evidence Paths                              | monitor        |
| CERTIFICATION-012 | Prepare Approved External Packets                            | packet         |
| CERTIFICATION-013 | Close Or Risk-accept Certification Blockers                  | risk           |
| CERTIFICATION-014 | Launch Controlled Trust Center Sharing                       | sharing        |
| CERTIFICATION-015 | Begin Selected External Review Or Assessor Intake            | review         |
| CERTIFICATION-016 | Publish Certification Readiness Report                       | report         |
| INSTITUTIONAL-001 | Create The Governance Calendar                               | calendar       |
| INSTITUTIONAL-002 | Standardize Decision Records                                 | decision       |
| INSTITUTIONAL-003 | Build Institutional Data-room Structure                      | packet         |
| INSTITUTIONAL-004 | Define Risk Appetite Statements                              | appetite       |
| INSTITUTIONAL-005 | Map Finance, Enterprise, Market, And AI Governance Gaps      | risk           |
| INSTITUTIONAL-006 | Run First Executive Operating Review                         | review         |
| INSTITUTIONAL-007 | Prepare Investor And Institutional Data-room Packets         | packet         |
| INSTITUTIONAL-008 | Strengthen Finance, Capital, And Unit Economics Reporting    | financial      |
| INSTITUTIONAL-009 | Build Enterprise, Partner, API, And Market Readiness Packets | packet         |
| INSTITUTIONAL-010 | Launch Risk Register And Commitment Tracking                 | commitment     |
| INSTITUTIONAL-011 | Run Akuso Institutional Governance Review                    | review         |
| INSTITUTIONAL-012 | Publish Institutional Operating Report                       | report         |
| INSTITUTIONAL-013 | Run Strategic External Readiness Review                      | review         |
| INSTITUTIONAL-014 | Close Or Accept Institutional Risks                          | risk           |
| INSTITUTIONAL-015 | Stabilize Governance And Data-room Maintenance               | monitor        |
| INSTITUTIONAL-016 | Decide The Next Institutional Path                           | decision       |
| CAPITAL-001       | Define The Capital Strategy                                  | decision       |
| CAPITAL-002       | Build The Capital Readiness Scorecard                        | scorecard      |
| CAPITAL-003       | Strengthen The Financial Model                               | financial      |
| CAPITAL-004       | Define Use-of-funds And Capital Allocation Gates             | allocation     |
| CAPITAL-005       | Create Investor, Strategic Partner, And Claims Governance    | candidate      |
| CAPITAL-006       | Build The Capital Data-room Packet                           | packet         |
| CAPITAL-007       | Run Mock Investor Diligence                                  | review         |
| CAPITAL-008       | Run Mock Strategic Partner Diligence                         | review         |
| CAPITAL-009       | Validate Unit Economics And Capital Allocation               | unit_economics |
| CAPITAL-010       | Close Or Narrow Capital Blockers                              | risk           |
| CAPITAL-011       | Make The Capital Path Decision                               | decision       |

CAPITAL-010 adds evidence-gated blocker decisions for all eleven roadmap blocker categories. Closure and claim narrowing require current linked evidence. Advisor-reviewed risk requires bounded controls, future expiry and current advisor-review evidence; critical risk cannot be accepted through the record. CAPITAL-009 economics risk triggers may be linked without duplicating the canonical unit-economics engine.

The software records and validates decision-support artifacts only. It does not establish real-world closure, authorize outreach or fundraising, change financing, accept legal, tax, compliance, audit, security or financial risk, approve spending or move money.

CAPITAL-010 validation: 22/22 focused backend tests; 67/67 combined External Readiness backend tests; 6/6 focused frontend tests; 14/14 combined External Readiness frontend tests; frontend ESLint PASS; production Vite build PASS; `git diff --check` PASS.
## Verification

Verification results and the next stopping point are recorded in `docs/tengacion-external-readiness-handoff.md`.

## CAPITAL-011 validation — 10 September 2026

CAPITAL-011 — Make The Capital Path Decision ? is COMPLETE as local software, uncommitted and not deployed.

The existing External Readiness service now saves the structured capital-path decision, includes its deterministic blockers, and reports capitalPathAnalysis and the authoritative capitalPathConfig. The dedicated workspace uses all nine configured paths and eight packet sections, links record evidence, preserves canonical decision/alternatives/reversal fields, and locks review transitions until governance edits are saved. Owner signoff, independent review, evidence freshness, versioning and draft revision controls remain intact.

Validation obtained for this implementation:

* Catalog: 48 unique packages; 11 consecutive capital packages, CAPITAL-001 through CAPITAL-011; nine paths and eight packet sections.
* Backend syntax checks: PASS.
* CAPITAL-011 focused backend: 42/42 PASS.
* Combined backend: 109/109 PASS across CAPITAL-009, CAPITAL-010, CAPITAL-011, External Readiness and External Readiness writing (5 suites).
* CAPITAL-011 focused frontend: 16/16 PASS.
* Combined frontend: 30/30 PASS across CAPITAL-009, CAPITAL-010, CAPITAL-011 and External Readiness (4 suites).
* Repository-wide frontend ESLint: PASS.
* Production Vite build: PASS.
* git diff --check and whitespace checks on changed untracked source files: PASS.

Backend used the existing serial Jest invocation from backend. Frontend used --pool=threads --maxWorkers=1, as documented for this Windows environment; the initial default forks worker failed to start. Final focused and combined runs completed without that error or React async-test warnings.

CAPITAL-011 software completion does not mean Tengacion has actually chosen, approved, initiated, or completed a real-world financing transaction. A real capital-path choice remains a human governance decision based on current evidence and independent review. No-go and delay are legitimate outcomes. All six software authority flags remain false: path selection, outreach, fundraising, partner terms, spending and money movement. Software approval is not external legal, tax, audit, financial, investment, security or compliance approval. Akuso gains no decision, outreach, terms, risk-acceptance or money-movement authority.

Next verified deliverable: **Run Controlled Outreach Or Strategic Conversations**, Days 61–90 deliverable 2 in docs/tengacion-capital-30-60-90-roadmap.md. The current catalog ends at CAPITAL-011, so CAPITAL-012 is the next available package identifier; it has not been added or implemented.
