# Tengacion Account Safety Controls

Status: implemented under `SAFETY-001`.

## Authority

The authenticated User API is authoritative for block, mute, restrict, and story-visibility lists. The canonical block field is `User.blocks`. The older `blockedUsers` field is a read-only compatibility source until startup maintenance or the user's next safety-list review moves those identifiers into `blocks`.

`GET /api/users/me/safety-lists` returns only the current user's lists, populated with the minimum profile fields needed to recognize an account: user ID, name, username, and avatar. It is non-cacheable and never reveals accounts that have blocked the current user.

## Block behavior

`PUT /api/users/me/block/:userId` is idempotent. A confirmed block:

- adds the target to the blocker's canonical list;
- removes friendship, pending friend requests, close-friend membership, follows, and follower links in both directions;
- removes both accounts from mutual people search, directory, friend suggestions, profile access, authenticated post feeds, creator-follow actions, and direct-message contacts;
- rejects new friend requests and direct messages in either direction; and
- records a minimal audit event without message or profile content.

`PUT /api/users/me/unblock/:userId` removes both canonical and legacy block entries. It never restores removed friendships, follows, requests, or close-friend membership.

Direct-message authorization is enforced in the shared persistence service, so REST, compatibility, follower-share, and Socket.IO message paths cannot bypass a block. Trusted administrators may send support follow-ups through the existing admin exception when a recipient has disabled ordinary messages, but a user block still applies. Trusted moderation notices use an explicit internal bypass and remain auditable platform communications.

## User experience and Akuso boundary

Privacy Settings searches by name or username instead of requiring an internal user ID. It discloses relationship removal before confirmation, shows server-confirmed limited-account lists, and exposes reversible list actions. Success is shown only after the server confirms the write and the lists reload.

Akuso can open Privacy Settings and explain where blocked accounts are managed. Blocking, unblocking, muting, and restricting are sensitive user decisions: Akuso cannot perform them on a user's behalf.

## Verification

- `backend/tests/userSafetyControls.test.js`
- `backend/tests/akusoServices.test.js`
- `frontend/src/pages/__tests__/SettingsJourneys.test.jsx`
- `frontend/src/pages/__tests__/PrivacySettingsDataExport.test.jsx`
- route-truth, action-truth, and encoding audits
