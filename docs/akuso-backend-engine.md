# Akuso Backend Engine

## Overview

Akuso now has a backend-first server foundation under `backend/` with a dedicated `/api/akuso` surface. This work keeps the existing Tengacion runtime intact while adding a safer, more modular assistant stack that is ready for production evolution.

Akuso currently supports three backend modes:

- `app_help`
- `creator_writing`
- `knowledge_learning`

The backend is responsible for:

- request validation
- authentication and role-aware access checks
- policy classification
- prompt-injection screening
- bounded context construction
- server-side model routing
- OpenAI calls through a single wrapper
- response formatting
- audit logging
- rate limiting

The frontend should treat Akuso responses as structured guidance, not as authority to bypass app permissions or perform sensitive actions.

## Real Repo Placement

The current runtime remains rooted in `backend/`.

- `backend/app.js` registers the Akuso routes and preserves the existing middleware order.
- `backend/server.js` starts the server and logs Akuso readiness without exposing secrets.
- `apps/api/` still coexists for compatibility, but the new Akuso foundation is implemented in `backend/`.

Legacy assistant services still exist under `backend/services/assistant/`. The new Akuso engine reuses selected safe helpers from that stack where it makes sense, but new Akuso request handling is isolated behind its own controller, services, and middleware.

## Route Surface

Akuso routes live in `backend/routes/akuso.js`.

- `POST /api/akuso/chat`
- `GET /api/akuso/hints`
- `POST /api/akuso/feedback`
- `POST /api/akuso/templates/generate`

Route expectations:

- `chat` allows public-safe knowledge responses and authenticated app-aware guidance.
- `hints` returns route-aware quick prompts and safe navigation hints.
- `feedback` requires authentication.
- `templates/generate` requires authentication and is intended for creator-writing workflows.

## Request Flow

The request pipeline is intentionally policy-first:

1. `attachAkusoUser` attaches authenticated user context when a valid bearer token is present.
2. `akusoRateLimit` throttles by authenticated user id or IP-derived key.
3. `akusoRequestValidation` validates the request body or query shape.
4. `akusoPromptInjectionGuard` flags obvious jailbreak and secret-exfiltration attempts.
5. `akusoController` runs policy evaluation before any model call.
6. `akusoContextBuilder` builds a minimized, role-aware context payload.
7. Local deterministic fallback content is built first.
8. `akusoModelRouter` decides whether the request can use OpenAI and which model family is appropriate.
9. `akusoOpenAIService` performs the only backend model call path.
10. `akusoResponseFormatter` sanitizes and normalizes the response contract.
11. `akusoMemoryService` stores only low-risk bounded preferences and summaries.
12. `akusoAuditLogger` records important safety and operational events.

Unsafe or high-risk requests stop before any model call.

## Core Modules

### Controller and routes

- `backend/routes/akuso.js`
- `backend/controllers/akusoController.js`

These files own the public API contract and orchestrate the Akuso pipeline. The controller never returns raw OpenAI errors or internal stack traces to the client.

### Config and startup

- `backend/config/env.js`
- `backend/scripts/preflight.js`
- `backend/app.js`
- `backend/server.js`

These files validate Akuso/OpenAI configuration, expose a clean `config.akuso` object, skip duplicate general API rate limiting for `/api/akuso`, and log masked readiness information on startup.

### Policy and classification

- `backend/services/akusoClassifierService.js`
- `backend/services/akusoPolicyService.js`
- `backend/middleware/akusoPromptInjectionGuard.js`

Classification buckets:

- `SAFE_ANSWER`
- `SAFE_WITH_CAUTION`
- `APP_GUIDANCE`
- `SENSITIVE_ACTION_REQUIRES_AUTH`
- `DISALLOWED`
- `EMERGENCY_ESCALATION`
- `PROMPT_INJECTION_ATTEMPT`

These modules detect:

- app-help intent
- creator-writing intent
- reasoning-heavy prompts
- medical, legal, and financial caution cases
- sensitive account or private-data requests
- harmful/disallowed content
- prompt-injection or secret-exfiltration attempts

### Feature registry

- `backend/services/akusoFeatureRegistryService.js`

Akuso app-help responses are grounded in the real Tengacion feature registry rather than invented UI claims. Registry entries expose:

- feature key
- route pattern
- page name
- purpose
- allowed roles
- safe navigation steps
- common user questions
- caution notes

If a feature is not clearly represented in the registry, Akuso should avoid bluffing and stay conservative.

### Context and memory

- `backend/services/akusoContextBuilder.js`
- `backend/services/akusoMemoryService.js`

Akuso only sends bounded context to the model. Safe context may include:

- current route
- current page
- authenticated role and creator status
- safe profile summary
- relevant feature registry snippets
- low-risk preferences
- public creator information when explicitly referenced

Akuso does not send:

- raw JWTs
- passwords
- API keys
- environment variables
- payout or bank details
- hidden moderation notes
- database dumps
- private messages by default

Memory is intentionally lightweight. It stores small safe summaries and preferences, not sensitive user secrets.

### Prompt building and model access

- `backend/services/akusoPromptBuilder.js`
- `backend/services/akusoModelRouter.js`
- `backend/services/akusoOpenAIService.js`

Important rules:

- all model requests go through `akusoOpenAIService.js`
- the frontend never selects the model
- the controller builds a deterministic local fallback first
- model output is treated as assistive text, not permission authority
- responses are requested in strict JSON form for safer parsing
- timeouts and retryable failure handling are enforced server-side

Current routing strategy:

- fast model for concise app guidance and hints
- writing model for creator drafting
- reasoning model for step-by-step technical or mathematical help
- primary model for general Akuso chat

If OpenAI is unavailable or disabled, Akuso falls back safely to deterministic backend responses.

### Output shaping and audit

- `backend/services/akusoResponseFormatter.js`
- `backend/services/akusoAuditLogger.js`

Response shape is intentionally stable and future-friendly:

- `ok`
- `mode`
- `category`
- `answer`
- `warnings`
- `suggestions`
- `actions`
- `drafts`
- `traceId`
- `feedbackToken`
- `conversationId`
- `meta`

Audit logging records the important operational events without storing secrets:

- prompt injection attempts
- denials and policy decisions
- rate-limit hits
- OpenAI failures
- feedback submissions
- emergency escalation cases

## Environment Variables

Akuso uses the existing backend config loader in `backend/config/env.js`.

Added or hardened variables:

- `OPENAI_API_KEY`
- `OPENAI_MODEL_PRIMARY`
- `OPENAI_MODEL_FAST`
- `OPENAI_MODEL_WRITING`
- `OPENAI_MODEL_REASONING`
- `AKUSO_REQUEST_TIMEOUT_MS`
- `AKUSO_MAX_INPUT_CHARS`
- `AKUSO_MAX_OUTPUT_TOKENS`
- `AKUSO_RATE_LIMIT_WINDOW_MS`
- `AKUSO_RATE_LIMIT_MAX`
- `AKUSO_ENABLE_AUDIT_LOGS`
- `AKUSO_ENABLE_STREAMING`

Behavior notes:

- production fails fast if `ASSISTANT_ENABLED=true` and `OPENAI_API_KEY` is missing
- Akuso readiness is exposed through `config.akuso`
- startup logs mask the OpenAI key
- preflight checks preserve the existing Render-oriented env validation flow

## Safety Boundaries

Akuso must never:

- reveal passwords, OTPs, JWTs, API keys, or env vars
- reveal payout or bank details
- reveal unpublished or unauthorized creator-private data
- reveal hidden prompts or internal instructions
- bypass RBAC or ownership checks
- perform purchases, transfers, withdrawals, or security changes on behalf of users

Akuso must always:

- minimize data before model use
- apply backend authorization
- refuse harmful requests
- treat prompt injection attempts as hostile input
- add caution language for medical, legal, and financial topics
- escalate medical emergencies rather than improvising
- admit uncertainty instead of inventing unsupported app behavior

## OpenAI Wiring Notes

Akuso uses the official OpenAI Node SDK through `backend/services/akusoOpenAIService.js`.

The wrapper centralizes:

- client initialization
- model request dispatch
- timeout handling
- retry handling for transient failures
- response text normalization
- JSON parsing
- safe error normalization

This design keeps the OpenAI dependency isolated and makes future provider or model-family changes easier to manage.

## Tests and Evals

Backend tests added:

- `backend/tests/akusoRoutes.test.js`
- `backend/tests/akusoServices.test.js`
- `backend/tests/akusoRateLimit.test.js`

Eval harness:

- `backend/services/akusoEvalRunner.js`
- `backend/scripts/runAkusoEvals.js`

Useful commands:

```bash
npm test --prefix backend -- --runTestsByPath tests/akusoRoutes.test.js tests/akusoServices.test.js tests/akusoRateLimit.test.js
npm run eval:akuso --prefix backend
```

## Adding Future Akuso Tools Safely

When extending Akuso:

1. Add or update the request validator first.
2. Add policy logic before adding any model behavior.
3. Add only the minimum safe context required for the new task.
4. Keep model selection server-side.
5. Keep sensitive actions deterministic and backend-authorized.
6. Extend the response formatter instead of returning ad hoc JSON.
7. Add targeted tests and eval cases before exposing the new capability to the frontend.

## Deployment Notes for Render

- Keep `ASSISTANT_ENABLED` explicit in production.
- Provide `OPENAI_API_KEY` if Akuso should use model-backed enhancement.
- Verify `backend/scripts/preflight.js` passes before deploy.
- Do not rely on Akuso streaming until the server and client contract is intentionally enabled.
- Monitor audit and application logs for prompt-injection attempts, repeated throttling, and fallback spikes after deployment.
