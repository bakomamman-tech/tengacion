# TengaAgent Pilot Go-Live Sequence

1. Keep all development on `feature/tengaagent-lead-capture-multitenant` until validation is green.
2. Complete code-level pilot readiness checks and owner readiness UI.
3. Add required Render environment variables directly in Render.
4. Configure provider-side callbacks/redirect URIs.
5. Create or verify tenant-bound WhatsApp connection records.
6. Run controlled web, WhatsApp, and voice-note smoke tests against the preview environment.
7. Keep subscription state manual/trialing for pilot tenants until Paystack/Stripe collection is connected.
8. Review logs, usage counters, handoff behavior, and appointment flow.
9. Only after pilot acceptance, proceed to production merge and launch hardening.

No production merge is implied by this document.
