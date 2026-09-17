# TengaAgent Pilot Data Safety

Controlled pilots must preserve tenant isolation and minimize sensitive data exposure.

- Never accept an organization ID from a WhatsApp customer payload as routing authority.
- Resolve provider phone-number identifiers through server-side tenant mappings.
- Keep API keys, webhook secrets, provider access tokens and encryption keys in server environment variables only.
- Readiness endpoints may return boolean configuration status but never credential values.
- Use provider message IDs for idempotency and incident investigation.
- Limit owner endpoints to the authenticated owner's workspace.
- Keep customer free-text prompts separate from credential collection; never ask customers for passwords, OTPs or payment-card secrets.
- Failed external-provider verification must fail closed rather than be interpreted as an empty/healthy state.
- Manual pilot subscription state can authorize service before payment-provider collection is connected, but usage and plan enforcement remain active.
