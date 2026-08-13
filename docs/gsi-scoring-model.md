# GSI-Archive-1.1 Scoring Model

The score measures how visible and reusable the journal's current OpenAlex record is. It does **not** claim to measure research quality.

Only research publication types—articles, reviews, book chapters, and proceedings articles—enter the scoring sample. Other OpenAlex record types remain in the permanent archive for traceability but cannot inflate or reduce the score. In particular, journal-level `paratext` records are excluded from citation averages and every other scored component.

| Component | Weight | Exact calculation |
| --- | ---: | --- |
| Metadata completeness | 25 | Mean coverage of title, publication date/year, named authors, institutional affiliations, and abstracts × 25 |
| Publishing continuity | 20 | Applicable active years among the last five completed years × 15, plus recency of the latest indexed year × 5 |
| Open-access availability | 20 | Openly accessible score-eligible works ÷ score-eligible works × 20 |
| Author & institution context | 15 | Identified author coverage × 6, author-affiliation coverage × 5, institution country-data coverage × 4 |
| Persistent identifiers | 10 | DOI coverage among score-eligible works × 8, plus 2 when the journal has an ISSN |
| Discoverability signals | 10 | Topic coverage × 4, bounded log-normalized average citations × 4, bounded log-normalized indexed work count × 2 |

All component results are rounded to whole points. The final score is the sum of the six displayed component results, capped at 100.

## Fairness choices

- No impact factor, publisher prestige, journal-language, country-income, or fee-level input is used.
- Geographic breadth is shown as context but does not earn points. A journal serving one country is not treated as weaker than a multinational journal.
- The author/institution component measures whether contributors can be identified, not where their institutions sit in a ranking.
- A newer journal's continuity window begins at its earliest known publication year, so it is not expected to have existed before it began publishing.
- Missing evidence remains visible in the denominator and in the detailed metrics. The interface explicitly says that a low evidence score is not a judgment of research quality.
- The score records how many imported works were eligible, how many were excluded, and which excluded work types were present.
- Global South institution status is not inferred because there is no competition-provided classification. Institution country codes remain archived as neutral geographic evidence instead of emitting a potentially misleading boolean or count.
- The exact sample size, total indexed work count, latest year, coverage numerators, and denominators travel with the archived record.

## Interpretation

The interface does not use an opaque grade label. It displays `score/100`, all six weighted components, their evidence metrics, a strongest-area summary, an opportunity summary, and the fairness note. Judges and editors can therefore reproduce why a score moved without reading source code.
