const express = require("express");
const request = require("supertest");

jest.mock("../services/saharaService", () => {
  const actual = jest.requireActual("../services/saharaService");
  return { ...actual, transcribeWithSahara: jest.fn() };
});

const errorHandler = require("../middleware/errorHandler");
const codeswitchRoutes = require("../routes/codeswitch");
const {
  SaharaServiceError,
  transcribeWithSahara,
} = require("../services/saharaService");

const app = express();
app.use(express.json());
app.use("/api/codeswitch", codeswitchRoutes);
app.use(errorHandler);

const validWav = Buffer.concat([
  Buffer.from("RIFF"),
  Buffer.alloc(4),
  Buffer.from("WAVEfmt "),
]);

const completedTranscription = (overrides = {}) => ({
  provider: "sahara",
  model: "sahara-v2.5",
  languageCode: "ha",
  transcript: "Don Allah, check my order!",
  normalizedTranscript: "don allah check my order",
  normalizationVersion: "voicebridge-nwer-v1",
  latencyMs: 842,
  providerFileId: "file_ha_123",
  processedAudioDurationSeconds: 3.2,
  processingStatus: "FILE_TRANSCRIBED",
  benchmarkMode: true,
  llmCorrectionsDisabled: true,
  ...overrides,
});

describe("VoiceBridge CodeSwitch routes", () => {
  beforeEach(() => {
    transcribeWithSahara.mockReset();
    jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("reports Phase 2 health", async () => {
    const response = await request(app).get("/api/codeswitch/health").expect(200);

    expect(response.body).toEqual({
      ok: true,
      service: "Tengacion VoiceBridge",
      phase: 2,
    });
    expect(response.headers["cache-control"]).toBe("no-store");
  });

  test("normalizes a transcript through the versioned Phase 1 API", async () => {
    const response = await request(app)
      .post("/api/codeswitch/normalize")
      .send({ text: "Please check my order!" })
      .expect(200);

    expect(response.body).toEqual({
      original: "Please check my order!",
      normalized: "please check my order",
      normalizationVersion: "voicebridge-nwer-v1",
    });
  });

  test("calculates the mandatory normalized WER through the API", async () => {
    const response = await request(app)
      .post("/api/codeswitch/wer")
      .send({
        reference: "Please check my order!",
        hypothesis: "please check my order",
      })
      .expect(200);

    expect(response.body).toEqual({
      wer: 0,
      substitutions: 0,
      deletions: 0,
      insertions: 0,
      referenceWordCount: 4,
      normalizedReference: "please check my order",
      normalizedHypothesis: "please check my order",
      normalizationVersion: "voicebridge-nwer-v1",
    });
  });

  test("returns an explicit undefined-WER response for an empty reference", async () => {
    const response = await request(app)
      .post("/api/codeswitch/wer")
      .send({ reference: "!!!", hypothesis: "hello" })
      .expect(200);

    expect(response.body).toEqual(
      expect.objectContaining({
        wer: null,
        insertions: 1,
        referenceWordCount: 0,
        normalizationVersion: "voicebridge-nwer-v1",
        undefinedReason: expect.stringMatching(/requires at least one reference word/i),
      })
    );
  });

  test("rejects missing or non-string transcript fields", async () => {
    await request(app)
      .post("/api/codeswitch/normalize")
      .send({})
      .expect(400, { error: "text must be a string." });

    await request(app)
      .post("/api/codeswitch/wer")
      .send({ reference: "hello", hypothesis: 42 })
      .expect(400, { error: "hypothesis must be a string." });
  });

  test.each([
    ["ha-en", "ha"],
    ["pcm-en", "pcm"],
  ])("maps %s to Sahara language code %s", async (languagePair, languageCode) => {
    transcribeWithSahara.mockResolvedValueOnce(
      completedTranscription({ languageCode })
    );

    const response = await request(app)
      .post("/api/codeswitch/transcribe")
      .field("languagePair", languagePair)
      .attach("audio", validWav, {
        filename: "support.wav",
        contentType: "audio/wav",
      })
      .expect(200);

    expect(transcribeWithSahara).toHaveBeenCalledWith({
      buffer: expect.any(Buffer),
      filename: "support.wav",
      mimeType: "audio/wav",
      languageCode,
    });
    expect(response.body).toEqual({
      ok: true,
      ...completedTranscription({ languageCode }),
      languagePair,
    });
    expect(response.headers["cache-control"]).toBe("no-store");
  });

  test("rejects an unsupported language pair before calling Sahara", async () => {
    const response = await request(app)
      .post("/api/codeswitch/transcribe")
      .field("languagePair", "yo-en")
      .attach("audio", validWav, {
        filename: "support.wav",
        contentType: "audio/wav",
      })
      .expect(400);

    expect(response.body.error).toEqual({
      code: "UNSUPPORTED_LANGUAGE_PAIR",
      message: "languagePair must be one of: ha-en, pcm-en.",
    });
    expect(transcribeWithSahara).not.toHaveBeenCalled();
  });

  test("requires an audio upload", async () => {
    const response = await request(app)
      .post("/api/codeswitch/transcribe")
      .send({ languagePair: "ha-en" })
      .expect(400);

    expect(response.body.error).toEqual({
      code: "AUDIO_REQUIRED",
      message: "An audio file is required in the audio field.",
    });
    expect(transcribeWithSahara).not.toHaveBeenCalled();
  });

  test("returns a safe rate-limit response with retry guidance", async () => {
    transcribeWithSahara.mockRejectedValueOnce(
      new SaharaServiceError(
        "SAHARA_RATE_LIMITED",
        "Sahara is rate limited. Try the transcription again later.",
        { statusCode: 429, upstreamStatus: 429, retryAfterSeconds: 17 }
      )
    );

    const response = await request(app)
      .post("/api/codeswitch/transcribe")
      .field("languagePair", "ha-en")
      .attach("audio", validWav, {
        filename: "support.wav",
        contentType: "audio/wav",
      })
      .expect(429);

    expect(response.headers["retry-after"]).toBe("17");
    expect(response.body).toEqual({
      ok: false,
      error: {
        code: "SAHARA_RATE_LIMITED",
        message: "Sahara is rate limited. Try the transcription again later.",
      },
      retryAfterSeconds: 17,
    });
  });

  test.each(["benchmark", "intent"])(
    "keeps /%s as a clear Phase 2 placeholder",
    async (endpoint) => {
      const response = await request(app)
        .post(`/api/codeswitch/${endpoint}`)
        .send({})
        .expect(501);

      expect(response.body).toEqual({
        ok: false,
        service: "Tengacion VoiceBridge",
        phase: 2,
        endpoint,
        integrationEnabled: false,
        message:
          "Multi-model benchmarking and downstream agent integrations are not enabled in Phase 2.",
      });
    }
  );
});
