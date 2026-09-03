# Tengacion VoiceBridge — Phase 1

VoiceBridge Phase 1 provides a provider-neutral transcript normalization engine,
normalized word error rate (WER), API scaffolding, and a responsive evaluation
workspace. Sahara, Gemini, and OpenAI are deliberately not connected in this phase.

## API surface

- `GET /api/codeswitch/health`
- `POST /api/codeswitch/normalize`
- `POST /api/codeswitch/wer`
- `POST /api/codeswitch/transcribe` — Phase 1 placeholder (`501`)
- `POST /api/codeswitch/benchmark` — Phase 1 placeholder (`501`)
- `POST /api/codeswitch/intent` — Phase 1 placeholder (`501`)

`normalize` and `wer` accept transcript strings up to 20,000 characters. WER
evaluation accepts at most 1,000 normalized words per transcript so an anonymous
request cannot create an unbounded edit-distance workload.

## Deterministic normalization policy

All providers will use the same `normalizeTranscript` function. It applies Unicode
NFC normalization, lowercases text, replaces every Unicode punctuation run with a
word boundary, collapses repeated whitespace, and trims. It does not translate or
rewrite Hausa, Nigerian Pidgin, or English lexical content.

## WER and empty references

WER is `(substitutions + deletions + insertions) / referenceWordCount`, using
word-level Levenshtein alignment. The implementation reports substitutions,
deletions, and insertions independently and uses a deterministic tie-break order of
substitution, deletion, then insertion when multiple minimum-cost paths exist.

If normalization leaves the reference with zero words—including an empty or
punctuation-only reference—the denominator is zero and WER is mathematically
undefined. The API returns `wer: null`, preserves the calculated edit counts, sets
`referenceWordCount: 0`, and includes `undefinedReason`. A non-empty reference with
an empty hypothesis remains defined: every reference word is a deletion and WER is
`1`.

## Proposed BenchmarkRun schema

Persistence is intentionally deferred. Phase 1 has no provider results or benchmark
submission workflow, so creating a writable MongoDB collection now would lock in
validation, retention, ownership, and privacy choices before they can be exercised.
The proposed Mongoose document shape for a later phase is:

```text
BenchmarkRun
  sampleId: String (required, indexed)
  dataset: String (required, indexed)
  languagePair: String enum [ha-en, pcm-en] (required, indexed)
  referenceTranscript: String (required)
  normalizedReference: String (required)
  modelResults: [
    provider: String
    model: String
    transcript: String
    normalizedTranscript: String
    wer: Number | null
    substitutions: Number
    deletions: Number
    insertions: Number
    latencyMs: Number
    success: Boolean
    error: String
  ]
  downstreamEvaluation:
    expectedIntent: String
    predictedIntent: String
    intentCorrect: Boolean | null
    expectedEntities: Mixed
    predictedEntities: Mixed
    taskSuccess: Boolean | null
  metadata:
    durationSeconds: Number
    cmi: Number
    switchPoints: Number
    createdAt: Date
  createdAt / updatedAt: Mongoose timestamps
```

Before persistence is enabled, Phase 2/3 should define dataset provenance, audio
and transcript retention, benchmark ownership/authentication, error redaction, and
indexes for the expected reporting queries.

## Future credentials

`.env.example` reserves `SAHARA_API_KEY`, `GEMINI_API_KEY`, and the existing
backend-only `OPENAI_API_KEY`. None is read by VoiceBridge in Phase 1, and no key is
exposed through a `VITE_` variable.
