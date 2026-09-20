# TengaAgent Pilot Exit Criteria

Move from controlled pilot work into launch hardening only when:

- CI is green at the final pilot-readiness commit.
- Web pilot readiness is green for the intended tenant.
- WhatsApp/voice readiness is green for pilot tenants that use those channels.
- Cross-tenant routing/isolation tests pass.
- Conversation and agent limits are enforced at runtime.
- Owner readiness does not expose credential values.
- Human handoff suppresses AI replies correctly.
- Voice-note failures fail safe to handoff.
- At least one controlled end-to-end pilot smoke test is completed per enabled channel.
- External credentials have been added to the preview/pilot Render service.
- No merge into `main` occurs until the user explicitly approves production deployment.

Payment collection remains a distinct subsequent milestone.
