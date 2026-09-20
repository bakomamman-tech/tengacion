# TengaAgent Pilot Configuration Stages

Stage 1 — code-only readiness: models, services, routes, UI, tests and documentation can be completed without real provider secrets.

Stage 2 — Render configuration: core runtime and selected channel variables are entered in the preview/pilot service.

Stage 3 — provider configuration: Meta webhook/callback and optional calendar OAuth application settings are pointed at the preview/pilot URL.

Stage 4 — smoke test: controlled real web/WhatsApp/voice traffic validates the configured integrations.

The user should be prompted for Stage 2 only after Stage 1 has a green exact-head CI checkpoint.
