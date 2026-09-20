# TengaAgent WhatsApp Pilot Smoke Test

After provider configuration:

1. Send one text message from a controlled external WhatsApp account.
2. Confirm exactly one tenant-scoped customer message is stored.
3. Confirm one AI reply is queued/delivered when auto replies are enabled.
4. Re-deliver the same provider message event and confirm no duplicate customer message/reply is created.
5. Claim human handoff and send another customer message; confirm AI reply is suppressed.
6. Release/resolve according to the owner workflow before restoring AI operation.

Use provider message IDs for verification. Do not log access tokens.
