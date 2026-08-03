# Tengacion Action Truth Inventory

Last updated: 3 August 2026

This is the evidence record for Phase 0 package `ACTION-001`. It covers native buttons and links in production frontend source, including legacy surfaces that are not currently routed, so an old mock cannot silently return as a clickable promise.

## Enforced contract

Every native button or link must satisfy at least one of these conditions:

- execute an explicit action;
- submit a real form;
- navigate through a real `href` or application route; or
- be visibly disabled when its supporting workflow does not exist.

Inline click handlers that only announce "coming soon", "coming next", or equivalent unavailable behavior fail the audit. Dynamic links and externally targeted links remain valid because their destinations are supplied at runtime.

The executable check is `npm run audit:actions --prefix frontend`, implemented in `frontend/scripts/auditInertControls.cjs`. It scans all non-test JavaScript and JSX files under `frontend/src` and exits unsuccessfully when it finds a violation.

## Resolution record

The initial corrected scan identified 42 inert controls and three placeholder click handlers: 45 action-truth violations in total.

| Resolution | Count | Surfaces |
|---|---:|---|
| Connected to an existing production destination | 17 | Legacy creator dashboard navigation, Home composer, creator analytics handoff, notifications, payouts, settings and support |
| Converted from a fake control into status text | 2 | Post audience label and legacy creator location |
| Visibly disabled because no workflow exists | 26 | Group invitations, membership changes, post actions, group tools, Messenger calls, creator search/library/options, legacy samples and unfinished editor actions |
| Remaining audit violations | 0 | Verified by the executable action audit |

## Intentionally unavailable after ACTION-001

ACTION-001 does not invent backend workflows. The following remain explicitly unavailable and must be delivered by their later product packages before they can become clickable:

- group invitations, membership changes, group settings, group search and group post reactions/comments/options;
- Messenger voice and video calling;
- creator-hub search/library shortcuts and song overflow actions;
- mentions in the legacy rich-post editor;
- interaction controls in unrouted legacy sample components.

The supported alternative for creator account, payout, support and publishing actions is linked directly to the current creator workspace or Home composer.
