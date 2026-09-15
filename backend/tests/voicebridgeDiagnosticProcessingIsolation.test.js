const {
  processAfricasTalkingVoiceRecording,
} = require(
  "../services/africasTalkingVoiceProcessingService"
);

const buildRecording = () => ({
  buffer: Buffer.from("fake-audio"),
  filename: "voicebridge-call.wav",
  mimeType: "audio/wav",
  byteLength: 10,
  redirectsFollowed: 0,
});

const buildTranscription = () => ({
  provider: "sahara",
  model: "sahara-v2.5",
  languageCode: "ha",
  transcript:
    "Don Allah check my payment na biya naira dubu biyar jiya amma ban samu confirmation ba.",
  processedAudioDurationSeconds: 12,
});

const buildOrchestration = () => ({
  actionCompleted: true,
  action: {
    taskSuccess: true,
    safetySuccess: true,
    intent: "payment_confirmation_check",
    requestedAction: "check_payment_status",
    executedAction: "create_payment_verification_case",
    case: {
      caseId: "VB-DIAG-TEST",
      type: "payment_verification",
      status: "queued_for_verification",
    },
    moneyMovementPerformed: false,
  },
  notification: {
    requested: false,
    attempted: false,
    delivered: false,
  },
  moneyMovementPerformed: false,
});

describe("VoiceBridge diagnostic isolation", () => {
  test("diagnostic storage failure never breaks the primary call flow", async () => {
    const result = await processAfricasTalkingVoiceRecording(
      {
        recordingUrl: "https://recordings.example.com/call.wav",
        sessionId: "AT_DIAGNOSTIC_FAILURE_SESSION",
        languagePair: "ha-en",
      },
      {
        fetchRecording: jest.fn().mockResolvedValue(buildRecording()),
        transcribe: jest.fn().mockResolvedValue(buildTranscription()),
        orchestrate: jest.fn().mockResolvedValue(buildOrchestration()),
        captureDiagnostic: jest
          .fn()
          .mockRejectedValue(new Error("diagnostic store unavailable")),
        completeDiagnostic: jest.fn(),
      }
    );

    expect(result.processingCompleted).toBe(true);
    expect(result.temporaryDiagnosticCaptured).toBe(false);
    expect(result.moneyMovementPerformed).toBe(false);
  });

  test("captured diagnostics receive the safe action summary after orchestration", async () => {
    const completeDiagnostic = jest.fn().mockResolvedValue({});

    const result = await processAfricasTalkingVoiceRecording(
      {
        recordingUrl: "https://recordings.example.com/call.wav",
        sessionId: "AT_DIAGNOSTIC_SUCCESS_SESSION",
        languagePair: "ha-en",
      },
      {
        fetchRecording: jest.fn().mockResolvedValue(buildRecording()),
        transcribe: jest.fn().mockResolvedValue(buildTranscription()),
        orchestrate: jest.fn().mockResolvedValue(buildOrchestration()),
        captureDiagnostic: jest.fn().mockResolvedValue({
          correlationId: "at-safe-hash",
        }),
        completeDiagnostic,
      }
    );

    expect(result.temporaryDiagnosticCaptured).toBe(true);
    expect(completeDiagnostic).toHaveBeenCalledTimes(1);
    expect(completeDiagnostic).toHaveBeenCalledWith(
      expect.objectContaining({
        correlationId: expect.stringMatching(/^at-[a-f0-9]{40}$/),
        orchestration: expect.objectContaining({
          actionCompleted: true,
          moneyMovementPerformed: false,
        }),
      })
    );
  });
});
