# VoiceBridge — Africa's Talking Integration

## Purpose

Africa's Talking is used as an application-channel layer for Tengacion VoiceBridge.

It is not an ASR benchmark provider.

The formal VoiceBridge benchmark remains limited to:

1. Sahara v2.5
2. OpenAI GPT-Transcribe
3. OpenAI Whisper-1
4. Google Chirp 3

Africa's Talking provides telephony and messaging transport around the VoiceBridge application workflow.

---

## Application Architecture

```text
Caller
  |
  v
Africa's Talking Voice
  |
  v
VoiceBridge
  |
  v
Existing deterministic intent/entity/action layer
  |
  v
Payment-verification/support case
  |
  +--> Optional Africa's Talking SMS status message
```

The integration must never be interpreted as a fifth speech-recognition benchmark provider.

---

## Safety Boundary

The Africa's Talking integration does not perform:

- payments
- refunds
- transfers
- wallet operations
- payouts
- arbitrary financial execution

The existing VoiceBridge action service remains the single source of truth for:

- transcript normalization
- intent extraction
- entity extraction
- action policy
- idempotency
- support-case creation

The application-channel orchestrator preserves:

```text
moneyMovementPerformed: false
```

---

## Environment Variables

Configure these values only in the deployment environment.

Never commit credentials to Git.

### Required credentials

```text
AFRICASTALKING_ENV
AFRICASTALKING_USERNAME
AFRICASTALKING_API_KEY
```

### Feature controls

```text
AFRICASTALKING_SMS_ENABLED
AFRICASTALKING_VOICE_ENABLED
```

Both features default to disabled unless explicitly enabled.

### Optional SMS sender

```text
AFRICASTALKING_SMS_SENDER_ID
```

### Voice number

```text
AFRICASTALKING_VOICE_NUMBER
```

### Public HTTPS callback origin

```text
AFRICASTALKING_CALLBACK_BASE_URL
```

Example shape:

```text
https://your-public-backend.example.com
```

Do not include the callback route path in this variable.

VoiceBridge builds the recording callback route from the configured origin.

---

## Voice Callback Endpoints

The CodeSwitch router is mounted under:

```text
/api/codeswitch
```

The Africa's Talking Voice endpoints are therefore:

### Initial Voice callback

```text
POST /api/codeswitch/africastalking/voice/callback
```

Returns Africa's Talking-compatible XML containing VoiceBridge prompts and recording instructions.

### Voice event callback

```text
POST /api/codeswitch/africastalking/voice/events
```

Acknowledges call/event metadata without echoing raw caller or session data.

### Recording callback

```text
POST /api/codeswitch/africastalking/voice/recording
```

Current Phase 8A behavior:

- accepts HTTPS recording metadata
- validates the URL
- does not fetch the remote recording
- does not download audio
- does not invoke any ASR provider
- does not execute a downstream action

This boundary is deliberate.

---

## SMS Behavior

SMS is optional.

The orchestrator sends an SMS only when:

1. the VoiceBridge downstream action has succeeded safely
2. `notifyBySms === true`
3. the recipient is a valid E.164 phone number

Example E.164 form:

```text
+2348012345678
```

A failed SMS must not make an already-created safe support case appear to have failed.

Action success and notification success are separate states.

---

## Notification Content

The SMS status message contains the VoiceBridge case identifier and states that the request is queued for verification.

It does not include the raw voice transcript.

It explicitly states that no payment, refund, transfer, wallet, or payout operation was performed.

---

## Data Minimization

The application-channel layer does not intentionally return or persist:

- raw voice transcripts
- raw recording URLs
- signed recording tokens
- raw caller phone numbers in service responses
- audio files

The downstream action service stores a transcript fingerprint instead of the raw transcript.

---

## Benchmark Isolation

Africa's Talking must never be added to:

```text
DEFAULT_PROVIDER_IDS
```

The expected provider list is exactly:

```text
sahara
openai
whisper
chirp
```

This prevents telecom transport from changing the formal ASR comparison methodology.

---

## Deployment Sequence

Before any live test:

1. deploy the committed VoiceBridge branch
2. confirm the backend has a public HTTPS origin
3. configure Africa's Talking credentials as deployment secrets
4. configure the callback base URL
5. keep Voice and SMS disabled initially
6. verify application health
7. enable the required channel deliberately
8. perform one controlled test
9. inspect only sanitized application results
10. disable the channel again if additional configuration is required

Never paste API keys into terminal transcripts, Git commits, screenshots, tickets, or benchmark artifacts.

---

## Current Verification State

Phase 8A automated coverage verifies:

- Africa's Talking client configuration
- lazy SDK initialization
- SMS validation and response normalization
- Voice XML generation
- XML escaping
- Voice callback routes
- recording URL validation
- no automatic recording download
- no automatic ASR calls from Voice callbacks
- safe VoiceBridge action orchestration
- optional SMS notification
- SMS failure isolation
- unsafe-action rejection
- no-money-movement invariant
- benchmark provider isolation

The Africa's Talking test set contains 44 passing automated tests as of Phase 8A.5.

---

## Formal Research Evidence

The frozen downstream stress-test benchmark evidence is independent of this integration.

Africa's Talking application-channel development must not mutate or overwrite:

```text
artifacts/voicebridge-benchmark/results/stress-official-v1/
```

The formal benchmark evidence should remain frozen while deployment-channel work continues.