const {
  listTemporaryTranscripts,
  getTemporaryTranscriptById,
  deleteTemporaryTranscript,
} = require("../services/voicebridgeTranscriptDiagnosticService");

const VALID_ID = "64b000000000000000000001";

const makeListQuery = (documents) => {
  const query = {
    sort: jest.fn(() => query),
    limit: jest.fn(() => query),
    select: jest.fn(() => query),
    lean: jest.fn().mockResolvedValue(documents),
  };
  return query;
};

describe("VoiceBridge admin diagnostic privacy", () => {
  test("recent-call list omits exact transcript and private correlation id", async () => {
    const document = {
      _id: VALID_ID,
      correlationId: "at-private-hash",
      transcript: "Don Allah check my payment",
      channel: "africastalking-voice",
      languagePair: "ha-en",
      provider: "sahara",
      model: "sahara-v2.5",
      processedAudioDurationSeconds: 20,
      actionCompleted: true,
      intent: "payment_confirmation_check",
      requestedAction: "check_payment_status",
      executedAction: "create_payment_verification_case",
      caseId: "VB-DEMO",
      createdAt: new Date("2026-09-15T12:00:00.000Z"),
      expiresAt: new Date("2026-09-15T12:30:00.000Z"),
    };
    const query = makeListQuery([document]);
    const DiagnosticModel = { find: jest.fn().mockReturnValue(query) };

    const result = await listTemporaryTranscripts(
      { limit: 50 },
      {
        DiagnosticModel,
        now: () => new Date("2026-09-15T12:10:00.000Z"),
      }
    );

    expect(result).toHaveLength(1);
    expect(result[0]).not.toHaveProperty("transcript");
    expect(result[0]).not.toHaveProperty("correlationId");
    expect(result[0]).toMatchObject({
      id: VALID_ID,
      languagePair: "ha-en",
      intent: "payment_confirmation_check",
      caseId: "VB-DEMO",
      moneyMovementPerformed: false,
    });
  });

  test("exact transcript is returned only by deliberate reveal lookup", async () => {
    const DiagnosticModel = {
      findOne: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          _id: VALID_ID,
          transcript: "Don Allah check my payment",
          channel: "africastalking-voice",
          languagePair: "ha-en",
          provider: "sahara",
          model: "sahara-v2.5",
          actionCompleted: true,
          moneyMovementPerformed: false,
          createdAt: new Date("2026-09-15T12:00:00.000Z"),
          expiresAt: new Date("2026-09-15T12:30:00.000Z"),
        }),
      }),
    };

    const result = await getTemporaryTranscriptById(VALID_ID, {
      DiagnosticModel,
      now: () => new Date("2026-09-15T12:10:00.000Z"),
    });

    expect(result.transcript).toBe("Don Allah check my payment");
    expect(DiagnosticModel.findOne).toHaveBeenCalledWith({
      _id: VALID_ID,
      expiresAt: { $gt: new Date("2026-09-15T12:10:00.000Z") },
    });
  });

  test("invalid ids fail closed without querying or deleting", async () => {
    const DiagnosticModel = {
      findOne: jest.fn(),
      deleteOne: jest.fn(),
    };

    await expect(
      getTemporaryTranscriptById("not-an-id", { DiagnosticModel })
    ).resolves.toBeNull();
    await expect(
      deleteTemporaryTranscript("not-an-id", { DiagnosticModel })
    ).resolves.toEqual({ deletedCount: 0 });

    expect(DiagnosticModel.findOne).not.toHaveBeenCalled();
    expect(DiagnosticModel.deleteOne).not.toHaveBeenCalled();
  });
});
