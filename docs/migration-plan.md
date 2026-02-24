# Migration Plan

## Overall strategy
1. Keep `backend/` and `frontend/` untouched until the new `/apps` layout proves stable; legacy route files simply proxy to the new routers while emitting deprecation warnings.
2. Build the layered backend architecture inside `apps/api/` (config, middleware, routes, controllers, services, repositories, models) and gradually redirect legacy routes to it.
3. Bring the frontend along by creating `apps/web/` with the feature-based folders, shared API client, and creator page, while the original `frontend/` stays runnable until parity is reached.

## Step-by-step sequence

### Step 1: Config + core middleware
- Create `apps/api/config/env.js` that loads `.env` via Dotenv and validates everything with Zod.
- Add `apps/api/utils/ApiError.js` plus `apps/api/middleware/errorHandler.js` and rewire `backend/server.js` to use them while still supporting legacy config files.
- Ensure `.env.example` and npm scripts expose the new secrets (JWT refresh, Paystack/Stripe, S3) and ignore OS clutter.
- Status: ✅ Done (shared config is running, new error handling is wired, builds still pass).

### Step 2: Layered auth
- Move auth logic into `apps/api/routes/auth.js`, `controllers/authController.js`, `services/authService.js`, and `repositories/userRepository.js`.
- Keep `backend/routes/auth.js` as a proxy that logs “deprecated” so external clients continue calling `/api/auth` while we point them at the new implementation over time.
- Status: ✅ Done (new layers handle validation, token issuance, profile retrieval, and still rely on the shared config).

### Step 3: Feed/posts realignment
- Build the posts layer: new `apps/api/routes/posts.js`, `controllers/postController.js`, `services/postService.js`, `repositories/postRepository.js`.
- Copy the existing feed/interaction logic into the service (create, read, update, delete, like, share, comment) while still emitting structured errors.
- Replace `backend/routes/posts.js` with a warning + proxy that delegates to `apps/api/routes/posts.js`.
- Status: ✅ Done (the legacy route now forwards to the new service, ensuring backward compatibility while the layered codebase owns the feature).

### Step 4: Artist + creator profile
- Introduce `backend/models/ArtistProfile.js` plus shared repositories/services/controllers to enforce sanitized external links and custom links.
- Extend `User` with `isArtist`/`role: artist`, add an alias `/api/artist` route, and seed the demo creator with sample links.
- Guard `/api/artist/me` with artist-only middleware and update the migration log to note work remaining on the frontend.
- Status: 🟡 In progress (backend wiring completed; frontend creator page + shared API client still pending).

### Step 5: Music/billing scaffolding
- Create placeholder models (`Track`, `Album`, `Purchase`, `Subscription`) and inject `paymentService`/`storageService` that default to Paystack (NGN) and Stripe (USD) plus AWS S3.
- Add stubbed routers returning structured “Not Implemented” until the full feature set can be built.
- Status: ⚪️ Pending.

### Testing & documentation
- Add Jest/Supertest coverage for protected endpoints (auth `/me` and artist link updates) once the new app boundaries settle.
- Update the root `README.md` with instructions for running `apps/api` and `apps/web` locally, building tests, and describing transitional aliases.
- Status: 🟡 Partially started (build checks run after each change; tests/documentation still to do).

## Backward compatibility notes
- Legacy npm scripts still point at `backend/server.js` and `frontend/` so nothing breaks during migration.
- Each renamed route now logs a deprecation notice and proxies to its `apps/api` counterpart, giving clients notice before switching.
- Once the new structure proves stable, `backend/` and `frontend/` can be deleted and scripts updated to point directly at `apps/api`/`apps/web`.
