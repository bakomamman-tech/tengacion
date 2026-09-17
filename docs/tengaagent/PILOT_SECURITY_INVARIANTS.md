# TengaAgent Pilot Security Invariants

These requirements must remain true throughout pilot work:

1. Customer input never selects an organization or agent directly for privileged routing.
2. WhatsApp tenant routing derives from a server-owned provider connection mapping.
3. Public web transcripts remain scoped to organization, agent and visitor session.
4. Owner operations require authentication and resolve the workspace server-side.
5. Provider webhook signatures fail closed.
6. Duplicate provider messages are idempotent.
7. Automatic AI replies are suppressed when human handoff owns a conversation.
8. Missing calendar/provider verification never becomes a false "available" result.
9. Subscription/usage checks fail closed for non-serving states and exhausted limits.
10. Readiness checks never expose secret values.
