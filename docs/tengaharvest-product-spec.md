# TengaHarvest Product Specification

## Product identity

**Name:** TengaHarvest

**Public brand:** TengaHarvest by Tengacion

**Tagline:** Clean Energy. Better Harvests. Higher Incomes.

**Initial market:** Kaduna State, Nigeria

**Parent company:** Tengacion Technologies Limited

## Mission

Make productive clean-energy infrastructure affordable to African smallholder farmers by turning solar irrigation and renewable cold storage into bookable shared services.

## Problem

Smallholder farmers frequently cannot justify or finance the upfront cost of solar pumps, cold rooms and related farm infrastructure. The result is constrained dry-season production, dependence on expensive fuel, avoidable spoilage and weak market power. Infrastructure providers meanwhile struggle to aggregate demand and keep assets productively utilised.

## MVP proposition

TengaHarvest is an asset-light coordination and marketplace layer connecting farmers, farmer clusters and cooperatives with verified solar-irrigation and renewable cold-chain providers.

The first release deliberately avoids pretending to own infrastructure. It records real demand, verifies providers, accepts service requests and creates an auditable operating dataset.

## Primary users

### Farmer
- Register farm location, farm size and crops.
- State demand for solar irrigation or cold storage.
- Discover verified services.
- Request capacity and preferred service date.
- Receive a booking reference and confirmation status.

### Infrastructure provider
- Register identity/business details.
- Submit solar irrigation or renewable cold-storage services.
- Enter service location, capacity and indicative price.
- Remain private until pilot verification.
- Later manage availability, bookings and payouts.

### Cooperative / farmer cluster
- Aggregate multiple farms and their demand.
- Coordinate shared infrastructure bookings.
- Track hectares, crops and service utilisation.

### TengaHarvest operations/admin
- Verify participants and providers.
- Approve or pause service listings.
- Confirm bookings.
- Mark completed services.
- Export pilot data for partners and funders.

## Core release routes

### Frontend
- `/tengaharvest` — public landing page, service discovery and live pilot counters.
- `/tengaharvest/farmer` — farmer registration and booking request interface.
- `/tengaharvest/provider` — provider onboarding and service submission.
- Future: `/tengaharvest/cooperative`.
- Future: `/admin/tengaharvest`.

### API
- `GET /api/tengaharvest/services`
- `POST /api/tengaharvest/participants`
- `POST /api/tengaharvest/provider-services`
- `POST /api/tengaharvest/bookings`
- `GET /api/tengaharvest/impact`

## Data model

### TengaHarvestParticipant
Stores farmer, provider, cooperative and buyer pilot registrations.

Important fields: role, name, phone, email, organization, state, LGA, community, farm hectares, crops, service interests and pilot status.

### TengaHarvestService
Stores provider infrastructure that may become publicly bookable after verification.

Important fields: provider, service type, location, capacity, capacity unit, indicative price, renewable-energy flag and verification status.

### TengaHarvestBooking
Stores an immutable public booking reference, selected service, customer details, required units, preferred start date and operational status.

## Trust and marketplace rules

1. No invented equipment should appear as live inventory.
2. Provider services default to `pending_review`.
3. Public service discovery returns only `active` services.
4. A booking can only be created for an active service.
5. Grant-facing climate claims must be based on completed operational records, not marketing estimates.
6. Personally identifying participant information must not be exposed through public endpoints.

## Revenue model

### Phase 1
- 5–10% booking/service commission where commercially agreed.
- Provider subscriptions for scheduling and lead-management tools.
- Cooperative plans for cluster administration.

### Phase 2
- Enterprise programme dashboards for NGOs, governments and development organisations.
- Payment and settlement services.
- Produce-marketplace transaction fees.
- Equipment-finance referral/servicing fees where compliant.

### Phase 3
- Selectively owned/financed TengaHarvest infrastructure where utilisation economics justify asset ownership.
- Data-enabled underwriting and climate-finance partnerships.

## Kaduna pilot

### Pilot target
- 50 farmers.
- 3–5 verified infrastructure providers.
- At least 2 LGAs.
- Solar irrigation and cold storage represented.
- First 20 completed service records.

### Recruitment
1. Work through farmer associations and cooperatives.
2. Prioritise tomato, pepper, maize and other crops with visible irrigation or post-harvest constraints.
3. Onboard providers only after phone/business verification and a basic infrastructure check.
4. Use registered farmer demand to determine where provider supply is most valuable.

### Pilot metrics
- Farmers registered.
- Women and youth participants (add explicit fields before institutional reporting).
- Registered hectares.
- Providers verified.
- Active services.
- Booking requests.
- Completed services.
- Hectares irrigated per completed irrigation service.
- Crates/kg/tonnes stored per completed cold-chain service.
- Diesel litres displaced only where baseline methodology is documented.
- Estimated emissions avoided only after a documented calculation methodology is approved.
- Post-harvest loss reduction only where before/after evidence is available.

## Product roadmap

### Release 1 — Pilot demand and provider onboarding
Current build.

### Release 2 — Operations console
Admin verification, service activation, booking confirmation, status changes, notes and CSV export.

### Release 3 — Payments
Use Tengacion's existing payment infrastructure for deposits/full payment, provider settlements and platform fees.

### Release 4 — Farmer clusters
Create cluster records, invite farmers, pool bookings and allocate shared costs.

### Release 5 — IoT / deep-tech layer
Pump controller telemetry, flow metering, energy data, cold-room temperature telemetry, service-health alerts and verifiable climate metrics.

### Release 6 — Finance and institutional dashboards
Asset finance, cooperative credit workflows and programme dashboards designed around actual operational data.

## Funding strategy

- Use the immediate climate/agriculture opportunity to fund pilot execution and verified supply onboarding.
- Build the operating and revenue evidence required for larger development-finance facilities such as AgriFI.
- Do not position the current web MVP as EIC-level deep tech. Develop proprietary IoT/energy-control technology and evidence of TRL maturity before pursuing that class of programme.

## Separation of grant and company funds

Grant funds must be spent only within the approved grant budget. TengaHarvest revenue can support the broader parent company according to normal corporate accounting. Tengacion can also provide legitimate development, hosting, management or infrastructure services to a funded TengaHarvest project when those costs are explicitly permitted and documented.
