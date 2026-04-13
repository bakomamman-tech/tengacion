# Akuso Upgrade Notes

## What Changed

Akuso has been upgraded from a mostly local deterministic assistant into a safer production-ready assistant stack with:

- grounded trust metadata on every response
- a guarded model enhancement layer for richer knowledge and writing replies
- a private admin review queue for bad or unsafe assistant outputs
- richer creator writing templates across music, books, podcasts, promos, launches, and audience engagement
- stronger feature coverage for purchases and broader page-surface context
- an assistant eval runner for safety, grounding, math, and creator support checks

## Architecture

### 1. Policy-first execution

`backend/services/assistant/assistantService.js` still keeps policy and permissions first:

- classify request
- throttle abuse
- retrieve only safe context
- build deterministic fallback response
- optionally improve wording with the guarded model layer
- attach trust and source metadata
- store bounded memory
- log sensitive events

Unsafe, emergency, or sensitive-action requests stay deterministic and do not rely on model output.

### 2. Guarded model layer

`backend/services/assistant/modelRouter.js` introduces an optional OpenAI-backed enhancement path.

Rules:

- only runs when `OPENAI_API_KEY` is configured
- skipped in tests
- never controls navigation or sensitive actions
- only revises safe fallback responses
- only uses trusted Tengacion facts for app claims
- returns strict JSON and falls back safely on any failure

### 3. Trust layer

Responses now include:

- `responseId`
- `sources[]`
- `trust`

This lets the frontend show whether a reply is:

- app-aware
- public-knowledge
- creator-writing
- locally generated or model-enhanced
- grounded or limited-context

### 4. Review queue

Negative assistant feedback now creates admin-reviewable queue items:

- model: `backend/models/AssistantReviewItem.js`
- service: `backend/services/assistant/reviewQueue.js`
- admin routes: `GET/PATCH /api/admin/assistant/reviews`

This supports a private operational loop for bad, incomplete, or unsafe replies.

### 5. Expanded creator support

`backend/services/assistant/writingProfiles.js` now supports:

- captions
- bios
- posts
- articles
- promos
- release copy
- podcast summaries
- podcast teasers
- book blurbs
- book launch copy
- music launch posts
- product descriptions
- event announcements
- fan engagement prompts
- artist intros
- talent competition descriptions

### 6. Grounded app guidance

`backend/services/assistant/featureRegistry.js` now covers purchases explicitly and the assistant schema now accepts a wider range of route surfaces used by the frontend.

## Operational Notes

- Sensitive flows remain server-checked. Akuso does not perform secure account, payout, or payment actions.
- Review queue access is protected behind admin auth plus `view_audit_logs`.
- Assistant abuse state is no longer cleared after suspicious prompts, which makes repeated exploit attempts throttle correctly.
- The frontend now shows trust chips and source chips so users can tell when an answer is grounded or cautious.

## Verification

Validated with:

- backend route tests
- admin review queue tests
- frontend dock interaction test
- `npm run eval:assistant`
