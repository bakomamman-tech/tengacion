# TengaAgent Pilot Incident Runbook

Use this during controlled pilots before production payment collection is enabled.

## If web chat stops responding

1. Check the owner Pilot Readiness panel.
2. Confirm subscription status remains trialing/active and the monthly conversation allowance is not exhausted.
3. Confirm core runtime environment readiness.
4. Confirm the agent remains published.
5. Review server logs using request IDs and tenant identifiers; never log secrets.

## If WhatsApp messages are not entering TengaAgent

1. Confirm Meta webhook verification and callback subscription.
2. Confirm `X-Hub-Signature-256` requests are accepted only when signatures validate.
3. Confirm the provider `phone_number_id` has an active tenant mapping.
4. Confirm the plan includes WhatsApp.
5. Use the Meta provider message ID to check for duplicate/idempotent handling.

## If WhatsApp inbound works but TengaAgent does not reply

1. Confirm `TENGAAGENT_WHATSAPP_AUTO_REPLY_ENABLED=true` for the pilot.
2. Confirm access token and Graph API version readiness.
3. Check whether human handoff owns the conversation; automatic AI replies must be suppressed while a human is active.
4. Inspect the tenant-scoped WhatsApp reply queue status.

## If voice notes fail

1. Confirm the tenant plan includes voice notes.
2. Confirm `TENGAAGENT_WHATSAPP_VOICE_ENABLED=true`.
3. Confirm the OpenAI server key is present.
4. Inspect transcription status/error metadata on the tenant-scoped message.
5. Failed transcription should request human handoff rather than invent a transcript.

## If limits appear incorrect

1. Compare the tenant plan to the canonical backend entitlement catalog.
2. Read the current monthly usage period.
3. Confirm a new conversation is charged once and an existing session is not charged again.
4. Do not manually bypass usage counters in production data; correct the source event or subscription state.
