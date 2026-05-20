# Tengacion Production Reliability Runbooks

These runbooks support the Admin Analytics production reliability snapshot. Each incident note should identify the affected surface, owner, current status, next action, and the relevant admin page.

## Checkout Failure

Owner: Infrastructure and backend

First checks:

- Open `/admin/transactions` and filter recent failed or pending purchases.
- Confirm Paystack and Stripe credentials, callback URLs, and frontend return URLs are configured.
- Compare `purchase_checkout_failed` events against provider dashboard errors.
- Check for stale initiated or pending purchases older than the cleanup window.

Resolution path:

- Fix configuration or provider errors first.
- Retry only idempotent verification steps.
- Reconcile any paid purchase that did not unlock access.
- Leave an admin note with the provider reference, impact window, and next review time.

## Paystack Verification Delay

Owner: Infrastructure and backend

First checks:

- Review Paystack verification events in `/admin/transactions`.
- Compare pending provider references against Paystack's transaction view.
- Check whether callbacks are delayed or verification requests are failing.
- Identify purchases that are paid at Paystack but still pending in Tengacion.

Resolution path:

- Re-run safe verification for pending references.
- Mark failed records only when provider status is terminal.
- Trigger entitlement reconciliation for verified paid purchases.
- Document the affected references and creator/user impact.

## Stripe Webhook Processing

Owner: Infrastructure and backend

First checks:

- Review failed Stripe webhook records and duplicate counts.
- Confirm webhook signing secret and subscribed checkout event types.
- Compare processed, skipped, and failed webhook counts in Admin Analytics.
- Check whether affected purchases already settled through fallback verification.

Resolution path:

- Fix signature or event configuration before replaying.
- Replay provider events from Stripe only after idempotency checks are confirmed.
- Reconcile paid purchases and entitlement grants after replay.
- Note the replay window and any skipped duplicate events.

## Entitlement Mismatch

Owner: Infrastructure and backend

First checks:

- Open `/admin/transactions?attention=stuck`.
- Compare paid purchases against entitlement records for tracks, books, albums, and videos.
- Check purchase audit events for `purchase_entitlement_granted`.
- Confirm item ownership and item type are valid.

Resolution path:

- Run the entitlement reconciliation job.
- Verify the user's library or stream/download access after reconciliation.
- Add an admin audit note for any manual correction.
- Escalate if the same item type repeatedly misses entitlement creation.

## Payout Blocker

Owner: Finance and operations

First checks:

- Open `/admin/marketplace` and review failed, pending, and queued payouts.
- Confirm creator payout readiness, bank details, and verification state.
- Check whether a payout is older than the seven-day stuck threshold.
- Review creator-visible support messages before changing state.

Resolution path:

- Resolve creator-action blockers first.
- Retry failed payout attempts only through the approved payout path.
- Do not duplicate ledger movement or create a second payout for the same earning.
- Record admin notes with reviewer, reason, and next expected action.

## Media Upload Failure

Owner: Backend and infrastructure

First checks:

- Open `/admin/content` and inspect recent upload errors.
- Check storage provider health, upload size/type validation, and transformation logs.
- Identify creators with repeated failed uploads.
- Verify whether failures are isolated to audio, video, image, or document uploads.

Resolution path:

- Fix provider or validator issues before asking creators to retry.
- Preserve failed upload metadata for support follow-up.
- Add a creator support note when repeated failures block publishing.
- Confirm a test upload succeeds before closing the incident.

## Live Creation Failure

Owner: Backend and infrastructure

First checks:

- Confirm LiveKit host, API key, and API secret are configured.
- Review `live_session_create_failed` and `live_token_failed` events.
- Check quota edge cases and active session conflicts.
- Verify join token issuance for host and viewer flows.

Resolution path:

- Fix LiveKit configuration before testing user flows.
- Confirm a host can create a session and a viewer can request a token.
- Watch `live_joined` events after the fix.
- Leave an incident note with the affected room names if any sessions were partially created.

## Discovery Fallback Spike

Owner: Discovery and analytics

First checks:

- Review recommendation logs by surface: home, live, creators, and creator hub.
- Compare `empty`, `cold_start`, and `personalized` fallback modes.
- Check candidate loaders, blocked/muted/restricted filters, and ranking eligibility.
- Confirm fallback behavior still returns deterministic safe content.

Resolution path:

- Fix empty candidate sources before tuning ranking weights.
- Verify surface-level candidate counts and ranked counts recover.
- Keep cold-start featured collections enabled where appropriate.
- Add diagnostics to the weekly recommendation review.

## Akuso Eval Regression

Owner: AI and safety

First checks:

- Open `/admin/assistant/metrics`.
- Run the Akuso eval suite and attach the latest report.
- Check local fallback rate, OpenAI failures, route target pass rates, and negative feedback.
- Review unresolved critical assistant review items.

Resolution path:

- Revert or revise the prompt, registry, route hint, or memory change that regressed.
- Add failing examples to eval candidates before closing the issue.
- Keep sensitive payment, payout, account, and moderation actions backend-authorized.
- Do not ship assistant updates while critical route targets are failing.
