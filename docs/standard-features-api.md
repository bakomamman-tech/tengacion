# Tengacion Standard Feature Endpoints

## Auth/Security
- `POST /api/auth/verify-email/request`
- `GET /api/auth/verify-email/confirm?token=...`
- `POST /api/auth/password/forgot`
- `POST /api/auth/password/reset`
- `POST /api/auth/password/change`
- `GET /api/auth/sessions`
- `DELETE /api/auth/sessions/:sessionId`
- `POST /api/auth/logout`
- `POST /api/auth/logout-all`

## Privacy
- `PUT /api/users/me/privacy`
- `PUT /api/users/me/block/:userId`
- `PUT /api/users/me/unblock/:userId`
- `PUT /api/users/me/mute/:userId`
- `PUT /api/users/me/unmute/:userId`
- `PUT /api/users/me/restrict/:userId`
- `PUT /api/users/me/unrestrict/:userId`
- `PUT /api/users/me/hide-stories-from/:userId`
- `PUT /api/users/me/unhide-stories-from/:userId`

## Reporting/Moderation
- `POST /api/reports`
- `GET /api/admin/reports`
- `GET /api/admin/reports/:id`
- `PATCH /api/admin/reports/:id`
- `POST /api/admin/moderation/action`

## Search
- `GET /api/search?q=&type=users|posts|hashtags|rooms`
- `GET /api/search/trending/hashtags`
- `GET /api/search/suggestions`

## Notifications
- `GET /api/notifications`
- `PATCH /api/notifications/read`
- `PATCH /api/notifications/:id/read`
- `GET /api/notifications/preferences/me`
- `PUT /api/notifications/preferences/me`

## Onboarding
- `PUT /api/users/me/onboarding`

## Admin Analytics
- `GET /api/admin/analytics/overview?range=7d|30d`
- `GET /api/admin/analytics/retention?cohort=weekly`
- `GET /api/admin/analytics/errors/uploads`

## Socket Events
- `notification:new` (new standardized event)
- `notifications:new` (legacy-compatible)
- `chat:typing`
- `chat:recording`
- `message:reaction`
- `watch:join`, `watch:state`, `watch:play`, `watch:pause`, `watch:seek`
