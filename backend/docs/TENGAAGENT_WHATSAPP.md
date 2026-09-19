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

Webhook processing never waits for AI generation or the Meta send request. A verified inbound message is persisted, one durable `TengaAgentWhatsAppReply` row is queued, and the webhook returns. A worker claims queued rows, generates the reply through the existing tenant-scoped TengaAgent runtime, and then sends the response.

## Voice notes

Voice-note ingestion is a separate opt-in switch and remains disabled unless explicitly enabled:

```text
TENGAAGENT_WHATSAPP_VOICE_ENABLED=true
TENGAAGENT_WHATSAPP_TRANSCRIPTION_MODEL=gpt-transcribe
OPENAI_API_KEY=
```

`TENGAAGENT_WHATSAPP_TRANSCRIPTION_MODEL` is optional; the current default is `gpt-transcribe`. The OpenAI key is the existing backend-only credential and must never be sent to the browser or stored in a WhatsApp message record.

The voice-note flow is:

1. Meta delivers an `audio` webhook containing only the provider media id.
2. TengaAgent resolves the tenant from the webhook `phone_number_id` and persists a pending voice-note message exactly once.
3. A background worker retrieves the short-lived media URL from Meta using the server-side access token and the same known `phone_number_id`.
4. The worker accepts only HTTPS media URLs on approved Meta/WhatsApp host suffixes and refuses redirects.
5. The download is bearer-authenticated, memory-only, bounded to 16 MiB, MIME-checked, size-checked and SHA-256 checked when Meta supplies a checksum.
6. The validated audio bytes are sent server-side to OpenAI's audio transcription endpoint.
7. Only the transcript and safe media/transcription metadata are stored. TengaAgent does not intentionally persist the audio bytes to disk or object storage.
8. When transcription succeeds, the transcript becomes the customer message content and the normal idempotent outbound text-reply queue may run if automatic replies are enabled.
9. If transcription fails, the message records a safe failure state and the conversation moves to `handoff_requested` instead of pretending that the AI understood the recording.

The voice worker atomically claims pending messages. A stale `processing` claim can be recovered after a bounded interval, while the separate outbound reply ledger still prevents duplicate customer replies.

## Safety and idempotency

- Inbound messages are unique by organization, provider, and Meta message id.
- A `TengaAgentWhatsAppReply` record is uniquely tied to one inbound TengaAgent message before an outbound provider call is attempted.
- Duplicate webhook delivery therefore cannot send a second AI reply for the same inbound message.
- If a conversation is currently `human_active`, automatic AI replies are suppressed.
- Lead/contact and appointment intents do not pretend that a web form exists in WhatsApp. They move the conversation to `handoff_requested` and tell the customer that a team member can continue in WhatsApp.
- Provider failures are recorded without writing a false successful agent message to the conversation transcript.
- Automatic provider retry is intentionally conservative: an uncertain outbound attempt is not blindly replayed, because avoiding duplicate customer messages is safer than at-least-once delivery without provider idempotency support.
- WhatsApp media URLs are never accepted from the customer as arbitrary URLs. They are obtained from Meta by provider media id and validated before download.
- Raw audio is processed in memory and is not intentionally retained after transcription.

## Current scope

The current WhatsApp slice supports inbound text, outbound AI text replies, and inbound voice-note transcription that feeds the existing TengaAgent text runtime. TengaAgent currently answers voice notes with text; generated outbound voice/audio replies are not part of this milestone.
