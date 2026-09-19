# TengaAgent Pilot Privacy Notes

Pilot operations should collect only information needed for the business workflow. TengaAgent must not request passwords, one-time codes, API credentials, private authorization tokens or payment-card secrets in customer conversation text.

Provider and application secrets belong in Render/provider consoles. Readiness reporting exposes presence/status only. Tenant conversation and contact records remain scoped to the tenant and existing authenticated/session boundaries.
