# TengaAgent Pilot Rollback

If a pilot channel behaves unexpectedly, disable the narrowest affected capability first rather than weakening validation.

- Web pilot: pause the tenant agent if the public experience must be stopped.
- WhatsApp AI replies: set `TENGAAGENT_WHATSAPP_AUTO_REPLY_ENABLED=false`.
- Voice notes: set `TENGAAGENT_WHATSAPP_VOICE_ENABLED=false`.
- Tenant WhatsApp routing: disable the tenant's `WhatsAppConnection` rather than accepting unscoped routing.
- Calendar provider: disconnect the affected provider or leave it in fail-closed error state; do not treat provider failure as free availability.
- Subscription issue: set the subscription to a non-serving state when service must be stopped; do not bypass usage enforcement.

Rollback actions should preserve stored audit/usage records for investigation.
