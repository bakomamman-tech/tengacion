# TengaAgent Pilot Test Matrix

Automated validation for the pilot milestone covers:

- environment-status responses contain booleans instead of secret values;
- web readiness can succeed while optional WhatsApp configuration is absent;
- WhatsApp readiness requires both server provider configuration and a tenant connection;
- voice readiness requires explicit voice enablement plus transcription capability;
- Google and Microsoft readiness are independent;
- readiness queries remain tenant-isolated;
- owner readiness route requires authentication;
- owner readiness response is scoped to the authenticated workspace;
- billing plan/usage enforcement remains covered by the TengaAgent billing suites;
- WhatsApp signature, idempotency, tenant routing, outbound reply and voice-note suites remain part of the full TengaAgent CI gate.
