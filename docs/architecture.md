# Architecture Proposal

## Target folder layout
```
/apps
  /api      # Express + Socket.IO backend (layered structure)
  /web      # React (Vite) frontend with feature modules
/packages
  /shared   # types, validation schemas, DTOs consumable by both apps
/docs        # architecture & migration guidance
/.env.example
/docker-compose.yml   # optional orchestration skeleton
```

## Layer responsibilities (apps/api)
- `config/`: validates `.env` via Zod, exposes JWT, database, payment, storage secrets.
- `routes/`: minimal Express routers mapping HTTP verbs to controller handlers and middleware.
- `controllers/`: translate requests/responses, trigger services, wrap results via uniform `ApiResponse`.
- `services/`: business logic (notifications, media, creator flows) collaborating with repositories and external services (payments/storage).
- `repositories/`: encapsulate Mongo/Mongoose CRUD/aggregation patterns; injected into services to keep logic testable.
- `models/`: Mongoose schemas (`User`, `ArtistProfile`, `Track`, `Album`, etc.) with validation helpers.
- `middleware/`: auth guards (JWT access + refresh), rate limiting, request validation (Zod), error handler, logging enhancements.
- `utils/`: helpers like URL sanitizers, platform allowlists, structured response builders, morgan request logger.
- `sockets/`: Socket.IO namespaces (chat, activity) consuming service methods while reusing middleware for auth.

## apps/web structure
- `src/app/`: global providers, router definition, theme/layout.
- `src/features/auth`: login/register flows, protected-route wrappers.
- `src/features/feed`: home timeline, posts list/detail.
- `src/features/chat`: DM list, conversation view, socket integration.
- `src/features/creator`: creator dashboard, artist profile form, subscription/purchase views.
- `src/shared/components`: UI primitives reused across features.
- `src/shared/api`: Axios client with baseURL + interceptors (auth header + refresh behavior).
- `src/shared/hooks`: data fetching hooks (useAuth, useArtistProfile).
- `src/shared/utils`: formatters, validators, constants (platform links).

## Data flow (text)
```
Client (React) -> shared API client -> apps/api/routes -> validation middleware -> controllers -> services -> repositories/models -> MongoDB/External services
                                                                ? storageService / paymentService (S3, Paystack, Stripe)
                        ? response/error middleware handles ApiError -> unified JSON response
```
This flow ensures: (1) routes stay thin, (2) controllers only map HTTP semantics, (3) services coordinate state changes, and (4) repositories and shared packages can be tested independently.

## Security + observability highlights
- Helmet + CORS with allowlist, `rateLimit` applied to auth/billing endpoints.
- JWT access + refresh structure, with refresh tokens stored securely (same-layer strategy even if refresh route is stubbed initially).
- Zod validation for write operations, especially link URLs (httpS only, sanitized) and payment/multimedia payloads.
- Morgan or custom request logger emits structured logs (method, route, duration, userId) while controllers throw `ApiError` for consistent shape.
