const {
  getCaptureStatus,
  enableCapture,
  disableCapture,
  captureTemporaryTranscript,
  completeTemporaryTranscript,
} = require(
  "../services/voicebridgeTranscriptDiagnosticService"
);

const makeLeanResult = (value) => ({
  lean: jest.fn().mockResolvedValue(value),
});

describe("VoiceBridge temporary transcript diagnostics", () => {
  afterEach(() => {
    disableCapture();
  });

  test("is off by default and stores nothing when disabled", async () => {
    disableCapture();
    const DiagnosticModel = {
      findOneAndUpdate: jest.fn(),
    };

    const result = await captureTemporaryTranscript(
      {
        transcript: "Don Allah check my payment",
        languagePair: "ha-en",
        correlationId: "at-test-disabled",
      },
      {
        DiagnosticModel,
        now: () => new Date("2026-09-15T12:00:00.000Z"),
      }
    );

    expect(result).toBeNull();
    expect(DiagnosticModel.findOneAndUpdate).not.toHaveBeenCalled();
    expect(getCaptureStatus().active).toBe(false);
  });

  test("captures exact transcript for 30 minutes without raw caller metadata", async () => {
    enableCapture(30);
    const createdAt = new Date("2026-09-15T12:00:00.000Z");
    const stored = {
      _id: "diag-1",
      correlationId: "at-hashed-correlation",
      expiresAt: new Date("2026-09-15T12:30:00.000Z"),
    };
    const DiagnosticModel = {
      findOneAndUpdate: jest.fn().mockReturnValue(makeLeanResult(stored)),
    };

    await captureTemporaryTranscript(
      {
        transcript:
          "Don Allah check my payment, na biya naira dubu biyar jiya amma ban samu confirmation ba.",
        languagePair: "ha-en",
        correlationId: "at-hashed-correlation",
        transcription: {
          provider: "sahara",
          model: "sahara-v2.5",
          processedAudioDurationSeconds: 20,
        },
      },
      {
        DiagnosticModel,
        now: () => createdAt,
      }
    );

    const update = DiagnosticModel.findOneAndUpdate.mock.calls[0][1];
    expect(update.$setOnInsert.transcript).toBe(
      "Don Allah check my payment, na biya naira dubu biyar jiya amma ban samu confirmation ba."
    );
    expect(update.$setOnInsert.expiresAt.toISOString()).toBe(
      "2026-09-15T12:30:00.000Z"
    );
    expect(update.$setOnInsert).not.toHaveProperty("phoneNumber");
    expect(update.$setOnInsert).not.toHaveProperty("sessionId");
    expect(update.$setOnInsert).not.toHaveProperty("recordingUrl");
    expect(update.$setOnInsert).not.toHaveProperty("audio");
  });

  test("records only the safe downstream action summary", async () => {
    const DiagnosticModel = {
      findOneAndUpdate: jest.fn().mockReturnValue(
        makeLeanResult({ correlationId: "at-safe" })
      ),
    };

    await completeTemporaryTranscript(
      {
        correlationId: "at-safe",
        orchestration: {
          actionCompleted: true,
          action: {
            intent: "payment_confirmation_check",
            requestedAction: "check_payment_status",
            executedAction: "create_payment_verification_case",
            case: { caseId: "VB-20260915-DEMO" },
          },
          moneyMovementPerformed: false,
        },
      },
      { DiagnosticModel }
    );

    const update = DiagnosticModel.findOneAndUpdate.mock.calls[0][1].$set;
    expect(update).toEqual({
      actionCompleted: true,
      intent: "payment_confirmation_check",
      requestedAction: "check_payment_status",
      executedAction: "create_payment_verification_case",
      caseId: "VB-20260915-DEMO",
      moneyMovementPerformed: false,
    });
  });
});
