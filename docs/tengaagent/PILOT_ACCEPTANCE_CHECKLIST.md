# TengaAgent Pilot Acceptance Checklist

A pilot tenant is considered ready for controlled use only after the following checks pass.

## Product

- Workspace exists and belongs to the authenticated owner.
- At least one TengaAgent exists.
- The intended agent is explicitly published.
- Business profile and knowledge are reviewed.
- Human handoff can be claimed and resolved by an owner.
- Appointment request flow works for the tenant.

## Billing enforcement

- Subscription is `trialing` or `active`.
- Plan entitlements match the public pricing definition.
- Monthly conversation capacity is enforced before creating a new conversation.
- Existing conversations do not consume another conversation allowance.
- WhatsApp and voice features are blocked on plans without those entitlements.

## Web channel

- Core environment configuration is healthy.
- Public tenant route resolves only published agents.
- Tenant/session scoping prevents cross-tenant transcript access.
- AI fallback remains grounded in tenant knowledge.

## WhatsApp channel

- Meta webhook verification succeeds.
- Webhook signature validation succeeds and fails closed for invalid signatures.
- `phone_number_id` resolves server-side to exactly one tenant connection.
- Duplicate provider message IDs remain idempotent.
- Automatic replies are suppressed during human handoff.
- WhatsApp is enabled by the tenant plan.

## Voice notes

- Media host, size, MIME type and checksum validation pass.
- Audio transcription runs server-side.
- Transcript replaces the pending placeholder.
- Failed transcription requests human handoff rather than fabricating content.
- Voice-note feature is enabled by the tenant plan.

## Operations

- Owner readiness view shows web, WhatsApp and voice-note readiness independently.
- Readiness API exposes booleans/metadata only and never returns credentials.
- Pilot incidents can be reproduced from provider message IDs and tenant-scoped records.
- Production payment collection remains disabled until the later payment milestone.
