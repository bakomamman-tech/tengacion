# Tengacion Next-Forty Resilience, Assurance, and Audit Controls

Last updated: 2 September 2026

## Scope

This implementation covers the next forty sequenced roadmap packages:

- `RESILIENCE-002` through `RESILIENCE-015`
- `ASSURANCE-001` through `ASSURANCE-015`
- `AUDIT-001` through `AUDIT-011`

The implementation establishes durable control, evidence, review, and reporting paths. It does not invent production incidents, drill outcomes, assurance approvals, audit samples, remediation outcomes, or external opinions. An empty environment remains visibly unobserved.

## Canonical authorities

### Resilience

- `ResilienceObjective` remains the authority for critical-flow SLO, error-budget, delay, recovery-priority, pause, and rollback targets.
- `ResilienceIncident` is the shared incident-command record. It owns severity, affected surface, user impact, workflow state, degraded mode, mitigation, next update, rollback option, support copy, runbook, communications, recovery evidence, and history.
- `ResilienceDrill` owns planned and executed drill evidence. Scheduled or planned drills are not observed outcomes. Completed or failed drills require execution timestamps, validation evidence, and recorded human review.
- `ResilienceGate` owns expiring, evidence-backed launch or partner resilience decisions. Approval requires stored evidence, a named human approver, and an expiry.

The service publishes reusable catalogs for:

- eight graceful-degradation modes across ten critical workflows
- twenty-four finance, partner/API, data/trust, and Akuso incident classes
- twenty-five controlled drill scenarios
- eight resilience gates
- ten user-facing continuity states
- ten recovery, replay, reconciliation, rollback, and correction workflows

### Assurance

- `AssuranceControl` owns the environment-specific control registry, including owner, reviewer, objective, evidence source, freshness expectation, automation status, exception severity, readiness implication, review times, and audit notes.
- `AssuranceEvidencePack` owns standardized finance, partner, API, market, data, experiment, recommendation, privacy, trust, rights, Akuso, and due-diligence evidence.

An active assurance control requires reviewed current evidence. A ready evidence pack requires current reviewed evidence, no unresolved high or critical exception, and an approval shelf life. Externally shareable packs must also be explicitly approved and sanitized of restricted details.

The service publishes:

- an eighteen-surface assurance control catalog
- a consistent evidence-pack shape and six freshness states
- twelve expiring readiness gates
- fifteen continuous-monitoring checks
- thirteen due-diligence room sections with explicit sharing levels

### Audit

- `AuditDomain` owns the sixteen-domain audit universe, risk ranking, scope, evidence room, schedule, readiness state, and sharing classification.
- `AuditControlTest` owns population, sample, selection method, expected evidence, actual evidence, result, reviewer, exception, root cause, and retest requirement.
- `AuditFinding` owns severity, affected obligation/control, root cause, evidence, accountable owner, due date, remediation, compensating control, accepted risk, independent retest, and closure evidence.

A completed test requires actual evidence and a reviewer. A failed test requires an exception and root cause. A finding cannot close from an owner assertion; it requires a passed independent retest and closure evidence. Accepted risk requires a named approver, expiry, compensating control, and review trigger.

The service publishes:

- the sixteen-domain audit universe
- seven first-audit scope candidates
- nine standard testing methods and five result classes
- sixty sample-control contracts across finance, privacy/security/vendor, content/rights/market, partner/API/reporting, and Akuso/AI
- an aggregate external summary that excludes restricted finding and sample details

## State and truth rules

The combined operating report enforces these boundaries:

- a configured SLO is a target, not observed reliability
- a scheduled drill is not a passed drill
- a mitigation in progress is not recovery
- a registered assurance control is not current evidence
- stale, delayed, disputed, blocked, or withdrawn evidence cannot support readiness
- a configured audit domain is not a tested domain
- a queued sample is not a completed test
- an owner remediation statement is not closure
- a package implementation status is not an external assurance or audit opinion

Resilience, assurance, and audit decisions remain `hold_for_evidence` or their domain-specific hold state until the necessary observed and reviewed records exist.

## Protected API and audit trail

All routes are beneath the authenticated admin router and inherit admin role enforcement. Mutations use the existing rate-limited audit helper.

Read:

- `GET /api/admin/analytics/resilience-assurance-audit-operating-system`

Resilience mutations:

- `POST /api/admin/resilience/incidents`
- `PATCH /api/admin/resilience/incidents/:incidentId`
- `POST /api/admin/resilience/drills`
- `PATCH /api/admin/resilience/drills/:drillId`
- `PUT /api/admin/resilience/gates/:gateKey`

Assurance mutations:

- `POST /api/admin/assurance/controls`
- `PATCH /api/admin/assurance/controls/:controlId`
- `POST /api/admin/assurance/evidence-packs`
- `PATCH /api/admin/assurance/evidence-packs/:packId`

Audit mutations:

- `POST /api/admin/audit/domains`
- `PATCH /api/admin/audit/domains/:domainId`
- `POST /api/admin/audit/control-tests`
- `PATCH /api/admin/audit/control-tests/:testId`
- `POST /api/admin/audit/findings`
- `PATCH /api/admin/audit/findings/:findingId`

Audit events record the target, reason, state, severity, evidence state, and other bounded metadata without copying restricted evidence into `AuditLog`.

## Admin Analytics

Admin Analytics loads and exports the same protected combined report. The panel shows:

- package implementation count
- open and critical incidents
- planned versus observed drills
- approved resilience gates
- assurance freshness, packs, and high-risk exceptions
- audit domains and controls tested
- failures, findings, and retest queue
- Akuso and external-use boundaries

No-data states explain that evidence is unconfigured or unobserved. The UI does not convert zero records into a healthy state.

## Privacy and external sharing

Internal incident, assurance, and audit records may contain operational or restricted context. External summaries exclude:

- user-level rows
- payment credentials or secrets
- private content and messages
- security details
- safety-case details
- Akuso memory
- raw sample evidence and restricted finding details

Only current, reviewed, sanitized, explicitly approved packs can appear in the due-diligence room. Expired approval or non-current evidence reopens review.

## Akuso boundaries

Akuso adds three reviewable writing modes:

- resilience status summary
- assurance evidence summary
- audit findings summary

Seven release-eval suites cover incident source grounding, recovery claims, evidence freshness, external-pack privacy, audit-result accuracy, risk acceptance, and high-risk workflows.

Akuso may explain verified state, draft reviewed communications or evidence summaries, highlight missing evidence, and route work to the accountable owner. It cannot:

- declare recovery
- change incident or workflow state
- approve a resilience or assurance gate
- accept an exception or risk
- change an audit result
- close a finding
- expose restricted evidence
- grant access or move money
- make legal, rights, privacy, moderation, or finance decisions
- publish an external assurance or audit opinion

## Rollback and correction

Every resilience gate requires a pause or rollback condition. Drill evidence records runbook, workflow, and Akuso-eval follow-ups. Incident correction remains linked to the authoritative incident record.

Assurance packs can be revoked or withdrawn when evidence changes. Audit findings preserve history through remediation, retest, closure, or time-bounded accepted risk. Corrections do not overwrite the prior reviewed state.

## Verification

Executable coverage includes:

- model invariants for drill evidence, gate approval, assurance freshness, external sharing, audit testing, finding closure, and risk acceptance
- conservative empty-state and exact forty-package contract tests
- protected admin route and mutation audit tests
- Admin Analytics panel and existing page integration tests
- Akuso writing-profile and release-eval registration tests
- backend syntax, repository lint, action/encoding audits, diff validation, Akuso release evaluations, and frontend production build

Operational evidence remains incomplete until real incidents, drills, assurance reviews, audit samples, remediation, and retests are performed and stored through these authorities.
