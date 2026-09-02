# TengaHarvest Build Prompt

Use this prompt with an AI coding agent that has access to the Tengacion repository.

---

You are working inside the existing `bakomamman-tech/tengacion` production codebase. Build **TengaHarvest by Tengacion**, a climate-smart agriculture infrastructure platform starting with a Kaduna State pilot.

## Product objective

TengaHarvest must connect smallholder farmers and cooperatives with verified providers of:

1. Solar irrigation as a service.
2. Solar-powered / renewable-energy cold storage as a service.

The MVP must be asset-light. Do not invent provider inventory, fake completed transactions, fake climate impact, fake farmers or fake equipment. Only verified/approved services may appear publicly.

## Required public routes

Create and wire these React routes:

- `/tengaharvest`
- `/tengaharvest/farmer`
- `/tengaharvest/provider`

Treat all `/tengaharvest` routes as public/auth-optional routes in `frontend/src/App.jsx` and suppress unrelated Tengacion promotional overlays/assistant UI on these focused pages.

## Required API mount

Mount the TengaHarvest API in `backend/app.js`:

```js
app.use("/api/tengaharvest", require("./routes/tengaharvest"));
```

## Existing feature files

Use and improve the following files rather than duplicating them:

- `backend/models/TengaHarvestParticipant.js`
- `backend/models/TengaHarvestService.js`
- `backend/models/TengaHarvestBooking.js`
- `backend/routes/tengaharvest.js`
- `frontend/src/features/tengaharvest/TengaHarvestLandingPage.jsx`
- `frontend/src/features/tengaharvest/TengaHarvestFarmerPage.jsx`
- `frontend/src/features/tengaharvest/TengaHarvestProviderPage.jsx`
- `frontend/src/features/tengaharvest/tengaHarvestApi.js`
- `frontend/src/features/tengaharvest/tengaharvest.css`
- `docs/tengaharvest-product-spec.md`

## App.jsx integration

Add lazy imports:

```js
const TengaHarvestLandingPage = lazy(
  () => import("./features/tengaharvest/TengaHarvestLandingPage")
);
const TengaHarvestFarmerPage = lazy(
  () => import("./features/tengaharvest/TengaHarvestFarmerPage")
);
const TengaHarvestProviderPage = lazy(
  () => import("./features/tengaharvest/TengaHarvestProviderPage")
);
```

Add:

```js
const isTengaHarvestRoute =
  pathname === "/tengaharvest" || pathname.startsWith("/tengaharvest/");
```

Include `isTengaHarvestRoute` in `isAuthOptionalRoute`.

Ensure `WelcomeVoiceController`, `TopUpPromoDiscovery`, `InstallPrompt`, and `TengacionAssistantDock` do not intrude on TengaHarvest focused routes, mirroring the existing focused-route behavior.

Add routes near the other public microsites:

```jsx
<Route path="/tengaharvest" element={<TengaHarvestLandingPage />} />
<Route path="/tengaharvest/farmer" element={<TengaHarvestFarmerPage />} />
<Route path="/tengaharvest/provider" element={<TengaHarvestProviderPage />} />
```

## MVP behavior

### Farmer
- Register name, phone, optional email, LGA, community, farm hectares and crops.
- Record service interests.
- View only `active` provider services.
- Request a booking for an active service.
- Get a public booking reference.
- Never show a service as confirmed until operations confirms it.

### Provider
- Register provider identity/business.
- Submit solar irrigation or cold-storage infrastructure.
- Provider listing defaults to `pending_review`.
- Do not expose it publicly until approved.

### Public marketplace
- Filter only `active` listings.
- Clearly show empty marketplace state while supply onboarding is underway.
- Never display demo data as real availability.

### Impact
- Show real database counts for registered farmers, providers, registered hectares, active services and completed bookings.
- Do not calculate CO2 avoided, diesel displaced or post-harvest-loss reductions until a documented methodology and completed service evidence exist.

## Next required backend feature

Create an admin-only TengaHarvest operations API and page for Tengacion admins/super-admins to:

- list participants;
- list pending provider services;
- activate/pause services;
- list booking requests;
- confirm/complete/cancel bookings;
- add internal verification notes;
- export pilot records to CSV.

Use existing Tengacion auth/admin middleware and permission patterns. Do not create a separate authentication system.

## Payments

Do not add payments until booking confirmation and provider verification flows are complete. In the next phase, reuse existing Tengacion Paystack/payment abstractions rather than introducing another payment provider.

## Testing requirements

Add backend tests that confirm:

1. Invalid participant roles are rejected.
2. Farmer registration succeeds.
3. Provider service defaults to `pending_review`.
4. Pending services never appear in the public service endpoint.
5. Booking a missing/inactive service is rejected.
6. Impact endpoint returns numerical counts without exposing personal data.

Add frontend tests for:

1. Landing page empty marketplace state.
2. Farmer form validation/submission.
3. Provider registration before service submission.
4. Active service discovery.

## UX requirements

- Mobile-first and responsive.
- Accessible form labels and keyboard behavior.
- High-contrast climate/agriculture visual language.
- Keep the existing TengaHarvest CSS namespace (`th-`) to avoid contaminating Tengacion global styling.
- Avoid generic stock-image dependency for MVP.
- Communicate trust, verification and measurable real-world impact.

## Security / integrity requirements

- Validate and trim all public inputs server-side.
- Add appropriate rate limiting for public write endpoints if the existing global limiter is insufficient.
- Never return participant phone/email data through public endpoints.
- Validate Mongo ObjectIds before querying where useful.
- Do not accept arbitrary status values from public clients.
- Add spam/duplicate protection before a large public campaign.

## Definition of done

The feature is done when:

- the three public TengaHarvest URLs render correctly in production;
- `/api/tengaharvest/*` is mounted;
- a farmer can submit pilot demand;
- a provider can submit infrastructure for verification;
- only approved infrastructure appears publicly;
- a farmer can request an approved service;
- impact counters are based on real database records;
- tests pass;
- no existing Tengacion flows regress;
- documentation explains the pilot, business model and next build phases.

Do not merge directly to `main` without reviewing the diff and running the relevant frontend/backend tests.
