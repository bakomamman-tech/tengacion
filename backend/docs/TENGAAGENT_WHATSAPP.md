# TengaAgent WhatsApp Cloud API

This integration is intentionally server-side and tenant-routed. TengaAgent never accepts an organization id from a WhatsApp customer payload. The active tenant and agent are resolved from the Meta `phone_number_id` stored in `TengaAgentWhatsAppConnection`.

## Webhook endpoint

Configure the Meta WhatsApp webhook callback to:

`/api/tengaagent/whatsapp/webhook`

GET verification uses the server-only verification token. POST deliveries are accepted only after `X-Hub-Signature-256` HMAC verification against the Meta app secret.

## Required server environment variables

```text
TENGAAGENT_WHATSAPP_VERIFY_TOKEN=
TENGAAGENT_WHATSAPP_APP_SECRET=
```

These values are backend-only secrets and must never be exposed through `VITE_` variables or committed with real values.

## Outbound AI replies

Outbound replies are disabled by default. To enable them deliberately, configure:

```text
TENGAAGENT_WHATSAPP_AUTO_REPLY_ENABLED=true
TENGAAGENT_WHATSAPP_ACCESS_TOKEN=
TENGAAGENT_WHATSAPP_GRAPH_VERSION=
```

`TENGAAGENT_WHATSAPP_ACCESS_TOKEN` is a server-side Meta access token with permission to send for the connected WhatsApp Business phone numbers. `TENGAAGENT_WHATSAPP_GRAPH_VERSION` must be an explicit value such as `v23.0`; keeping the version in deployment configuration avoids silently pinning the application to a stale Graph API version.

The outbound service sends text replies through Meta's `/{Phone-Number-ID}/messages` endpoint using `messaging_product: "whatsapp"` and persists the returned WhatsApp message id for correlation.

## Safety and idempotency

- Inbound messages are unique by organization, provider, and Meta message id.
- A `TengaAgentWhatsAppReply` record is uniquely tied to one inbound TengaAgent message before an outbound provider call is attempted.
- Duplicate webhook delivery therefore cannot send a second AI reply for the same inbound message.
- If a conversation is currently `human_active`, automatic AI replies are suppressed.
- Lead/contact and appointment intents do not pretend that a web form exists in WhatsApp. They move the conversation to `handoff_requested` and tell the customer that a team member can continue in WhatsApp.
- Provider failures are recorded without writing a false successful agent message to the conversation transcript.
- Automatic provider retry is intentionally conservative: an uncertain outbound attempt is not blindly replayed, because avoiding duplicate customer messages is safer than at-least-once delivery without provider idempotency support.

## Current scope

The first transport slice supports inbound and outbound text only. Media and voice-note ingestion are a separate milestone so media download, MIME validation, transcription, retention, and tenant isolation can be tested independently.
