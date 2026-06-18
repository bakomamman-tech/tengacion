# Render deployment checklist

Use this file to align your Render service with Tengacion's backend runtime expectations.

## Render service settings
| Field | Value |
| --- | --- |
| **rootDir** | `backend` |
| **runtime** | `node` |
| **buildCommand** | `npm install && npm run build` (runs frontend build via `npm run build:frontend`) |
| **startCommand** | `npm start` (starts `node server.js` inside `backend/`) |
| **Auto deploy** | Enabled (optional) |

Render derives `PORT` automatically and exposes it via `process.env.PORT`. The backend logs friendly errors on `EADDRINUSE` or `EACCES` and exits with status 1 when those happen.

## Environment variables
The server now runs a preflight check (`backend/scripts/preflight.js`) before connecting to MongoDB or starting Socket.IO. Required vars must exist in Render's dashboard:

| Key | Description | Severity |
| --- | --- | --- |
| `MONGO_URI` | MongoDB connection string (Atlas cluster) | Required |
| `JWT_SECRET` | JWT signing secret (>=32 chars) | Required |
| `JWT_REFRESH_SECRET` | Refresh-token signing secret | Required for login/refresh flows |
| `AUTH_CHALLENGE_SECRET` | Challenge/step-up signing secret | Required for MFA/step-up flows |
| `MEDIA_SIGNING_SECRET` | Media signing JWT secret (falls back to `JWT_SECRET` when missing) | Warning if missing |
| `LIVEKIT_WS_URL` | LiveKit signaling WebSocket URL (production should be `wss://...`) | Warning if missing |
| `LIVEKIT_HOST` | Optional fallback if `LIVEKIT_WS_URL` is not set | Warning if missing |
| `LIVEKIT_API_KEY` | LiveKit server API key for token minting | Warning if missing |
| `LIVEKIT_API_SECRET` | LiveKit server API secret for token minting | Warning if missing |
| `APP_URL` | Canonical public app URL used for links and email callbacks | Warning if missing |
| `CLIENT_URL` | Frontend origin used for redirects and shared links | Warning if missing |
| `CORS_ORIGIN` | Comma-separated CORS allowlist for production and localhost | Warning if missing |
| `PAYSTACK_CALLBACK_URL` | Canonical Paystack return URL | Warning if missing |
| `VITE_API_URL` | Frontend API base used during the Vite build | Warning if missing |
| `VITE_CONTACT_EMAIL` | Public business contact email baked into the frontend. Use `stephen@tengacion.com`. | Warning if missing |
| `VITE_SUPPORT_EMAIL` | Public support email baked into the frontend. Use `stephen@tengacion.com`. | Warning if missing |
| `VITE_ADMIN_NOTIFICATION_EMAIL` | Public admin-notification contact fallback baked into the frontend. Use `stephen@tengacion.com`. | Warning if missing |
| `VITE_GA_MEASUREMENT_ID` | Optional GA4 Measurement ID baked into the frontend build | Warning if missing |
| `VITE_GA_DEBUG_MODE` | Optional GA4 debug toggle for non-production validation | Optional |
| `PAYSTACK_SECRET_KEY` | Paystack live production secret key. Use an `sk_live_...` key for real charges; `sk_test_...` keys are blocked when live mode is required. | Required in production |
| `PAYSTACK_REQUIRE_LIVE_KEY` | Set to `true` outside production when you want live-key enforcement. Production always requires an `sk_live_...` key so Paystack checkout cannot open in test mode. | Required for production payments |
| `PLATFORM_SETTLEMENT_ACCOUNT_NAME` | Platform-owned settlement account name for Tengacion funds. Current value: Stephen Mamman Kurah. | Warning if missing |
| `PLATFORM_SETTLEMENT_BANK_NAME` | Platform-owned settlement bank. Current value: Opay. | Warning if missing |
| `PLATFORM_SETTLEMENT_ACCOUNT_NUMBER` | Platform-owned settlement account number. Current value: 8061201090. | Warning if missing |
| `CONTACT_EMAIL` | Public business contact email. Use `stephen@tengacion.com`. | Warning if missing |
| `SUPPORT_EMAIL` | Support/help/contact form email. Use `stephen@tengacion.com`. | Warning if missing |
| `ADMIN_NOTIFICATION_EMAIL` | Recipient for admin/support notification emails. Use `stephen@tengacion.com`. | Warning if missing |
| `EMAIL_FROM` | Visible sender address for transactional emails. Use `stephen@tengacion.com`. | Warning if missing |
| `SMTP_HOST` | SMTP provider host for outgoing mail. Configure in Render, not in GitHub. | Warning if missing |
| `SMTP_PORT` | SMTP provider port for outgoing mail. Configure in Render, not in GitHub. | Warning if missing |
| `SMTP_USER` | SMTP username for outgoing mail. Configure in Render, not in GitHub. | Warning if missing |
| `SMTP_PASS` | SMTP password/app password for outgoing mail. Configure only as a Render secret, never commit it. | Warning if missing |
| `STRIPE_SECRET_KEY` | Stripe secret key | Warning if missing |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook secret | Warning if missing |

The preflight prints pass/warn/fail markers per key and aborts startup when any hard required value is missing or too short.

Because these `VITE_*` values are compiled into the frontend bundle, changing them requires a fresh frontend build/deploy.

Paystack card fields stay inside Paystack's hosted checkout. To debit real cards, set the Render `PAYSTACK_SECRET_KEY` secret to the live Paystack key from the Paystack dashboard and ensure the business settlement bank in Paystack is the Opay account above.

Email delivery is configured through Render environment variables. Keep `CONTACT_EMAIL`, `SUPPORT_EMAIL`, `ADMIN_NOTIFICATION_EMAIL`, `EMAIL_FROM`, `VITE_CONTACT_EMAIL`, `VITE_SUPPORT_EMAIL`, and `VITE_ADMIN_NOTIFICATION_EMAIL` set to `stephen@tengacion.com`. Keep SMTP credentials such as `SMTP_USER` and especially `SMTP_PASS` in Render only; do not commit SMTP passwords, app passwords, API keys, or private mail-provider credentials to GitHub.

To verify the secret Render is actually using, open a Render Shell for the service and run:

```bash
npm run verify:paystack --prefix backend
```

The command prints only the key mode, HTTP status, and Paystack message. It does not print the secret key or account balances.

## Smoke tests (post-deploy)
After each deploy, exercise these endpoints:
1. `GET https://<your-render-url>/api/health` -> 200 with `{"status":"ok"}` plus uptime and environment fields. Confirm the response includes an `X-Request-ID` header.
2. `GET https://<your-render-url>/api/health/live` -> 200 for liveness monitoring
3. `GET https://<your-render-url>/api/health/ready` -> 200 with `{"status":"ready"}` when MongoDB, required secrets, media storage, payments, assistant config, and allowed origins are ready. A `503` means at least one required dependency is degraded, or `{"status":"draining"}` during SIGTERM/SIGINT shutdown.
4. `GET https://<your-render-url>/socket.io` -> 200 with response containing `socket ok`
5. Trigger a harmless missing API route and confirm Render logs include `http.request.completed`, the returned `X-Request-ID`, status code, and request duration.

## Notes
- The backend still preserves `/uploads` static serving and raw-body verification for `/api/payments/webhook/paystack`.
- SIGTERM/SIGINT now marks readiness as draining, closes Socket.IO, closes the HTTP server, and disconnects MongoDB before process exit. Override the shutdown window with `GRACEFUL_SHUTDOWN_TIMEOUT_MS` if Render needs a different drain budget.
- Ensure your Render service config installs devDependencies (`NPM_CONFIG_PRODUCTION=false`) so Jest/Socket.IO dependencies (like `zod`) are available.
- Render's build step operates inside `backend/`, which runs `npm run build:frontend` and caches the Vite output under `frontend/dist`.
