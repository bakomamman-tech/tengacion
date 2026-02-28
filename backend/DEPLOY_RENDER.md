# Render deployment checklist

Use this file to align your Render service with Tengacion’s backend runtime expectations.

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
The server now runs a preflight check (`backend/scripts/preflight.js`) before connecting to MongoDB or starting Socket.IO. Required vars must exist in Render’s dashboard:

| Key | Description | Severity |
| --- | --- | --- |
| `MONGO_URI` | MongoDB connection string (Atlas cluster) | 🔴 Required |
| `JWT_SECRET` | JWT signing secret (≥32 chars) | 🔴 Required |
| `MEDIA_SIGNING_SECRET` | Media signing JWT secret (≥32 chars) | 🔴 Required |
| `LIVEKIT_WS_URL` | LiveKit signaling WebSocket URL (production should be `wss://...`) | 🟠 Warning if missing |
| `LIVEKIT_HOST` | Optional fallback if `LIVEKIT_WS_URL` is not set | 🟠 Warning if missing |
| `LIVEKIT_API_KEY` | LiveKit server API key for token minting | 🟠 Warning if missing |
| `LIVEKIT_API_SECRET` | LiveKit server API secret for token minting | 🟠 Warning if missing |
| `FRONTEND_URL` | Optional, used for CORS/redirect hints | 🟠 Warning if missing |
| `PAYSTACK_SECRET_KEY` | Paystack production secret key | 🟠 Warning if missing |
| `STRIPE_SECRET_KEY` | Stripe secret key | 🟠 Warning if missing |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook secret | 🟠 Warning if missing |

The preflight prints `✅`, `⚠️`, or `❌` per key and aborts startup when any hard required value is missing or too short.

## Smoke tests (post-deploy)
After each deploy, exercise these endpoints:
1. `GET https://<your-render-url>/api/health` → 200 with `{"status":"ok"}`
2. `GET https://<your-render-url>/socket.io` → 200 with response containing `socket ok`

## Notes
- The backend still preserves `/uploads` static serving and raw-body verification for `/api/payments/webhook/paystack`.
- Ensure your Render service config installs devDependencies (`NPM_CONFIG_PRODUCTION=false`) so Jest/Socket.IO dependencies (like `zod`) are available.
- Render’s build step operates inside `backend/`, which runs `npm run build:frontend` and caches the Vite output under `frontend/dist`.
