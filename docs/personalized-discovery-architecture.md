# Personalized Discovery and Trust Ranking for Tengacion

## Objective

Build a personalized discovery system that decides the next best post, creator, live session, track, book, album, room, or hashtag for each user while protecting quality and trust.

This should turn Tengacion from a feature-rich social and creator platform into a product that feels world-standard in three ways:

1. Users see content that is relevant faster.
2. Creators get distribution based on quality and audience fit, not noise.
3. The platform can grow monetization without turning into spam.

## Why this is the right next layer for this repo

Tengacion already has the raw product surfaces needed for a recommendation system:

- Social feed posts with visibility rules, hashtags, mentions, likes, comments, polls, quizzes, and media.
- Creator commerce for tracks, books, albums, videos, and entitlements.
- Live sessions and viewer counts.
- Stories, rooms, search, notifications, and creator dashboards.
- An event store plus daily analytics aggregates.

The main gap is that these surfaces are still mostly isolated or sorted by simple recency and popularity. The platform needs one shared intelligence layer above them.

## Current repo foundation

The existing codebase already provides several building blocks:

- `AnalyticsEvent` can store generic event rows with `type`, `userId`, `targetId`, `targetType`, `contentType`, and free-form metadata.
- `DailyAnalytics` already aggregates platform metrics such as streams, downloads, purchases, comments, shares, and activity.
- `PlayerProgress` stores resume behavior for songs and podcasts, which is useful as a high-signal implicit preference.
- `Purchase` records direct monetization intent and successful conversion.
- `LiveSession` stores active live rooms and viewer counts.
- `PostService.getFeed` currently applies privacy and relationship rules, so the ranking layer can sit on top of valid candidate selection instead of replacing access control.
- Search and suggestions already expose hashtags, rooms, users, and posts, which can be upgraded into recommendation-backed surfaces.

## Product principles

1. Trust before growth.
2. Personalized, but understandable.
3. Multi-surface, not feed-only.
4. Incremental rollout with safe fallbacks.
5. Creator distribution should reward retention and satisfaction, not cheap clicks.

## North-star outcomes

### User outcomes

- Faster time to first meaningful action after login.
- Higher session depth across feed, creator content, and live.
- More repeat consumption of tracks, books, videos, and creators.

### Creator outcomes

- More qualified discovery for new creators.
- Better conversion from discovery to follow, stream, purchase, and repeat consumption.
- Actionable diagnostics showing why content spread or stalled.

### Platform outcomes

- Higher 7-day and 30-day retention.
- Higher purchase rate per active user.
- Lower spam exposure and lower report rates on recommended content.

## The system to build

The target system has six layers:

1. Signal capture
2. Feature aggregation
3. Candidate generation
4. Ranking and exploration
5. Trust and safety gating
6. Explanation and analytics

## Phase 1: Foundational ranking

### Goal

Ship a reliable recommendation layer quickly using deterministic scoring and existing Mongo models. No heavy ML dependency.

### User-facing scope

- Personalized home feed ordering.
- "Recommended creators" in search or sidebar.
- Better ordering for live directory.
- Better ordering for creator hub content rails like continue listening and suggested items.

### Product behavior

For each user, the system should rank candidates using:

- Relationship strength: friends, follows, close friends, prior messages.
- Recent engagement: likes, comments, shares, replies, poll votes, story replies.
- Consumption depth: track streams, downloads, continue-listening progress, live joins.
- Monetization intent: preview opens, purchase attempts, purchase success.
- Freshness and diversity: mix recent items with one or two exploratory candidates.
- Trust penalties: reports, repeated upload failures, abnormal engagement spikes, blocks, mutes.

### Ranking approach

Use a weighted heuristic score:

`score = affinity + content_quality + freshness + monetization_fit + exploration_bonus - trust_penalty`

#### Example feature weights

- `+20` if author is a friend
- `+14` if author is followed
- `+10` if user interacted with the creator in the last 14 days
- `+8` if item type matches recent user consumption
- `+6` if creator or content converts well with similar audiences
- `+4` if fresh within 24 hours
- `-15` if creator has unresolved trust flags
- `-25` if user muted or restricted the creator

### Technical changes

#### New event types

Add structured analytics events for recommendation signals:

- `feed_impression`
- `post_opened`
- `post_dwell`
- `post_shared`
- `story_seen`
- `story_replied`
- `creator_followed`
- `creator_profile_viewed`
- `search_result_clicked`
- `live_joined`
- `live_left`
- `track_preview_started`
- `track_stream_started`
- `track_stream_completed`
- `book_preview_opened`
- `book_downloaded`
- `paywall_viewed`
- `recommendation_served`
- `recommendation_clicked`
- `recommendation_hidden`
- `recommendation_dismissed`

#### New models

Add lightweight Mongo models:

- `UserAffinityProfile`
  - `userId`
  - `topCreators`
  - `topTopics`
  - `preferredContentTypes`
  - `recentSignals`
  - `negativeSignals`
  - `updatedAt`

- `CreatorQualityProfile`
  - `creatorId`
  - `engagementRate`
  - `completionRate`
  - `purchaseRate`
  - `reportRate`
  - `trustScore`
  - `qualityTier`
  - `updatedAt`

- `RecommendationLog`
  - `requestId`
  - `userId`
  - `surface`
  - `candidateIds`
  - `rankedIds`
  - `featuresSnapshot`
  - `servedAt`

These can stay in Mongo for Phase 1.

#### New services

- `backend/services/discoveryEventService.js`
  - Normalizes and writes interaction events.

- `backend/services/affinityService.js`
  - Builds simple user-to-creator and user-to-topic affinity maps from recent events.

- `backend/services/trustScoreService.js`
  - Computes creator and content penalties from reports, blocks, mutes, failed uploads, and suspicious event ratios.

- `backend/services/candidateService.js`
  - Pulls valid items from posts, tracks, books, albums, videos, live sessions, and rooms.

- `backend/services/rankingService.js`
  - Applies weighted scoring and deduplication.

- `backend/services/explanationService.js`
  - Produces short explanation labels such as "Because you listened to Afrobeats creators" or "Popular with people who follow this creator."

#### New routes

- `GET /api/discovery/home`
- `GET /api/discovery/creators`
- `GET /api/discovery/live`
- `GET /api/discovery/creator-hub`
- `POST /api/discovery/events`

These routes should return ranked items plus a short explanation token.

### Integration points in current repo

- Replace the plain recency ordering inside the home feed flow with ranked candidate ordering.
- Reuse `PlayerProgress`, `Purchase`, `LiveSession`, `AnalyticsEvent`, and current privacy filters.
- Keep `PostService.getFeed` as the access-control and candidate eligibility layer, then pass valid posts into ranking.

### Success metrics for Phase 1

- Home feed CTR up
- Average session length up
- Streams per active user up
- Purchases per active user up
- Recommendation hide rate within limit
- Report rate on recommended content does not increase

## Phase 2: Cross-surface personalization

### Goal

Move from single-surface ranking to one shared recommendation graph across social, live, and commerce.

### User-facing scope

- Unified "For You" ranking across posts, live, music, books, and videos.
- Creator cold-start recommendations for new users and new creators.
- Search suggestions based on behavior, not only string matches.
- Dynamic rails on creator pages such as "More like this", "Up next", and "Fans also bought".

### Product behavior

The system should learn:

- User-to-creator affinity
- User-to-topic affinity
- User-to-format affinity
- User-to-price sensitivity
- User-to-session-context affinity

Example session contexts:

- commuting music user
- late-night live viewer
- reader who converts after previews
- social-first user who prefers friend content before creator content

### Technical changes

#### New aggregated feature tables or collections

- `UserContentFeatures`
  - rolling 7d, 30d, and 90d interaction counters by content type

- `CreatorAudienceFeatures`
  - audience retention, conversion, repeat listeners, repeat buyers

- `ContentFeatureSnapshot`
  - recency, engagement velocity, completion rate, preview-to-purchase rate, topic labels

If Mongo begins to strain, move feature snapshots to Redis cache plus nightly persisted Mongo summaries.

#### New background jobs

- Nightly affinity recompute
- Hourly creator quality recompute
- Near-real-time trending updater
- Recommendation feedback backfill

#### Ranking changes

Add candidate blending:

- friend graph candidates
- followed-creator candidates
- similar-creator candidates
- trending-but-safe candidates
- exploratory new-creator candidates

Add hard caps to avoid feed collapse:

- max items per creator in top 20
- max repeated content type streak
- minimum exploratory quota

#### Search upgrades

Upgrade current search flows to support:

- `GET /api/search/suggestions` backed by affinity and trend scores
- `GET /api/search/trending/hashtags` backed by velocity, not raw count only
- optional `GET /api/discovery/search-preview`

### New creator-facing analytics

Expose recommendation diagnostics in creator dashboards:

- recommendation impressions
- click-through rate
- average dwell or completion rate
- follow conversion rate
- purchase conversion rate
- trust or quality limitations

Creators should see plain-language guidance:

- "Strong completion, weak click-through: improve covers and opening hooks."
- "High preview rate but low purchase rate: review pricing or preview quality."
- "Distribution limited by report rate or muted audience segments."

### Success metrics for Phase 2

- cross-surface consumption per user up
- follow conversion from recommendations up
- creator revenue from recommendations up
- new creator discovery rate up
- time to first follow or first purchase for new users down

## Phase 3: World-standard intelligence layer

### Goal

Make discovery adaptive, explainable, and globally competitive using learning systems, experimentation, and trust-aware optimization.

### User-facing scope

- Fully blended "For You" graph.
- Explainable recommendations everywhere.
- Context-aware recommendations by time, session intent, and device behavior.
- Trust-aware ranking that reduces spam without suppressing legitimate emerging creators.

### Product behavior

At this stage Tengacion should support:

- learning-to-rank or bandit optimization
- exploration budgets for emerging creators
- multi-objective optimization for retention, satisfaction, and monetization
- causal diagnostics for creator performance
- region-aware and culture-aware ranking profiles

### Technical changes

#### Serving stack

- Keep Mongo as source of truth.
- Add Redis for hot feature and ranked-candidate caching.
- Add an offline feature generation job.
- Add a ranking config registry for experiments and weight sets.

#### New services

- `backend/services/featureStoreService.js`
- `backend/services/experimentService.js`
- `backend/services/banditService.js`
- `backend/services/discoveryMetricsService.js`

#### New admin and experiment routes

- `GET /api/admin/discovery/overview`
- `GET /api/admin/discovery/experiments`
- `POST /api/admin/discovery/experiments`
- `PATCH /api/admin/discovery/weights`

#### New creator routes

- `GET /api/creator/discovery/insights`
- `GET /api/creator/discovery/content/:id`

### Safety and quality requirements

- every recommended item must pass access control and trust policy
- all recommendation requests must be loggable and replayable
- experiment exposure must be stored per request
- report rate and hide rate must be part of the optimization target

### Success metrics for Phase 3

- 30-day retention up materially
- purchase conversion from recommendations up materially
- recommendation complaint rate stable or lower
- emerging creator share of discovery impressions healthy
- user satisfaction proxies improve without trust degradation

## Recommended architecture for this repo

### Request flow

1. Frontend requests a discovery surface such as home, live, or creators.
2. API loads the viewer profile and safety constraints.
3. Candidate service fetches eligible items from existing collections.
4. Affinity service loads user feature summaries.
5. Trust service applies hard filters and penalties.
6. Ranking service scores and diversifies candidates.
7. API returns ranked items plus explanation tokens and request metadata.
8. Frontend logs served, viewed, clicked, hidden, and converted events.

## Proposed backend structure

Add this under the current backend and layered apps structure:

```text
backend/
  controllers/
    discoveryController.js
  services/
    discoveryEventService.js
    affinityService.js
    candidateService.js
    rankingService.js
    trustScoreService.js
    explanationService.js
    discoveryMetricsService.js
  models/
    UserAffinityProfile.js
    CreatorQualityProfile.js
    RecommendationLog.js
  routes/
    discovery.js
```

If you prefer to keep all new architecture in `apps/api`, the same services can live there while reusing current backend models.

## Candidate generation strategy

### Home feed candidates

- eligible posts from friends, follows, close friends, and public creators
- creator content cards derived from tracks, books, albums, and videos
- optional live insertions when viewer affinity is high

### Creator recommendation candidates

- creators similar to followed creators
- creators with strong quality scores in preferred topics
- cold-start creators with strong early retention but low exposure

### Live candidates

- active live sessions
- boosted by relationship, category preference, and current viewer velocity
- penalized by weak retention and trust flags

### Commerce candidates

- items with strong preview-to-purchase conversion
- items similar to previously purchased or completed items
- creator bundles when user already converts on that creator

## Data and feature design

### User features

- follows count and creator graph overlap
- recent creators interacted with
- recent content types consumed
- average session time by surface
- preview-to-purchase ratio
- hides, mutes, blocks, and skips
- preferred active hours

### Content features

- freshness
- engagement velocity
- completion rate
- save rate
- follow conversion rate
- purchase conversion rate
- report rate
- creator trust score

### Creator features

- repeat audience rate
- content consistency
- monetization efficiency
- report rate
- upload reliability
- multi-format performance

## API contract sketch

### `GET /api/discovery/home`

Response:

```json
{
  "requestId": "rec_123",
  "surface": "home",
  "items": [
    {
      "id": "post_1",
      "entityType": "post",
      "score": 0.91,
      "reason": "because_you_follow_creator",
      "payload": {}
    }
  ],
  "nextCursor": "..."
}
```

### `POST /api/discovery/events`

Request:

```json
{
  "requestId": "rec_123",
  "surface": "home",
  "events": [
    {
      "type": "recommendation_clicked",
      "entityType": "post",
      "entityId": "..."
    }
  ]
}
```

## Frontend changes

### New API helpers

Add to `frontend/src/api.js`:

- `getDiscoveryHome`
- `getDiscoveryCreators`
- `getDiscoveryLive`
- `trackDiscoveryEvents`

### UI integration points

- Home feed: use discovery endpoint by default, fallback to legacy feed route on failure.
- Search: replace generic suggestions with personalized suggestions.
- Live directory: rank by viewer fit, not only availability.
- Creator hub: add "Recommended for you", "Because you listened", and "Trending with your circle" rails.

### Client event logging

Capture:

- impression
- dwell threshold reached
- click
- hide
- mute from recommendation
- follow
- purchase

This should be batched to reduce request overhead.

## Rollout plan

### Step 1

Add event capture and recommendation logs behind feature flags without changing the user-facing order.

### Step 2

Launch Phase 1 ranking for internal admin and test accounts only.

### Step 3

Roll out to 5 percent of users with fallback to legacy recency feed.

### Step 4

Expand to search, live, and creator hub rails.

### Step 5

Enable creator-facing recommendation insights after data quality is stable.

## Guardrails

- Never bypass visibility, privacy, block, mute, or entitlement rules.
- Never optimize for clicks alone.
- Keep exploration bounded so quality does not collapse.
- Persist recommendation request logs for debugging and abuse review.
- Use trust penalties as a first-class part of ranking.

## Minimal implementation order

If the team wants the shortest route to value, build in this order:

1. event taxonomy and logging
2. user affinity summaries
3. creator trust and quality summaries
4. discovery home endpoint
5. frontend feed integration with fallback
6. live and creator recommendations
7. creator diagnostics

## What success looks like for Tengacion

When this is working, Tengacion will stop feeling like separate features stitched together. It will feel like one product that understands:

- who the user cares about
- what format they want right now
- what they are likely to finish
- what they are likely to pay for
- what should never be promoted

That is the feature layer most likely to make Tengacion feel world-standard.
