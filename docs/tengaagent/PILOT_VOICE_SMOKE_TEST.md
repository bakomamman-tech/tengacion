# TengaAgent Voice-Note Pilot Smoke Test

After WhatsApp text smoke tests pass and voice processing is enabled:

1. Send one short supported voice note from a controlled WhatsApp account.
2. Confirm one pending tenant-scoped voice-note message is created.
3. Confirm media metadata, MIME type, size and checksum validation pass.
4. Confirm transcription completes and replaces the pending placeholder.
5. Confirm the transcribed message queues at most one AI reply.
6. Confirm an intentionally failed media/transcription case requests human handoff instead of fabricating text.

Do not retain or expose provider credentials during testing.
