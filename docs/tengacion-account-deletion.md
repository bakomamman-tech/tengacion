# Tengacion Account Deletion Contract

Last reviewed: 9 August 2026

## User journey

`/account-deletion` is public so people who are signed out can read the deletion policy and reach support. An authenticated, non-administrative account can permanently delete itself by entering its current password and the exact confirmation phrase `DELETE`.

The destructive request is sent to `DELETE /api/users/me`. A wrong password is a failed reauthentication (`403`), not an invalid bearer session (`401`), so the user's otherwise valid session remains active and the page can show a recoverable error. The UI reports success and clears local authentication only after the server confirms completion.

Administrative and trust-and-safety accounts cannot use self-service deletion until their responsibilities are transferred.

## Deletion scope

The server:

- immediately disables and anonymizes the user account;
- increments the token version, removes trusted devices and active sessions, and disconnects live sockets;
- deletes authored posts, messages, stories, owned rooms, creator media and content, seller listings, assistant memory, saved activity and other account-owned personal activity;
- removes the user from other people's relationship and interaction lists;
- stops creator subscriptions from renewing; and
- deletes uploaded media through the configured storage provider.

Limited transaction, tax, fraud-prevention, dispute and safety records may be retained when required. Retained commerce records have delivery/contact details removed, while creator, seller and wallet identities are anonymized or archived. A bounded `account_deleted` audit event records only the completion and whether financial records were retained; it does not store deleted content.

All endpoint responses are marked `Cache-Control: no-store`.

## Akuso boundary

Akuso may explain the consequences and open `/account-deletion`. It classifies deletion as a sensitive action, does not call the model to perform it, and cannot supply the password, enter the confirmation phrase or submit the request for the user.

## Verification

- `backend/tests/accountDeletion.test.js`
- `frontend/src/pages/__tests__/AccountDeletion.test.jsx`
- the account-deletion case in `backend/tests/akusoServices.test.js`
