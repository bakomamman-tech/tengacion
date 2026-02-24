# Tengacion: Chat + Creator Marketplace MVP

This repo now supports an MVP where users can:
- Chat in real time and share monetized content cards (`track` / `book`)
- Browse public creator pages
- Preview tracks/books and pay to unlock full access
- Let creators upload tracks, create books/chapters, and view basic sales

## Stack
- Frontend: React + Vite + Tailwind CSS
- Backend: Node.js + Express + Socket.io
- Database: MongoDB + Mongoose
- Auth: JWT
- Payments: Paystack (NGN) + Stripe (USD) abstractions
- Media: AWS S3 (audio storage) + URL-based signed redirects

## Project Layout
- `backend/` (desktop-friendly entrypoint that proxies to `apps/api` layered folders)
- `frontend/` (Vite app importing new shared modules in `apps/web`)
- `apps/api/` (new layered controllers/services/repositories)
- `apps/web/` (feature-based React modules, shared API client)
- `.env.example` / `.env.test` env templates

## Creator + Artist Enhancements
- Artist profile now exposes `links` (Spotify, Instagram, Facebook, TikTok, YouTube, Apple Music, Audiomack, Boomplay, Website) plus a `customLinks` array.
- New protected endpoint `GET /api/artist/:username` and `PUT /api/artist/me` for artists to edit their presence.
- Frontend adds `GET /artist/:username` route backed by `apps/web/features/creator/ArtistPage`.
- Storage/payment services scaffolded for AWS S3 + Paystack/Stripe; music/billing endpoints currently return "Not Implemented" responses for future wiring.

## 1) Setup
1. Install dependencies:
```bash
npm install
npm install --prefix backend
npm install --prefix frontend
```
2. Create `.env` from the template:
```bash
cp .env.example .env
```
3. Set required secrets:
- `MONGO_URI`, `JWT_SECRET`, `PAYSTACK_SECRET_KEY`, `PAYSTACK_CALLBACK_URL`
- `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `AWS_S3_BUCKET`, `AWS_S3_MEDIA_URL`

## 2) Running Apps Locally
1. Start the API (serves `apps/api` layered routes via the existing backend entrypoint):
```bash
npm run dev --prefix backend
```
2. Start the frontend (Vite):
```bash
npm run dev --prefix frontend
```
3. Visit:
- UI: `http://localhost:5173`
- API health: `http://localhost:5000/api/health`

## 3) Testing
- Run backend unit/integration tests: `npm test --prefix backend`
- Tests use `jest` + `supertest` + `mongodb-memory-server` to exercise protected auth/artist endpoints.

## 4) Seed Dev Data
Creates:
- one creator user + artist profile
- sample paid track + book

```bash
npm run seed:marketplace --prefix backend
```

## 5) Useful Endpoints
- **Auth:** `GET /api/me`
- **Artist:** `GET /api/artist/:username`, `PUT /api/artist/me`
- **Creators:** `GET /api/creators/:creatorId`, `/tracks`, `/books`
- **Tracks:** `POST /api/tracks`, `GET /api/tracks/:trackId`, `/track stream preview`
- **Books:** CRUD endpoints for books + chapters
- **Payments:** `POST /api/payments/init`, `/webhook/paystack`
- **Billing stubs:** `POST /api/billing/subscribe`, `/api/billing/purchase` (501 responses until wired)
- **Music stubs:** `POST /api/music/tracks`, `/api/music/tracks/:id/preview`, `/stream`
- **Purchases / Entitlements:** `GET /api/purchases/my`, `GET /api/purchases/creator/sales`, `GET /api/entitlements/check`
- **Chat:** `POST /api/chat/messages` (and legacy `/api/messages/*` routes)

## Frontend Routes
- `/` (landing/login)
- `/register`
- `/home`, `/search`, `/notifications`, `/dashboard/creator`
- `/tracks/:trackId`, `/books/:bookId`
- `/creators/:creatorId` (legacy)
- `/artist/:username` (new artist profile builder powered by `apps/web`)

## Notes
- Creator-facing media now targets AWS S3 audio storage (`AWS_S3_BUCKET` + `AWS_S3_MEDIA_URL`).
- Artist links must be HTTPS and sanitized at the backend.
- PaymentService selects Paystack when currency is NGN and Stripe when USD, but the flows are placeholders until the next sprint.

## Phase 2 (Outline)
- Fan Pass subscriptions
- Creator gifting + hospitality
- Referral rewards
- Creator marketplace onboarding + platform commission
- Audiobooks

## Phase 3 (Outline)
- Creator discovery ranking + editorial collections
- Advanced analytics (retention, conversion funnels, cohort revenue)
- AI recommendations
- Multi-provider payments + payouts
- Fraud/risk detection
