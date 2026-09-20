# TengaAgent Pilot Readiness

This document defines the pre-payment pilot gate for TengaAgent. It is intentionally separate from production payment activation.

## Pilot gate

A tenant is web-pilot ready only when:

- the workspace exists;
- at least one TengaAgent is published;
- the tenant subscription state allows service;
- core server configuration is present;
- monthly usage remains inside the plan allowance.

WhatsApp and voice-note channels have additional fail-closed requirements. Missing external credentials must never be interpreted as a healthy integration.

## Canonical plan entitlements

The billing service is authoritative for enforcement. The public pricing UI and backend enforcement must stay aligned:

- Solo: 1 agent, 100 monthly conversations, web only.
- Starter: 1 agent, 300 monthly conversations, web only.
- Growth: up to 3 agents, 1,500 monthly conversations, WhatsApp and voice notes.
- Business: up to 10 agents, 5,000 monthly conversations, WhatsApp and voice notes.
- Enterprise/Internal: configured as unlimited in the current foundation.

## Environment readiness

The owner readiness API returns booleans only. It never returns secret values.

Core runtime checks:

- `MONGO_URI`
- `JWT_SECRET`
- `JWT_REFRESH_SECRET`
- `AUTH_CHALLENGE_SECRET`
- `OPENAI_API_KEY`

WhatsApp checks:

- `TENGAAGENT_WHATSAPP_VERIFY_TOKEN`
- `TENGAAGENT_WHATSAPP_APP_SECRET`
- `TENGAAGENT_WHATSAPP_ACCESS_TOKEN`
- `TENGAAGENT_WHATSAPP_GRAPH_VERSION`
- optional activation switch `TENGAAGENT_WHATSAPP_AUTO_REPLY_ENABLED=true`
- optional voice switch `TENGAAGENT_WHATSAPP_VOICE_ENABLED=true`

Calendar checks:

- `TENGAAGENT_CALENDAR_ENCRYPTION_KEY`
- `GOOGLE_CALENDAR_CLIENT_ID`
- `GOOGLE_CALENDAR_CLIENT_SECRET`
- `MICROSOFT_CALENDAR_CLIENT_ID`
- `MICROSOFT_CALENDAR_CLIENT_SECRET`

Provider-specific redirect/callback variables remain optional when the existing defaults are appropriate.

## External configuration still required before a real WhatsApp pilot

Code readiness alone is insufficient. A real WhatsApp pilot additionally requires:

1. A Meta app with WhatsApp Cloud API enabled.
2. A WhatsApp Business Account / phone number.
3. The Render webhook URL registered with Meta.
4. The same verification token configured in Meta and Render.
5. Meta app secret and a durable server-side access token in Render.
6. A tenant-bound `WhatsAppConnection` containing the provider `phone_number_id` mapped to the correct organization and agent.

Voice notes additionally require the OpenAI server key and explicit voice enablement.

## Payment boundary

Paystack/Stripe collection is deliberately not part of this pilot-readiness milestone. Subscription enforcement and usage accounting already exist so payment webhooks can later update subscription state without changing the runtime authorization model.
