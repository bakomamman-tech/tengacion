jest.mock("../models/AdminComplaint", () => ({
  findOne: jest.fn(),
  create: jest.fn(),
}));

const AdminComplaint =
  require("../models/AdminComplaint");

const {
  ACTION_VERSION,
  executeCodeswitchAction,
} = require(
  "../services/codeswitchActionService"
);

const makeQuery = (value) => ({
  lean: jest.fn().mockResolvedValue(value),
});

describe(
  "VoiceBridge safe action execution",
  () => {
    beforeEach(() => {
      jest.clearAllMocks();

      AdminComplaint.findOne
        .mockReturnValue(
          makeQuery(null)
        );

      AdminComplaint.create
        .mockImplementation(
          async (payload) => ({
            _id: {
              toString: () =>
                "66d8f0000000000000001234",
            },
            ...payload,
          })
        );
    });

    test(
      "creates a real payment verification support case without moving money",
      async () => {
        const result =
          await executeCodeswitchAction({
            transcript:
              "Don Allah, check my payment, na biya naira dubu biyar jiya amma ban samu confirmation ba.",
            languagePair: "ha-en",
            requestId:
              "voicebridge-demo-001",
          });

        expect(result).toEqual(
          expect.objectContaining({
            actionVersion:
              ACTION_VERSION,
            taskSuccess: true,
            safetySuccess: true,
            intent:
              "payment_confirmation_check",
            requestedAction:
              "check_payment_status",
            executedAction:
              "create_payment_verification_case",
            moneyMovementPerformed:
              false,
            idempotentReplay: false,
          })
        );

        expect(
          result.case.amount
        ).toBe(5000);

        expect(
          result.case.currency
        ).toBe("NGN");

        expect(
          result.case.timeReference
        ).toBe("yesterday");

        expect(
          result.case.caseId
        ).toMatch(
          /^VB-\d{8}-[A-F0-9]{8}$/
        );

        expect(
          AdminComplaint.create
        ).toHaveBeenCalledTimes(1);

        const payload =
          AdminComplaint.create
            .mock.calls[0][0];

        expect(payload).toEqual(
          expect.objectContaining({
            reporterId: null,
            category: "other",
            sourcePath:
              "/codeswitch",
            sourceLabel:
              "Tengacion VoiceBridge",
            priority: "medium",
            priorityScore: 200,
            status: "open",
          })
        );

        expect(
          payload.metadata
            .moneyMovementPerformed
        ).toBe(false);

        expect(
          payload.metadata
            .transcriptStored
        ).toBe(false);

        expect(
          payload.metadata.audioStored
        ).toBe(false);

        expect(
          payload.metadata
            .transcriptFingerprint
        ).toMatch(
          /^[a-f0-9]{64}$/
        );

        expect(
          JSON.stringify(payload)
        ).not.toContain(
          "Don Allah"
        );
      }
    );

    test(
      "replays an existing request idempotently instead of creating a duplicate",
      async () => {
        AdminComplaint.findOne
          .mockReturnValue(
            makeQuery({
              _id: {
                toString: () =>
                  "66d8f0000000000000005678",
              },
              status: "open",
              metadata: {
                voicebridge: true,
                voicebridgeCaseId:
                  "VB-20260904-ABCDEF12",
                voicebridgeActionRequestId:
                  "voicebridge-demo-002",
              },
            })
          );

        const result =
          await executeCodeswitchAction({
            transcript:
              "Don Allah check my payment na biya naira dubu biyar jiya amma ban samu confirmation ba",
            languagePair: "ha-en",
            requestId:
              "voicebridge-demo-002",
          });

        expect(
          result.taskSuccess
        ).toBe(true);

        expect(
          result.idempotentReplay
        ).toBe(true);

        expect(
          result.case.caseId
        ).toBe(
          "VB-20260904-ABCDEF12"
        );

        expect(
          AdminComplaint.create
        ).not.toHaveBeenCalled();
      }
    );

    test(
      "rejects reuse of a request id for a different payload",
      async () => {
        AdminComplaint.findOne
          .mockReturnValue(
            makeQuery({
              _id: {
                toString: () =>
                  "66d8f0000000000000009999",
              },
              status: "open",
              metadata: {
                voicebridge: true,
                voicebridgeCaseId:
                  "VB-20260904-11112222",
                voicebridgeActionRequestId:
                  "voicebridge-conflict-001",
                languagePair: "ha-en",
                transcriptFingerprint:
                  "0".repeat(64),
                entities: {
                  amount: 5000,
                  currency: "NGN",
                  timeReference:
                    "yesterday",
                  transactionReference:
                    null,
                },
              },
            })
          );

        await expect(
          executeCodeswitchAction({
            transcript:
              "Please check my payment today.",
            languagePair: "ha-en",
            requestId:
              "voicebridge-conflict-001",
          })
        ).rejects.toEqual(
          expect.objectContaining({
            code:
              "IDEMPOTENCY_CONFLICT",
            statusCode: 409,
          })
        );

        expect(
          AdminComplaint.create
        ).not.toHaveBeenCalled();
      }
    );

    test(
      "does not execute refund requests without explicit confirmation",
      async () => {
        await expect(
          executeCodeswitchAction({
            transcript:
              "I did not get confirmation for my payment, please refund my money.",
            languagePair: "pcm-en",
            requestId:
              "voicebridge-refund-001",
          })
        ).rejects.toEqual(
          expect.objectContaining({
            code:
              "CONFIRMATION_REQUIRED",
            statusCode: 409,
          })
        );

        expect(
          AdminComplaint.create
        ).not.toHaveBeenCalled();
      }
    );

    test(
      "does not auto-execute unknown requests",
      async () => {
        await expect(
          executeCodeswitchAction({
            transcript:
              "Hello I need somebody to help me.",
            languagePair: "ha-en",
            requestId:
              "voicebridge-unknown-001",
          })
        ).rejects.toEqual(
          expect.objectContaining({
            code:
              "MANUAL_REVIEW_REQUIRED",
            statusCode: 422,
          })
        );

        expect(
          AdminComplaint.create
        ).not.toHaveBeenCalled();
      }
    );

    test(
      "requires an idempotency request id",
      async () => {
        await expect(
          executeCodeswitchAction({
            transcript:
              "Please check my payment.",
            languagePair: "ha-en",
            requestId: "short",
          })
        ).rejects.toEqual(
          expect.objectContaining({
            code:
              "INVALID_ACTION_REQUEST_ID",
            statusCode: 400,
          })
        );

        expect(
          AdminComplaint.create
        ).not.toHaveBeenCalled();
      }
    );
  }
);