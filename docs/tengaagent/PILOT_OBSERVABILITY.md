# TengaAgent Pilot Observability

During pilots, observability should answer: which tenant, which channel, which conversation, which provider event, and which failure state — without recording secrets.

Recommended identifiers in structured logs and support notes:

- organization ID / slug;
- agent ID;
- conversation ID;
- channel (`web` or `whatsapp`);
- provider message ID for WhatsApp;
- reply/transcription status;
- request ID where available;
- billing error code when a plan/usage gate blocks an action.

Never log:

- access tokens;
- webhook app secrets;
- JWT secrets;
- calendar client secrets;
- OpenAI API keys;
- raw authorization headers.

Pilot readiness deliberately exposes only boolean environment status to owners.
