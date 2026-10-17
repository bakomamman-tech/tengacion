# GSI public discovery UX preview

Hosted under https://tengacion.com/GSI (iframe wrapper) and at https://tengacion.com/GSI/index.html (standalone static page).

This is an independent frontend-only concept for Global South Index team review, not a production GSI index. All 8 search records are fictional and labelled as such. No real API, login, DID, CID, GSI Score, or ingestion is connected.

Assets are hosted under frontend/public/GSI and copied by Vite to frontend/dist/GSI; Express serves direct static requests with self-hosted styles and scripts. The isolated iframe route in RootApplication keeps all demo CSS outside Tengacion's global styles. Static content is intentionally noindexed.

When the official GSI frontend repository and API contracts are ready, migrate this demo to reviewed React components within the team repository. Do not present fictional records as indexed scholarship.
