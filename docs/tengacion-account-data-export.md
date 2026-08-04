# Tengacion Account Data Export Contract

Status: implemented under `CONTROL-001`.

Authenticated users can request `POST /api/users/me/export` from Privacy Settings after confirming their current password. The response is non-cacheable JSON with a download filename, schema version, generation time, scope and completeness manifest, followed by the exported data.

## Included data

- Account profile, preferences, relationship lists, membership/progress data and security metadata.
- Creator profile and payout account details when a creator profile exists.
- Posts and stories authored by the account.
- Non-system messages sent by the account.
- Purchases made by the account.

Other people's post comments, reactions, story views/replies and incoming messages are not copied into the on-demand snapshot. Aggregate post counts and identifiers intentionally attached or addressed by the user may remain.

## Secret exclusions

The allowlisted export contract excludes:

- passwords, reset hashes, access tokens and refresh-token hashes;
- multi-factor secrets and trusted-device fingerprints;
- payment-provider recipient identifiers;
- internal payment accounting locks.

Every successful export writes an `account_data_exported` audit event. The audit record stores the schema version and completeness metadata, never the exported content.

## Bounded on-demand snapshot

Posts, stories, sent messages and purchases are each capped at 5,000 records per request. The service queries one additional record so the manifest can truthfully mark a section incomplete when the cap is reached. The UI tells the user to contact privacy support for a complete archive whenever any section is incomplete.

The endpoint requires both an authenticated session and current-password reauthentication, and is limited to three attempts per account per hour. Failed requests return a stable user-facing error and request ID without returning partial data.
