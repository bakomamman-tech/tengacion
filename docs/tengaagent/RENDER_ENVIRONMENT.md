# TengaAgent Render Environment Variables

This checklist is for the point where the feature branch is ready for a real pilot deployment. Secret values must be added directly in Render and must not be committed to Git.

## Core runtime

Required for a working full-stack TengaAgent deployment:

- `MONGO_URI`
- `JWT_SECRET`
- `JWT_REFRESH_SECRET`
- `AUTH_CHALLENGE_SECRET`
- `OPENAI_API_KEY`

## WhatsApp Cloud API

Required before enabling a real WhatsApp pilot:

- `TENGAAGENT_WHATSAPP_VERIFY_TOKEN`
- `TENGAAGENT_WHATSAPP_APP_SECRET`
- `TENGAAGENT_WHATSAPP_ACCESS_TOKEN`
- `TENGAAGENT_WHATSAPP_GRAPH_VERSION`
- `TENGAAGENT_WHATSAPP_AUTO_REPLY_ENABLED=true` when outbound automatic replies are approved for the pilot

For voice-note transcription also add:

- `TENGAAGENT_WHATSAPP_VOICE_ENABLED=true`
- optional `TENGAAGENT_WHATSAPP_TRANSCRIPTION_MODEL` if overriding the server default

`OPENAI_API_KEY` is also required for voice-note transcription.

## Calendar integrations

Shared credential-encryption key:

- `TENGAAGENT_CALENDAR_ENCRYPTION_KEY`

Google Calendar:

- `GOOGLE_CALENDAR_CLIENT_ID`
- `GOOGLE_CALENDAR_CLIENT_SECRET`
- optional `GOOGLE_CALENDAR_REDIRECT_URI`
- optional `TENGAAGENT_CALENDAR_CALLBACK_BASE_URL`

Microsoft Outlook / Graph:

- `MICROSOFT_CALENDAR_CLIENT_ID`
- `MICROSOFT_CALENDAR_CLIENT_SECRET`
- optional `MICROSOFT_CALENDAR_TENANT`
- optional `MICROSOFT_CALENDAR_REDIRECT_URI`
- optional `TENGAAGENT_CALENDAR_CALLBACK_BASE_URL`

## Do not add yet

Payment-provider subscription variables are intentionally excluded until the later Paystack/Stripe collection milestone. The billing entitlement and usage-enforcement layer does not need payment-provider secrets to run manual pilots.
