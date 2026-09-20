# TengaAgent Pilot External Dependencies

External systems required only for the channels that use them:

- MongoDB: tenant/runtime persistence.
- OpenAI: AI responses and voice-note transcription.
- Meta WhatsApp Cloud API: WhatsApp transport.
- Google Calendar: optional busy-time integration.
- Microsoft Graph: optional Outlook busy-time integration.
- Render: preview/pilot runtime and server environment variables.

A missing optional channel integration must not make the web pilot falsely appear broken; readiness is reported per channel.
