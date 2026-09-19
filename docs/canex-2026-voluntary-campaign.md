# CANEX Create-thon 2026 — voluntary Tengacion campaign

## Status / scope
The public home-feed banner is implemented in `frontend/src/components/CanexVotingBanner.jsx` and rendered in `frontend/src/pages/Home.jsx`. It is optional, dismissible for the browser session, opens the **official** URL on a separate page, sends no user details to the competition and expires at 23:59 East Africa Time on September 28, 2026 (20:59 UTC). Do not claim a link click is a verified vote.

**Email and in-app campaign delivery are intentionally NOT enabled.** The current User schema has no standalone recorded marketing-email opt-in; `notificationPrefs.system` is not campaign permission. Do not mass-message every account, export user emails or repurpose security/account email services for promotions.

## Email activation checklist (explicit manual review required)
1. Verify an auditable marketing opt-in tied to the Tengacion brand and this kind of creator/community campaign. An account email, verified email, terms acceptance or transactional consent alone does not qualify. Exclude minors unless a lawful basis and appropriate permissions are verified.
2. Confirm recipient status and suppression list immediately before each send: unsubscribed, bounced, complained, deleted, banned, unverified or no affirmative opt-in => **exclude**. Prefer a consent record with purpose, wording/version, timestamp, source and withdrawal timestamp. Pre-existing consent cannot be inferred retrospectively.
3. Use a dedicated bulk-email provider with sender authentication, unsubscribe link, one-click unsubscribe where supported, delivery limits and suppression enforcement. Do not blast the existing `sendBrandedEmail` SMTP transactional channel; do not include account emails in application logs or analytics.
4. Send only once after preview and approval. Include sender name, reason for receiving the email, the official CANEX voting URL, that voting is optional, closing date/time, and a functional unsubscribe link. No incentives conditioned on voting or evidence of a vote.
5. Stop sends after `2026-09-28T20:59:00Z`. Track aggregates only (delivered and voluntary link clicks), not alleged votes or individual voting behavior.

### Email copy
Subject: Optional invitation: listen to THE GENERATOR CHOIR 🎶

Hi {firstName},

Stephen Daniel Kurah, Tengacion’s founder, has entered THE GENERATOR CHOIR in CANEX Create-thon 2026. If you enjoy the project, you're welcome to listen and cast your own vote on the official competition page:

https://dala.gebeya.com/cannex-vote/a8475b3d-12c0-4edc-a82e-070f3fb42140

Voting closes September 28, 2026 at 23:59 East Africa Time. Taking part is entirely optional and will not affect your Tengacion account.

You are receiving this message because you explicitly opted in to Tengacion promotional updates.
Unsubscribe: {uniqueProviderUnsubscribeUrl}

## In-app activation checklist
Use a separately recorded affirmative preference for **promotional/community campaign notices** (not `system`, which is used for operational notifications). Until that preference is built, keep the website banner as the opt-in-by-click route; do not mass-insert `system` notifications. Once implemented, require this preference at send time, restrict to active eligible users, deduplicate once per recipient using a campaign-specific key, and make the notice dismissible and nonessential.

Suggested message: “🎶 Our founder's THE GENERATOR CHOIR is in the CANEX public voting stage. If you enjoy it, you may listen and vote on the official site before September 28. Participation is optional.” Action: official URL above.

## QA before deployment
- Verify banner loads on the home feed, can be dismissed, does not block the feed, and opens ONLY the official URL.
- Verify the UTC closing timestamp against the platform's published EAT closing time; banner disappears at the deadline.
- Verify no account data is sent to the voting site and no mail or notifications are sent as a side effect of deployment.
- Run frontend tests, lint and production build; check responsive layout and keyboard focus.
- Deploy only after human review; avoid changing challenge submission materials.
