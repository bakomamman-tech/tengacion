const {
  SAHARA_STATUS_URL,
  SAHARA_SYNC_URL,
  SaharaServiceError,
  transcribeWithSahara,
} = require("../services/saharaService");

const TEST_API_KEY = "test-sahara-key-never-return";
const AUDIO_BUFFER = Buffer.from("RIFF0000WAVEvoicebridge");
const quietDiagnosticLogger = () => {};

const providerPayload = ({
  fileId = "file-123",
  status = "FILE_TRANSCRIBED",
  transcript = "Please check my order!",
  duration = 8.2,
  includeTranscript = true,
} = {}) => ({
  data: {
    file_id: fileId,
    processing_status: status,
    audio_file_name: "support.wav",
    ...(includeTranscript ? { audio_transcript: transcript } : {}),
    processed_audio_duration_in_seconds: duration,
  },
  message: "file status found",
  status: "Ok",
});

const jsonResponse = (status, payload, headers = {}) =>
  new Response(payload === null ? "" : JSON.stringify(payload), { status, headers });

const transcribe = (dependencies = {}, input = {}) =>
  transcribeWithSahara(
    {
      buffer: AUDIO_BUFFER,
      filename: "support.wav",
      mimeType: "audio/wav",
      languageCode: "ha",
      ...input,
    },
    {
      apiKey: TEST_API_KEY,
      pollDelayMs: 1,
      pollMaxAttempts: 3,
      pollTimeoutMs: 5000,
      requestTimeoutMs: 5000,
      wait: async () => {},
      diagnosticLogger: quietDiagnosticLogger,
      ...dependencies,
    }
  );

describe("Sahara transcription adapter", () => {
  test("requires a server-side Sahara API key", async () => {
    await expect(transcribe({ apiKey: "", fetchImpl: jest.fn() })).rejects.toMatchObject({
      code: "SAHARA_NOT_CONFIGURED",
      statusCode: 503,
    });
  });

  test("rejects unsupported upstream language codes", async () => {
    await expect(
      transcribe({ fetchImpl: jest.fn() }, { languageCode: "en" })
    ).rejects.toMatchObject({
      code: "SAHARA_UNSUPPORTED_LANGUAGE",
      statusCode: 400,
    });
  });

  test("constructs the exact benchmark-mode multipart request and normalizes the result", async () => {
    const fetchImpl = jest.fn().mockResolvedValue(
      jsonResponse(200, providerPayload())
    );
    const now = jest.fn()
      .mockReturnValueOnce(1000)
      .mockReturnValueOnce(2234);

    const result = await transcribe({ fetchImpl, now });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe(SAHARA_SYNC_URL);
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({ Authorization: `Bearer ${TEST_API_KEY}` });
    expect(init.headers).not.toHaveProperty("Content-Type");
    expect(init.body).toBeInstanceOf(FormData);
    expect([...init.body.keys()]).toEqual([
      "audio_file_name",
      "audio_file_blob",
      "use_language_asr_input",
      "use_disable_llm_corrections",
    ]);
    expect(init.body.get("audio_file_name")).toBe("support.wav");
    expect(init.body.get("use_language_asr_input")).toBe("ha");
    expect(init.body.get("use_disable_llm_corrections")).toBe("TRUE");

    const upstreamFile = init.body.get("audio_file_blob");
    expect(upstreamFile.name).toBe("support.wav");
    expect(upstreamFile.type).toBe("audio/wav");
    expect(Buffer.from(await upstreamFile.arrayBuffer())).toEqual(AUDIO_BUFFER);

    expect(result).toEqual({
      provider: "sahara",
      model: "sahara-v2.5",
      languageCode: "ha",
      transcript: "Please check my order!",
      normalizedTranscript: "please check my order",
      normalizationVersion: "voicebridge-nwer-v1",
      latencyMs: 1234,
      providerFileId: "file-123",
      processedAudioDurationSeconds: 8.2,
      processingStatus: "FILE_TRANSCRIBED",
      benchmarkMode: true,
      llmCorrectionsDisabled: true,
    });
    expect(Number.isFinite(result.latencyMs)).toBe(true);
    expect(JSON.stringify(result)).not.toContain(TEST_API_KEY);
  });

  test("logs only the approved safe metadata for every sync response", async () => {
    const transcript = "Unique transcript contents must stay private.";
    const payload = providerPayload({ transcript, duration: 20 });
    payload.message = `private provider message ${TEST_API_KEY}`;
    payload.apiKey = TEST_API_KEY;
    payload.data.Authorization = `Bearer ${TEST_API_KEY}`;
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse(200, payload));
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});

    try {
      await transcribe({ fetchImpl, diagnosticLogger: undefined });

      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0][0]).toBe(
        "[voicebridge:sahara] sync response diagnostics"
      );

      const serializedDiagnostics = warn.mock.calls[0][1];
      const diagnostics = JSON.parse(serializedDiagnostics);
      expect(Object.keys(diagnostics)).toEqual([
        "httpStatus",
        "topLevelKeys",
        "dataKeys",
        "providerStatus",
        "processingStatus",
        "hasFileId",
        "hasAudioTranscript",
        "audioTranscriptLength",
        "processedAudioDurationInSeconds",
      ]);
      expect(diagnostics).toEqual({
        httpStatus: 200,
        topLevelKeys: ["data", "message", "status"],
        dataKeys: [
          "file_id",
          "processing_status",
          "audio_file_name",
          "audio_transcript",
          "processed_audio_duration_in_seconds",
        ],
        providerStatus: "Ok",
        processingStatus: "FILE_TRANSCRIBED",
        hasFileId: true,
        hasAudioTranscript: true,
        audioTranscriptLength: transcript.length,
        processedAudioDurationInSeconds: 20,
      });
      expect(serializedDiagnostics).not.toContain(TEST_API_KEY);
      expect(serializedDiagnostics).not.toContain(transcript);
      expect(serializedDiagnostics).not.toContain("private provider message");
      expect(serializedDiagnostics).not.toContain("Bearer");
    } finally {
      warn.mockRestore();
    }
  });

  test("redacts an echoed API key before diagnostic status truncation", async () => {
    const longApiKey = `sahara-secret-${"x".repeat(120)}`;
    const payload = providerPayload();
    payload.status = `status-${longApiKey}`;
    payload.data.processing_status = `processing-${longApiKey}`;
    const diagnosticLogger = jest.fn();
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse(200, payload));

    await expect(
      transcribe({ apiKey: longApiKey, fetchImpl, diagnosticLogger })
    ).rejects.toMatchObject({
      code: "SAHARA_MALFORMED_RESPONSE",
      statusCode: 502,
    });

    expect(diagnosticLogger).toHaveBeenCalledTimes(1);
    expect(diagnosticLogger.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        providerStatus: "[REDACTED]",
        processingStatus: "[REDACTED]",
      })
    );
    const serializedDiagnostics = JSON.stringify(diagnosticLogger.mock.calls[0][0]);
    expect(serializedDiagnostics).not.toContain(longApiKey);
    expect(serializedDiagnostics).not.toContain(longApiKey.slice(0, 80));
  });

  test.each([
    [400, "SAHARA_REJECTED_REQUEST", 400],
    [401, "SAHARA_AUTH_FAILED", 502],
    [403, "SAHARA_AUTH_FAILED", 502],
    [429, "SAHARA_RATE_LIMITED", 429],
    [503, "SAHARA_UNAVAILABLE", 503],
  ])(
    "maps upstream HTTP %s without exposing provider internals",
    async (upstreamStatus, code, statusCode) => {
      const headers = upstreamStatus === 429 ? { "Retry-After": "9" } : {};
      const fetchImpl = jest.fn().mockResolvedValue(
        jsonResponse(upstreamStatus, { message: `private ${TEST_API_KEY}` }, headers)
      );

      let caught;
      try {
        await transcribe({ fetchImpl });
      } catch (error) {
        caught = error;
      }

      expect(caught).toBeInstanceOf(SaharaServiceError);
      expect(caught).toMatchObject({ code, statusCode, upstreamStatus });
      if (upstreamStatus === 429) {
        expect(caught.retryAfterSeconds).toBe(9);
      }
      expect(caught.message).not.toContain(TEST_API_KEY);
    }
  );

  test.each([
    [200, "FILE_QUEUED"],
    [200, "FILE_PENDING"],
    [200, "FILE_PROCESSING"],
    [503, "FILE_QUEUED"],
    [503, "FILE_PENDING"],
    [503, "FILE_PROCESSING"],
  ])(
    "polls HTTP %s sync responses with %s and a valid file id",
    async (httpStatus, processingStatus) => {
      const fetchImpl = jest
        .fn()
        .mockResolvedValueOnce(
          jsonResponse(
            httpStatus,
            providerPayload({ status: processingStatus, includeTranscript: false })
          )
        )
        .mockResolvedValueOnce(jsonResponse(200, providerPayload()));

      const result = await transcribe({ fetchImpl });

      expect(fetchImpl).toHaveBeenCalledTimes(2);
      expect(fetchImpl.mock.calls[1][0]).toBe(`${SAHARA_STATUS_URL}/file-123`);
      expect(result.processingStatus).toBe("FILE_TRANSCRIBED");
    }
  );

  test("polls a valid file id after 503 until FILE_TRANSCRIBED", async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(503, providerPayload({ status: "FILE_PROCESSING", includeTranscript: false }))
      )
      .mockResolvedValueOnce(
        jsonResponse(503, providerPayload({ status: "FILE_QUEUED", includeTranscript: false }))
      )
      .mockResolvedValueOnce(
        jsonResponse(200, providerPayload({ transcript: "Don Allah, duba oda na." }))
      );
    const wait = jest.fn().mockResolvedValue(undefined);

    const result = await transcribe({ fetchImpl, wait });

    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(fetchImpl.mock.calls[1][0]).toBe(`${SAHARA_STATUS_URL}/file-123`);
    expect(fetchImpl.mock.calls[2][0]).toBe(`${SAHARA_STATUS_URL}/file-123`);
    expect(fetchImpl.mock.calls[1][1]).toEqual(
      expect.objectContaining({
        method: "GET",
        headers: { Authorization: `Bearer ${TEST_API_KEY}` },
      })
    );
    expect(wait).toHaveBeenCalledTimes(1);
    expect(result).toEqual(
      expect.objectContaining({
        transcript: "Don Allah, duba oda na.",
        normalizedTranscript: "don allah duba oda na",
        providerFileId: "file-123",
        processingStatus: "FILE_TRANSCRIBED",
      })
    );
  });

  test("stops polling when Sahara reports FILE_PROCESSING_FAILED", async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(503, providerPayload({ status: "FILE_PROCESSING", includeTranscript: false }))
      )
      .mockResolvedValueOnce(
        jsonResponse(200, providerPayload({ status: "FILE_PROCESSING_FAILED", includeTranscript: false }))
      );

    await expect(transcribe({ fetchImpl })).rejects.toMatchObject({
      code: "SAHARA_PROCESSING_FAILED",
      statusCode: 502,
      providerFileId: "file-123",
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  test.each([200, 503])(
    "treats FILE_PROCESSING_FAILED from an HTTP %s sync response as an explicit failure",
    async (httpStatus) => {
      const fetchImpl = jest.fn().mockResolvedValue(
        jsonResponse(
          httpStatus,
          providerPayload({
            status: "FILE_PROCESSING_FAILED",
            includeTranscript: false,
          })
        )
      );

      await expect(transcribe({ fetchImpl })).rejects.toMatchObject({
        code: "SAHARA_PROCESSING_FAILED",
        statusCode: 502,
        providerFileId: "file-123",
      });
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    }
  );

  test("accepts a completed HTTP 503 sync response with a non-empty transcript", async () => {
    const fetchImpl = jest.fn().mockResolvedValue(
      jsonResponse(503, providerPayload({ transcript: "Completed despite HTTP status." }))
    );

    await expect(transcribe({ fetchImpl })).resolves.toEqual(
      expect.objectContaining({
        transcript: "Completed despite HTTP status.",
        processingStatus: "FILE_TRANSCRIBED",
      })
    );
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  test("bounds status polling by the configured maximum attempts", async () => {
    const pending = providerPayload({
      status: "FILE_PROCESSING",
      includeTranscript: false,
    });
    const fetchImpl = jest.fn().mockImplementation(async () => jsonResponse(200, pending));
    fetchImpl
      .mockResolvedValueOnce(jsonResponse(503, pending))
      .mockImplementation(async () => jsonResponse(200, pending));

    await expect(
      transcribe({ fetchImpl, pollMaxAttempts: 2 })
    ).rejects.toMatchObject({
      code: "SAHARA_POLL_TIMEOUT",
      statusCode: 504,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  test("bounds status polling by elapsed fallback time", async () => {
    const pending = providerPayload({
      status: "FILE_PROCESSING",
      includeTranscript: false,
    });
    const fetchImpl = jest.fn().mockResolvedValueOnce(jsonResponse(503, pending));
    const now = jest.fn()
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(1000);

    await expect(
      transcribe({ fetchImpl, now, pollTimeoutMs: 1000 })
    ).rejects.toMatchObject({
      code: "SAHARA_POLL_TIMEOUT",
      statusCode: 504,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  test.each([
    ["missing", { includeTranscript: false }],
    ["empty", { transcript: "" }],
    ["whitespace-only", { transcript: "   " }],
  ])(
    "treats a %s transcript on FILE_TRANSCRIBED as an explicit empty-transcript error",
    async (_caseName, payloadOptions) => {
      const fetchImpl = jest.fn().mockResolvedValue(
        jsonResponse(200, providerPayload(payloadOptions))
      );

      await expect(transcribe({ fetchImpl })).rejects.toMatchObject({
        code: "SAHARA_EMPTY_TRANSCRIPT",
        statusCode: 502,
        providerFileId: "file-123",
      });
    }
  );

  test.each([200, 503])(
    "rejects an HTTP %s in-progress response without a valid file id",
    async (httpStatus) => {
      const fetchImpl = jest.fn().mockResolvedValue(
        jsonResponse(
          httpStatus,
          providerPayload({
            fileId: "",
            status: "FILE_PROCESSING",
            includeTranscript: false,
          })
        )
      );

      await expect(transcribe({ fetchImpl })).rejects.toMatchObject({
        code: "SAHARA_MALFORMED_RESPONSE",
        statusCode: 502,
      });
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    }
  );

  test("rejects an unknown HTTP 200 provider response shape safely", async () => {
    const fetchImpl = jest.fn().mockResolvedValue(
      jsonResponse(200, { data: { file_id: "file-123" }, status: "Ok" })
    );

    await expect(transcribe({ fetchImpl })).rejects.toMatchObject({
      code: "SAHARA_MALFORMED_RESPONSE",
      statusCode: 502,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  test("does not poll an unknown HTTP 503 provider response shape", async () => {
    const fetchImpl = jest.fn().mockResolvedValue(
      jsonResponse(503, { data: { file_id: "file-123" }, status: "Error" })
    );

    await expect(transcribe({ fetchImpl })).rejects.toMatchObject({
      code: "SAHARA_UNAVAILABLE",
      statusCode: 503,
      upstreamStatus: 503,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  test("maps network aborts to a safe timeout error", async () => {
    const timeout = Object.assign(new Error("request aborted"), { name: "AbortError" });
    const fetchImpl = jest.fn().mockRejectedValue(timeout);

    await expect(transcribe({ fetchImpl })).rejects.toMatchObject({
      code: "SAHARA_TIMEOUT",
      statusCode: 504,
    });
  });
});
