# Tengacion Next Thirty Automation, Orchestration, and Resilience Controls

Date: 1 September 2026

Scope: `AUTOMATION-002` through `AUTOMATION-015`, `ORCHESTRATION-001` through `ORCHESTRATION-015`, and `RESILIENCE-001`.

## Outcome

This implementation turns the earlier automation registry into a governed control plane, adds a server-owned orchestration layer, and defines measurable recovery objectives for fifteen critical flows. It does not claim that empty pilots produced business impact, that configured SLOs prove reliability, or that Akuso can execute workflow transitions.

The implementation preserves these authority boundaries:

- only bounded, approved low-risk automation can reach pilot or active state
- prohibited automation is blocked before implementation
- payout, refund, account, takedown, partner, API, settlement, sponsored-surface, public-copy, privacy, security, moderation, rights, and legal outcomes retain human gates
- pending, failed, stale, or expired dependencies stop workflow progression
- overrides require requester or approver identity, reason, audit history, decision time, and expiration
- guardrail breaches pause or roll back the affected automation or workflow
- Akuso can explain, summarize, draft, and route, but cannot approve, bypass, override, publish, move money, grant access, or change authoritative state
- creator surfaces expose only the creator's own calm status and omit internal risk, other users, private fan behavior, and restricted partner evidence

## Durable authorities

| Authority | Purpose | Key invariants |
|---|---|---|
| `AutomationRegistryEntry` | Automation risk, approval, rollout, evidence, review, pause, and scale control | Pilot requires human approval, a runbook, and tested rollback; low-risk pilots require user controls; active state requires reviewed pilot evidence and a scale decision |
| `AutomationRun` | Trigger, source, outcome, review, support, incident, and user-control evidence | At least one authoritative signal is required; prohibited actions are blocked; review-gated completion requires a named human decision |
| `WorkflowDefinition` | Shared recipe, teams, dependencies, approvals, communication, metrics, and lifecycle | Pilot/default definitions require approval; default requires observed runs, a make-default review, and tested rollback |
| `WorkflowRun` | Server-owned workflow state, dependency evidence, approvals, overrides, user status, and incidents | Blocking dependencies prevent progression; sensitive workflows require approval; approved overrides expire; guardrail breaches pause or roll back |
| `ResilienceObjective` | SLO, error budget, recovery delay, pause, rollback, and recovery priority | Approved objectives require human review; entitlement, payout, and partner-export flows require their specific delay objectives |

The pre-existing ledger, payout, entitlement, consent, partner-access, moderation, rights, privacy, security, and audit authorities remain canonical. These models coordinate and report those authorities; they do not replace them.

## Roadmap package implementation

### Automation

| Package | Implemented contract |
|---|---|
| AUTOMATION-002 | Six reusable risk classes, nine review-gated action types, five prohibited action types, and pre-implementation enforcement |
| AUTOMATION-003 | Seven creator and six fan candidates with measurable success, guardrail, visibility, and user-control fields |
| AUTOMATION-004 | Six partner/API, six finance, and five operations check-or-routing candidates with owner and runbook requirements |
| AUTOMATION-005 | Akuso explanation, drafting, source, confidence, refusal, private-data, and publication boundaries |
| AUTOMATION-006 | Admin dashboard for state, risk, owner, rollout, runs, overrides, false positives, support, complaints, incidents, pause, rollback, and review |
| AUTOMATION-007 | Creator-owned run records plus dismiss, snooze, hide, explanation context, and help controls |
| AUTOMATION-008 | Fan-capable run records with suppression, opt-out, complaint, ignored-prompt, and abuse evidence without fan-row exposure |
| AUTOMATION-009 | Partner, API, finance, support, moderation, rights, data, and Akuso checks stay checks or routing until a human acts |
| AUTOMATION-010 | Source-grounded automation explanations and nine release-eval scenarios with cost/latency fields |
| AUTOMATION-011 | Evidence fields and decisions for scale, stay-pilot, suggestion-only, review-gated-only, pause, and retire |
| AUTOMATION-012 | Active state requires reviewed evidence, a scale decision, user controls, no open guardrail breach, and rollback readiness |
| AUTOMATION-013 | Standard run evidence covers true/false positives, missed incidents, owner response, support, and sensitive review |
| AUTOMATION-014 | Nine incident-playbook contracts plus pause, rollback, incident reference, user explanation, and correction evidence |
| AUTOMATION-015 | Internal readiness report exposes blockers and next options without converting registry state into causal proof |

### Orchestration

| Package | Implemented contract |
|---|---|
| ORCHESTRATION-001 | Workflow registry with shared lifecycle and fourteen server-owned run states |
| ORCHESTRATION-002 | Fourteen reusable dependency types with source, owner, pass, stale, override, escalation, and user-copy contracts |
| ORCHESTRATION-003 | Twenty-one governed creator, fan, partner, API, finance, support, trust, rights, recommendation, and Akuso workflows |
| ORCHESTRATION-004 | Separate internal and external status contracts keep useful status visible while withholding sensitive details |
| ORCHESTRATION-005 | Akuso is restricted to explanation, summarization, drafting, routing, and refusal |
| ORCHESTRATION-006 | One operating dashboard shows state, blockers, dependency health, approvals, aging, overrides, incidents, and guardrails |
| ORCHESTRATION-007 | Creator/campaign runs coordinate catalog, offer, entitlement, payout, support, recommendation, and copy-review evidence |
| ORCHESTRATION-008 | Fan/community recipes can coordinate consent, suppression, complaint, abuse, trust, diversity, and lifecycle state with aggregate creator reporting |
| ORCHESTRATION-009 | Partner/API/finance/support/trust runs retain consent, privacy, security, reconciliation, audit, capacity, and runbook gates |
| ORCHESTRATION-010 | Nine Akuso scenarios cover state, blocker, failed dependency, transition refusal, privacy, partner, finance, public copy, and incident handoff |
| ORCHESTRATION-011 | Definition evidence supports make-default, keep-pilot, simplify, return-manual, pause, and retire decisions |
| ORCHESTRATION-012 | Creator, campaign, and fan definitions persist reusable triggers, states, dependencies, approvals, statuses, support, rollback, and metrics |
| ORCHESTRATION-013 | Sensitive workflow definitions persist evidence, approval, escalation, audit, rollback, incident, and communication rules |
| ORCHESTRATION-014 | Dependency overrides expire; rollback, incident, user communication, support, metric, and Akuso corrections remain auditable |
| ORCHESTRATION-015 | Readiness derives only from configured definitions, observed runs, dependency health, guardrails, and reviewed default decisions |

### Resilience

| Package | Implemented contract |
|---|---|
| RESILIENCE-001 | Fifteen critical flows have durable availability/latency targets, error budgets, downtime/data-delay objectives, special entitlement/payout/partner delays, pause/rollback triggers, and recovery priority |

## Protected APIs

Admin-only, authenticated, rate-limited, and audit-logged:

- `GET /api/admin/analytics/automation-orchestration-operating-system`
- `PATCH /api/admin/operations/automation-control-plane/:automationId`
- `POST /api/admin/operations/automation-runs`
- `PATCH /api/admin/operations/automation-runs/:runId`
- `POST /api/admin/orchestration/workflow-definitions`
- `PATCH /api/admin/orchestration/workflow-definitions/:definitionId`
- `POST /api/admin/orchestration/workflow-runs`
- `PATCH /api/admin/orchestration/workflow-runs/:runId`
- `PUT /api/admin/reliability/resilience-objectives/:flowKey`

Creator-only and ownership-checked:

- `PATCH /api/creator/automation/runs/:runId/control`
- `PATCH /api/creator/orchestration/workflows/:runId/control`

Creator control endpoints change only visibility, snooze, feedback, or help-request state. They cannot approve transitions or dependencies.

## Operating surfaces

Admin Analytics now includes:

- the exact thirty-package ledger
- automation state, rollout, evidence, override, incident, support, and guardrail summaries
- workflow definition and run state, dependency, approval, stale, override, pause, and rollback summaries
- all fifteen critical-flow objectives and recovery order
- conservative readiness blockers and Akuso authority boundaries
- the same payload in the Admin Analytics JSON export

The creator dashboard now includes:

- the creator's own automation explanations and source labels
- current workflow state, waiting party, blocking dependency copy, next step, owner, and support path
- dismiss, snooze, hide, and request-help controls
- explicit privacy and authority boundaries

## Akuso controls

New grounded writing profiles:

- automation fired explanation
- automation pause or rollback summary
- workflow state explanation
- workflow blocker summary
- approval packet draft
- orchestration incident handoff
- resilience objective explanation

New release scenarios cover source context, public-copy review, workflow state accuracy, failed dependencies, prohibited transitions, private fan data, partner boundaries, finance and payout caveats, and resilience incident handoff. The backend remains the workflow authority.

## Evidence semantics

- zero stored pilot runs means outcomes are `not_observed`, not successful
- registry completion means controls exist, not that automation is active
- a configured workflow recipe means coordination is defined, not that the workflow reduced handoff time
- an approved recovery objective is a target, not proof that the target is currently met
- active or default graduation requires stored evidence and named review
- internal readiness recommendations never grant external publication, partner/API access, money movement, moderation action, or legal authority

## Verification

- backend authority/service/Akuso tests: 44 passed
- protected route tests: 2 passed
- affected frontend component and page tests: 6 passed
- changed backend syntax checks: passed

Repository-wide lint, build, audits, release gate, and regression results are recorded in the implementation handoff after completion.
