const express = require("express");
const request = require("supertest");

jest.mock("../services/saharaService", () => {
  const actual = jest.requireActual("../services/saharaService");
  return { ...actual, transcribeWithSahara: jest.fn() };
});

jest.mock("../services/openAiCodeswitchService", () => {
  const actual = jest.requireActual("../services/openAiCodeswitchService");
  return { ...actual, transcribeWithOpenAI: jest.fn() };
});

jest.mock("../services/whisperCodeswitchService", () => {
  const actual = jest.requireActual("../services/whisperCodeswitchService");
  return { ...actual, transcribeWithWhisper: jest.fn() };
});

jest.mock("../services/chirpCodeswitchService", () => {
  const actual = jest.requireActual("../services/chirpCodeswitchService");
  return { ...actual, transcribeWithChirp: jest.fn() };
});

jest.mock("../services/codeswitchActionService", () => {
  const actual = jest.requireActual("../services/codeswitchActionService");
  return {
    ...actual,
    executeCodeswitchAction: jest.fn(),
  };
});

const errorHandler = require("../middleware/errorHandler");
const codeswitchRoutes = require("../routes/codeswitch");
const {
  SaharaServiceError,
  transcribeWithSahara,
} = require("../services/saharaService");

const {
  transcribeWithOpenAI,
} = require("../services/openAiCodeswitchService");

const {
  transcribeWithWhisper,
} = require("../services/whisperCodeswitchService");

const {
  transcribeWithChirp,
} = require("../services/chirpCodeswitchService");

const {
  CodeswitchActionError,
  executeCodeswitchAction,
} = require("../services/codeswitchActionService");

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

const completedOpenAiTranscription = (overrides = {}) => ({
  provider: "openai",
  model: "gpt-transcribe",
  transcript: "Don Allah, check my order!",
  normalizedTranscript: "don allah check my order",
  normalizationVersion: "voicebridge-nwer-v1",
  latencyMs: 420,
  processingStatus: "FILE_TRANSCRIBED",
  benchmarkMode: true,
  ...overrides,
});

const completedWhisperTranscription = (overrides = {}) => ({
  provider: "whisper",
  model: "whisper-1",
  transcript: "Don Allah, check my order!",
  normalizedTranscript: "don allah check my order",
  normalizationVersion: "voicebridge-nwer-v1",
  latencyMs: 510,
  processingStatus: "FILE_TRANSCRIBED",
  benchmarkMode: true,
  ...overrides,
});

const completedChirpTranscription = (overrides = {}) => ({
  provider: "chirp",
  vendor: "google-cloud",
  model: "chirp_3",
  transcript: "Don Allah, check my order!",
  normalizedTranscript: "don allah check my order",
  normalizationVersion: "voicebridge-nwer-v1",
  latencyMs: 620,
  detectedLanguageCodes: ["ha"],
  processingStatus: "FILE_TRANSCRIBED",
  benchmarkMode: true,
  automaticLanguageDetection: true,
  ...overrides,
});

describe("VoiceBridge CodeSwitch routes", () => {
  beforeEach(() => {
    transcribeWithSahara.mockReset();
    transcribeWithOpenAI.mockReset();
    transcribeWithWhisper.mockReset();
    transcribeWithChirp.mockReset();
    executeCodeswitchAction.mockReset();
    jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("reports Phase 3 health", async () => {
    const response = await request(app).get("/api/codeswitch/health").expect(200);

    expect(response.body).toEqual({
      ok: true,
      service: "Tengacion VoiceBridge",
      phase: 3,
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

  test("benchmarks Sahara, GPT-Transcribe, Whisper, and Chirp from the same uploaded audio", async () => {
    transcribeWithSahara.mockResolvedValueOnce(completedTranscription());
    transcribeWithOpenAI.mockResolvedValueOnce(completedOpenAiTranscription());
    transcribeWithWhisper.mockResolvedValueOnce(completedWhisperTranscription());
    transcribeWithChirp.mockResolvedValueOnce(completedChirpTranscription());

    const response = await request(app)
      .post("/api/codeswitch/benchmark")
      .field("languagePair", "ha-en")
      .field("referenceTranscript", "Don Allah, check my order!")
      .attach("audio", validWav, {
        filename: "support.wav",
        contentType: "audio/wav",
      })
      .expect(200);

    expect(transcribeWithSahara).toHaveBeenCalledTimes(1);
    expect(transcribeWithOpenAI).toHaveBeenCalledTimes(1);
    expect(transcribeWithWhisper).toHaveBeenCalledTimes(1);
    expect(transcribeWithChirp).toHaveBeenCalledTimes(1);

    const saharaArgs = transcribeWithSahara.mock.calls[0][0];
    const openAiArgs = transcribeWithOpenAI.mock.calls[0][0];
    const whisperArgs = transcribeWithWhisper.mock.calls[0][0];
    const chirpArgs = transcribeWithChirp.mock.calls[0][0];

    expect(saharaArgs.buffer).toBe(openAiArgs.buffer);
    expect(saharaArgs.buffer).toBe(whisperArgs.buffer);
    expect(saharaArgs.buffer).toBe(chirpArgs.buffer);

    expect(response.body).toEqual(
      expect.objectContaining({
        ok: true,
        service: "Tengacion VoiceBridge",
        phase: 3,
        languagePair: "ha-en",
        normalizationVersion: "voicebridge-nwer-v1",
        benchmarkMode: true,
        sameSourceAudio: true,
        successfulModels: 4,
        requestedModels: 4,
      })
    );

    expect(response.body.models).toHaveLength(4);

    expect(response.body.models[0]).toEqual(
      expect.objectContaining({
        ok: true,
        provider: "sahara",
        evaluation: expect.objectContaining({ wer: 0 }),
      })
    );

    expect(response.body.models[1]).toEqual(
      expect.objectContaining({
        ok: true,
        provider: "openai",
        evaluation: expect.objectContaining({ wer: 0 }),
      })
    );

    expect(response.body.models[2]).toEqual(
      expect.objectContaining({
        ok: true,
        provider: "whisper",
        evaluation: expect.objectContaining({ wer: 0 }),
      })
    );

    expect(response.body.models[3]).toEqual(
      expect.objectContaining({
        ok: true,
        provider: "chirp",
        evaluation: expect.objectContaining({ wer: 0 }),
      })
    );

    expect(response.body.models[0].providerFileId).toBeUndefined();
  });

  test(
    "adds downstream task-success evaluation to the four-model benchmark",
    async () => {
      const transcript =
        "Don Allah check my payment na biya naira dubu biyar jiya amma ban samu confirmation ba";

      const normalizedTranscript =
        "don allah check my payment na biya naira dubu biyar jiya amma ban samu confirmation ba";

      transcribeWithSahara
        .mockResolvedValueOnce(
          completedTranscription({
            transcript,
            normalizedTranscript,
          })
        );

      transcribeWithOpenAI
        .mockResolvedValueOnce(
          completedOpenAiTranscription({
            transcript,
            normalizedTranscript,
          })
        );

      transcribeWithWhisper
        .mockResolvedValueOnce(
          completedWhisperTranscription({
            transcript,
            normalizedTranscript,
          })
        );

      transcribeWithChirp
        .mockResolvedValueOnce(
          completedChirpTranscription({
            transcript,
            normalizedTranscript,
          })
        );

      const downstreamGold = {
        intent:
          "payment_confirmation_check",
        requestedAction:
          "check_payment_status",
        entities: {
          amount: 5000,
          currency: "NGN",
          timeReference:
            "yesterday",
          transactionReference:
            null,
        },
      };

      const response =
        await request(app)
          .post(
            "/api/codeswitch/benchmark"
          )
          .field(
            "languagePair",
            "ha-en"
          )
          .field(
            "referenceTranscript",
            transcript
          )
          .field(
            "downstreamGold",
            JSON.stringify(
              downstreamGold
            )
          )
          .attach(
            "audio",
            validWav,
            {
              filename:
                "support.wav",
              contentType:
                "audio/wav",
            }
          )
          .expect(200);

      expect(
        response.body
          .downstreamEvaluation
      ).toEqual(
        expect.objectContaining({
          evaluationVersion:
            "voicebridge-downstream-eval-v1",
          evaluationOnly:
            true,
          databaseWritesPerformed:
            false,
          moneyMovementPerformed:
            false,
          requestedModels:
            4,
          evaluatedModels:
            4,
        })
      );

      expect(
        response.body
          .downstreamEvaluation
          .summary
      ).toEqual({
        modelCompletionRate:
          1,
        intentAccuracy:
          1,
        requestedActionAccuracy:
          1,
        entityExactMatchRate:
          1,
        taskSuccessCount:
          4,
        taskSuccessRate:
          1,
      });
    }
  );

  test(
    "rejects malformed downstream benchmark gold before calling providers",
    async () => {
      const response =
        await request(app)
          .post(
            "/api/codeswitch/benchmark"
          )
          .field(
            "languagePair",
            "ha-en"
          )
          .field(
            "downstreamGold",
            "{not-valid-json"
          )
          .attach(
            "audio",
            validWav,
            {
              filename:
                "support.wav",
              contentType:
                "audio/wav",
            }
          )
          .expect(400);

      expect(
        response.body.error
      ).toEqual({
        code:
          "INVALID_DOWNSTREAM_GOLD_JSON",
        message:
          "downstreamGold must contain valid JSON.",
      });

      expect(
        transcribeWithSahara
      ).not.toHaveBeenCalled();

      expect(
        transcribeWithOpenAI
      ).not.toHaveBeenCalled();

      expect(
        transcribeWithWhisper
      ).not.toHaveBeenCalled();

      expect(
        transcribeWithChirp
      ).not.toHaveBeenCalled();
    }
  );

  test("extracts Hausa-English payment intent and entities through the API", async () => {
    const response = await request(app)
      .post("/api/codeswitch/intent")
      .send({
        languagePair: "ha-en",
        transcript:
          "Don Allah, check my payment, na biya naira dubu biyar jiya amma ban samu confirmation ba.",
      })
      .expect(200);

    expect(response.headers["cache-control"])
      .toBe("no-store");

    expect(response.body).toEqual(
      expect.objectContaining({
        ok: true,
        service: "Tengacion VoiceBridge",
        phase: 3,
        integrationEnabled: true,
        intentVersion:
          "voicebridge-intent-v1",
        languagePair: "ha-en",
        intent:
          "payment_confirmation_check",
        requestedAction:
          "check_payment_status",
        entities: {
          amount: 5000,
          currency: "NGN",
          timeReference: "yesterday",
          transactionReference: null,
        },
      })
    );

    expect(
      response.body.actionPolicy
        .moneyMovementAllowed
    ).toBe(false);

    expect(response.body.execution).toEqual({
      attempted: false,
      moneyMovementPerformed: false,
      message:
        "Intent and entities extracted. No downstream action was executed.",
    });
  });

  test("keeps refund requests in support-only mode", async () => {
    const response = await request(app)
      .post("/api/codeswitch/intent")
      .send({
        languagePair: "pcm-en",
        transcript:
          "I did not get confirmation for my payment, please refund my money.",
      })
      .expect(200);

    expect(response.body.intent).toBe(
      "refund_request"
    );

    expect(
      response.body.requestedAction
    ).toBe(
      "prepare_refund_support_case"
    );

    expect(
      response.body.actionPolicy
        .moneyMovementAllowed
    ).toBe(false);

    expect(
      response.body.actionPolicy
        .manualReviewRequired
    ).toBe(true);

    expect(
      response.body.execution
        .moneyMovementPerformed
    ).toBe(false);
  });

  test("rejects unsupported language pairs on the intent endpoint", async () => {
    const response = await request(app)
      .post("/api/codeswitch/intent")
      .send({
        languagePair: "yo-en",
        transcript:
          "Please check my payment.",
      })
      .expect(400);

    expect(response.body.error).toEqual({
      code: "UNSUPPORTED_LANGUAGE_PAIR",
      message:
        "languagePair must be one of: ha-en, pcm-en.",
    });
  });

  test("requires a transcript on the intent endpoint", async () => {
    const response = await request(app)
      .post("/api/codeswitch/intent")
      .send({
        languagePair: "ha-en",
      })
      .expect(400);

    expect(response.body.error).toEqual({
      code: "INVALID_TRANSCRIPT",
      message:
        "transcript must be a string.",
    });
  });

  test("creates a safe payment verification case through the action API", async () => {
    executeCodeswitchAction
      .mockResolvedValueOnce({
        actionVersion:
          "voicebridge-action-v1",
        taskSuccess: true,
        safetySuccess: true,
        intent:
          "payment_confirmation_check",
        requestedAction:
          "check_payment_status",
        executedAction:
          "create_payment_verification_case",
        case: {
          caseId:
            "VB-20260904-ABCDEF12",
          recordId:
            "66d8f0000000000000001234",
          type:
            "payment_verification",
          status:
            "queued_for_verification",
          supportRecordStatus:
            "open",
          amount: 5000,
          currency: "NGN",
          timeReference:
            "yesterday",
          transactionReference:
            null,
        },
        moneyMovementPerformed:
          false,
        idempotentReplay: false,
        message:
          "Payment verification case VB-20260904-ABCDEF12 created successfully.",
      });

    const response =
      await request(app)
        .post(
          "/api/codeswitch/action"
        )
        .send({
          languagePair: "ha-en",
          transcript:
            "Don Allah, check my payment, na biya naira dubu biyar jiya amma ban samu confirmation ba.",
          requestId:
            "voicebridge-http-demo-001",
        })
        .expect(201);

    expect(
      executeCodeswitchAction
    ).toHaveBeenCalledWith({
      languagePair: "ha-en",
      transcript:
        "Don Allah, check my payment, na biya naira dubu biyar jiya amma ban samu confirmation ba.",
      requestId:
        "voicebridge-http-demo-001",
    });

    expect(
      response.headers["cache-control"]
    ).toBe("no-store");

    expect(response.body).toEqual(
      expect.objectContaining({
        ok: true,
        service:
          "Tengacion VoiceBridge",
        phase: 3,
        integrationEnabled: true,
        taskSuccess: true,
        safetySuccess: true,
        executedAction:
          "create_payment_verification_case",
        moneyMovementPerformed:
          false,
        idempotentReplay: false,
      })
    );

    expect(
      response.body.case.caseId
    ).toBe(
      "VB-20260904-ABCDEF12"
    );
  });

  test("returns 200 for an idempotent action replay", async () => {
    executeCodeswitchAction
      .mockResolvedValueOnce({
        actionVersion:
          "voicebridge-action-v1",
        taskSuccess: true,
        safetySuccess: true,
        intent:
          "payment_confirmation_check",
        requestedAction:
          "check_payment_status",
        executedAction:
          "create_payment_verification_case",
        case: {
          caseId:
            "VB-20260904-ABCDEF12",
          recordId:
            "66d8f0000000000000001234",
          type:
            "payment_verification",
          status:
            "queued_for_verification",
          supportRecordStatus:
            "open",
          amount: 5000,
          currency: "NGN",
          timeReference:
            "yesterday",
          transactionReference:
            null,
        },
        moneyMovementPerformed:
          false,
        idempotentReplay: true,
        message:
          "Payment verification case VB-20260904-ABCDEF12 already exists for this request.",
      });

    const response =
      await request(app)
        .post(
          "/api/codeswitch/action"
        )
        .send({
          languagePair: "ha-en",
          transcript:
            "Please check my payment.",
          requestId:
            "voicebridge-http-demo-002",
        })
        .expect(200);

    expect(
      response.body.idempotentReplay
    ).toBe(true);

    expect(
      response.body
        .moneyMovementPerformed
    ).toBe(false);
  });

  test("returns a safe confirmation-required response for refund requests", async () => {
    executeCodeswitchAction
      .mockRejectedValueOnce(
        new CodeswitchActionError(
          "CONFIRMATION_REQUIRED",
          "This request requires explicit confirmation and manual review before any support action is created.",
          {
            statusCode: 409,
            analysis: {
              requestedAction:
                "prepare_refund_support_case",
              actionPolicy: {
                mode:
                  "support_case_only",
                moneyMovementAllowed:
                  false,
                requiresConfirmation:
                  true,
                manualReviewRequired:
                  true,
              },
            },
          }
        )
      );

    const response =
      await request(app)
        .post(
          "/api/codeswitch/action"
        )
        .send({
          languagePair: "pcm-en",
          transcript:
            "Please refund my payment.",
          requestId:
            "voicebridge-refund-http-001",
        })
        .expect(409);

    expect(response.body.ok)
      .toBe(false);

    expect(
      response.body.error.code
    ).toBe(
      "CONFIRMATION_REQUIRED"
    );

    expect(
      response.body
        .moneyMovementPerformed
    ).toBe(false);

    expect(
      response.body.actionPolicy
        .manualReviewRequired
    ).toBe(true);
  });

  test("rejects unsupported language pairs before executing an action", async () => {
    const response =
      await request(app)
        .post(
          "/api/codeswitch/action"
        )
        .send({
          languagePair: "yo-en",
          transcript:
            "Please check my payment.",
          requestId:
            "voicebridge-http-invalid-001",
        })
        .expect(400);

    expect(
      response.body.error.code
    ).toBe(
      "UNSUPPORTED_LANGUAGE_PAIR"
    );

    expect(
      executeCodeswitchAction
    ).not.toHaveBeenCalled();
  });

  test("requires a transcript before executing an action", async () => {
    const response =
      await request(app)
        .post(
          "/api/codeswitch/action"
        )
        .send({
          languagePair: "ha-en",
          requestId:
            "voicebridge-http-invalid-002",
        })
        .expect(400);

    expect(
      response.body.error.code
    ).toBe(
      "INVALID_TRANSCRIPT"
    );

    expect(
      executeCodeswitchAction
    ).not.toHaveBeenCalled();
  });

});
