# Tengacion VoiceBridge - Phase 2 Sahara STT

VoiceBridge Phase 2 connects only the Sahara/Intron synchronous speech-to-text
provider. The Phase 1 normalization and normalized word error rate (WER) APIs are
preserved and now identify their policy as `voicebridge-nwer-v1`. Gemini, OpenAI,
multi-model benchmarking, and downstream agent execution remain unimplemented.

## Architecture

The browser sends a multipart request to the Tengacion backend. The backend keeps
the uploaded file in Multer memory storage, validates its extension, MIME type, and
container signature, maps the canonical language pair, and calls Sahara with the
server-only credential.

```text
/codeswitch UI
  -> POST /api/codeswitch/transcribe
  -> in-memory upload validation
  -> Sahara sync adapter
       POST /file/v1/upload/sync
       optional bounded GET /file/v1/status/{file_id} fallback
  -> voicebridge-nwer-v1 normalization
  -> result returned to the browser
```

No provider/model choice is sent upstream. Phase 2 always identifies the result as
provider `sahara` and model `sahara-v2.5`. The adapter sends:

- `audio_file_name`
- `audio_file_blob`
- `use_language_asr_input` as `ha` or `pcm`
- `use_disable_llm_corrections=TRUE`

The canonical UI/API mappings are `ha-en -> ha` and `pcm-en -> pcm`.

Official provider endpoints used by the adapter:

- `POST https://infer.voice.intron.io/file/v1/upload/sync`
- `GET https://infer.voice.intron.io/file/v1/status/{file_id}` for the bounded
  `503` fallback

## Configuration

Put the real credential in the repository-root `.env` for local development or in
the deployment platform's backend environment. Never prefix it with `VITE_`, place
it in frontend code, commit it, or paste it into browser requests.

```dotenv
SAHARA_API_KEY=replace-with-a-real-server-side-key
SAHARA_REQUEST_TIMEOUT_MS=135000
SAHARA_POLL_TIMEOUT_MS=30000
SAHARA_POLL_DELAY_MS=1500
SAHARA_POLL_MAX_ATTEMPTS=12
```

Only `SAHARA_API_KEY` is required. The bounded timeout and polling values above are
the defaults documented in `.env.example`. A missing key affects only the Sahara
transcription endpoint, which returns a controlled `503`; it does not prevent the
rest of Tengacion from starting.

## API contract

`POST /api/codeswitch/transcribe` accepts multipart form data:

- `audio`: one WAV, MP3, MP4, M4A, OGG, WebM, or FLAC file, no larger than 25MB
- `languagePair`: exactly `ha-en` or `pcm-en`

The successful response includes the original and normalized transcripts,
normalization version, provider/model labels, language pair/code, end-to-end
provider latency, provider file id when supplied, processed audio duration when
supplied, processing status, and the benchmark-mode flags.

The adapter uses the official synchronous upload endpoint. If that endpoint returns
`503` with a valid `file_id`, it polls the official status endpoint within both a
maximum-attempt and elapsed-time bound. `FILE_QUEUED`, `FILE_PENDING`, and
`FILE_PROCESSING` continue polling; `FILE_TRANSCRIBED` succeeds;
`FILE_PROCESSING_FAILED` fails safely. Unknown or malformed status data is rejected.

Provider failures are converted to controlled responses. Invalid provider requests
return `400`; rate limits return `429` and forward a safe numeric `Retry-After` value;
temporary unavailability returns `503`; request/poll timeouts return `504`; provider
authentication and other upstream failures return a safe `502`. Provider response
bodies and credentials are never returned to the client.

`POST /api/codeswitch/normalize` and `POST /api/codeswitch/wer` remain available.
Both expose `normalizationVersion: "voicebridge-nwer-v1"`. If the optional reference
transcript is supplied in the UI, the Sahara transcript is scored through the same
WER endpoint. Without a reference, the UI explicitly says that WER requires one.

## Privacy and data handling

- Audio is accepted only into process memory and is not intentionally written to
  disk, object storage, or a database by VoiceBridge.
- Audio is sent to Sahara/Intron for transcription. Only upload recordings you are
  authorized to process and avoid sensitive recordings in this prototype.
- Transcription responses use `Cache-Control: no-store`.
- Operational logs contain safe metadata such as error code, status, extension, and
  file size. They do not contain audio bytes, transcripts, provider response bodies,
  authorization headers, or the API key.
- Result persistence and a writable `BenchmarkRun` model remain deferred until
  retention, consent, ownership, and deletion policies are approved.

## Limits

VoiceBridge enforces a 25MB request limit and verifies the supported container
signature instead of trusting only the filename or browser MIME type. Sahara's
synchronous API limit is 120 seconds of audio; the provider enforces duration because
the prototype does not decode every supported media container locally.

Browser recording remains disabled. Only Sahara is live; the Gemini and OpenAI cards
continue to show `Not integrated`, and aggregate benchmark/downstream task fields are
still placeholders.

## Local verification without a committed secret

1. Copy the Sahara variables from `.env.example` into the repository-root `.env` and
   set a real `SAHARA_API_KEY` locally.
2. Start the backend with `npm run dev --prefix backend` and the frontend with
   `npm run dev --prefix frontend`.
3. Open `/codeswitch`, select Hausa-English or Nigerian Pidgin-English, choose an
   authorized sample no longer than 120 seconds, optionally paste its reference
   transcript, and select **Transcribe with Sahara**.
4. Confirm the Sahara card shows the original transcript, normalized transcript,
   `voicebridge-nwer-v1`, provider status, and latency. With a reference, also confirm
   WER plus substitution/deletion/insertion counts. Confirm Gemini/OpenAI still say
   `Not integrated`.
5. Repeat with the other language mapping.

For each run, capture the filename, selected language pair, original transcript,
normalized transcript, `latencyMs`, processed duration, and provider status from the
response before comparing the two authorized samples.

The backend can also be exercised directly from PowerShell after it starts:

```powershell
curl.exe -X POST http://localhost:5000/api/codeswitch/transcribe `
  -F "languagePair=ha-en" `
  -F "audio=@C:\samples\authorized-hausa.wav;type=audio/wav"

curl.exe -X POST http://localhost:5000/api/codeswitch/transcribe `
  -F "languagePair=pcm-en" `
  -F "audio=@C:\samples\authorized-pidgin.wav;type=audio/wav"
```

Do not put `SAHARA_API_KEY` in these commands; the backend adds it server-side.

Automated tests mock every Sahara response and therefore require no real credential
or network call. The focused suites cover exact multipart fields, both language
mappings, raw benchmark mode, success metadata, `400`/`401`/`403`/`429`/`503`, status
polling, failed processing, timeouts, malformed responses, upload validation, UI
loading/results, optional WER, and safe errors.
