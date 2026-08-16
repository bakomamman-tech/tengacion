# TEAM ARCHIVE — Journal Onboarding Architecture

## Product path

Public entry point: `/gsi`

1. An editor searches by journal title, ISSN, publisher, or website.
2. The Tengacion backend searches live OpenAlex sources, resolves matching publisher entities and homepage domains, and uses Crossref ISSNs as a fallback when OpenAlex text search returns no journal.
3. The editor selects a source; the backend imports that source and up to 100 recent works.
4. The backend normalizes incomplete metadata and calculates the GSI Score.
5. The editor reviews journal-level details and sees the complete score breakdown.
6. On final confirmation, the backend repeats the OpenAlex import, recomputes the score, creates a canonical JSON record, and pins it to public IPFS.
7. The UI returns both a content identifier and a public Tengacion certificate at `/gsi/records/:cid`.

## System boundary

```text
Journal editor
    ↓
React onboarding flow at tengacion.com/gsi
    ↓ same-origin JSON
Express /api/gsi routes
    ├── OpenAlex source, publisher + works requests
    ├── Crossref journal fallback → OpenAlex ISSN resolution
    ├── normalization and GSI-Archive-1.2 scoring
    └── server-managed IPFS pinning
             ↓
      permanent content identifier
```

The browser never receives either provider credential. It also never performs an infrastructure transaction. The editor sees ordinary academic language: import, review, score, confirm, save, and record reference.

## Reliability and integrity controls

- Search input is bounded and normalized; ISSNs receive an exact lookup before full-text search.
- Publisher searches resolve OpenAlex Publisher IDs before filtering journal sources by publisher lineage.
- Website searches normalize the domain, rank exact OpenAlex homepage-domain matches first, and clearly label less-certain title candidates.
- Crossref fallback records remain visibly separate and cannot enter the import workflow unless their ISSNs resolve to an OpenAlex journal source.
- OpenAlex timeouts, rate limits, no-result states, incomplete metadata, and configuration failures receive editor-friendly messages.
- Publication evidence is never accepted from the browser when publishing. The backend fetches it again and recalculates the score.
- Editor corrections are limited to journal title, publisher, homepage, country code, and primary ISSN.
- The archival JSON uses stable key ordering and a SHA-256 content fingerprint.
- The public retrieval endpoint tries more than one IPFS gateway.
- Records are kept below 95 KB by retaining the newest normalized publications that fit, while recording both the reviewed and archived counts.
- Save requests are rate-limited independently from normal API traffic.

## Production configuration

- `OPENALEX_API_KEY`: free server-side OpenAlex key. Required by OpenAlex for API requests.
- `PINATA_JWT`: server-side key restricted to JSON pinning. Used to publish the content-addressed IPFS record.

Neither value should use the `VITE_` prefix or be committed to source control.

## Technology rationale

OpenAlex was selected because it exposes sources, works, authorships, affiliations, topics, dates, identifiers, open-access state, and citation evidence through a documented research graph. Public IPFS was selected because the Buildathon explicitly accepts it, the returned content identifier is derived from the saved bytes, and the backend can make the process a single normal action for the editor.
