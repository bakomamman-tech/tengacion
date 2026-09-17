# TengaAgent Pilot Runtime Flags

Safe channel activation flags:

- `TENGAAGENT_WHATSAPP_AUTO_REPLY_ENABLED=false` keeps automatic WhatsApp AI replies disabled.
- `TENGAAGENT_WHATSAPP_AUTO_REPLY_ENABLED=true` enables the existing guarded reply worker after provider configuration and plan checks are satisfied.
- `TENGAAGENT_WHATSAPP_VOICE_ENABLED=false` keeps voice-note processing disabled.
- `TENGAAGENT_WHATSAPP_VOICE_ENABLED=true` enables voice-note ingestion/transcription only where plan/provider requirements also pass.

Feature flags do not bypass billing entitlements or tenant routing.
