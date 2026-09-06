const {
  VoicebridgeOrchestratorError,
  isValidE164Phone,
  buildStatusMessage,
  runVoicebridgeChannelOrchestration,
} = require(
  "../services/africasTalkingVoicebridgeOrchestrator"
);


const SAFE_TRANSCRIPT =
  "I sent ten thousand naira yesterday, please check the payment status.";

const SAFE_LANGUAGE_PAIR =
  "pcm-en";

const SAFE_REQUEST_ID =
  "voicebridge-test-request-001";


const createSafeActionResult = (
  overrides = {}
) => ({
  actionVersion:
    "voicebridge-action-v1",

  taskSuccess:
    true,

  safetySuccess:
    true,

  intent:
    "payment_status",

  requestedAction:
    "check_payment_status",

  executedAction:
    "create_payment_verification_case",

  case: {
    caseId:
      "VB-20260906-TEST1234",

    recordId:
      "record-test-001",

    type:
      "payment_verification",

    status:
      "queued_for_verification",

    supportRecordStatus:
      "open",

    amount:
      10000,

    currency:
      "NGN",

    timeReference:
      "yesterday",

    transactionReference:
      null,
  },

  moneyMovementPerformed:
    false,

  idempotentReplay:
    false,

  message:
    "Payment verification case created.",

  ...overrides,
});


describe(
  "africasTalkingVoicebridgeOrchestrator",
  () => {

    test(
      "validates E.164 phone numbers",
      () => {

        expect(
          isValidE164Phone(
            "+2348012345678"
          )
        ).toBe(
          true
        );

        expect(
          isValidE164Phone(
            "08012345678"
          )
        ).toBe(
          false
        );

        expect(
          isValidE164Phone(
            "+0123456789"
          )
        ).toBe(
          false
        );
      }
    );


    test(
      "builds a safe status message without transcript content",
      () => {

        const actionResult =
          createSafeActionResult();

        const message =
          buildStatusMessage(
            actionResult
          );


        expect(
          message
        ).toContain(
          "VB-20260906-TEST1234"
        );

        expect(
          message
        ).toContain(
          "queued for verification"
        );

        expect(
          message
        ).toContain(
          "No payment, refund, transfer, wallet, or payout operation was performed."
        );

        expect(
          message
        ).not.toContain(
          SAFE_TRANSCRIPT
        );
      }
    );


    test(
      "completes safe action with no SMS when notification is not requested",
      async () => {

        const executeAction =
          jest.fn()
            .mockResolvedValue(
              createSafeActionResult()
            );

        const sendSms =
          jest.fn();


        const result =
          await runVoicebridgeChannelOrchestration(
            {
              transcript:
                SAFE_TRANSCRIPT,

              languagePair:
                SAFE_LANGUAGE_PAIR,

              requestId:
                SAFE_REQUEST_ID,

              notifyBySms:
                false,

              phoneNumber:
                "+2348012345678",
            },
            {
              executeAction,
              sendSms,
            }
          );


        expect(
          executeAction
        ).toHaveBeenCalledTimes(
          1
        );

        expect(
          executeAction
        ).toHaveBeenCalledWith({
          transcript:
            SAFE_TRANSCRIPT,

          languagePair:
            SAFE_LANGUAGE_PAIR,

          requestId:
            SAFE_REQUEST_ID,
        });


        expect(
          sendSms
        ).not.toHaveBeenCalled();


        expect(
          result
        ).toMatchObject({
          channel:
            "africastalking",

          source:
            "voicebridge-transcript",

          actionCompleted:
            true,

          notification: {
            requested:
              false,

            attempted:
              false,

            delivered:
              false,
          },

          transcriptReturned:
            false,

          transcriptStoredByOrchestrator:
            false,

          audioStoredByOrchestrator:
            false,

          moneyMovementPerformed:
            false,
        });


        expect(
          JSON.stringify(
            result
          )
        ).not.toContain(
          SAFE_TRANSCRIPT
        );
      }
    );


    test(
      "sends SMS only after successful safe action when explicitly requested",
      async () => {

        const executeAction =
          jest.fn()
            .mockResolvedValue(
              createSafeActionResult()
            );

        const sendSms =
          jest.fn()
            .mockResolvedValue({
              provider:
                "africastalking",

              channel:
                "sms",

              accepted:
                true,

              statusCode:
                101,

              status:
                "Success",

              messageId:
                "ATPid_orchestrator_test",

              recipientMasked:
                "+23480*****678",
            });


        const result =
          await runVoicebridgeChannelOrchestration(
            {
              transcript:
                SAFE_TRANSCRIPT,

              languagePair:
                SAFE_LANGUAGE_PAIR,

              requestId:
                SAFE_REQUEST_ID,

              notifyBySms:
                true,

              phoneNumber:
                "+2348012345678",
            },
            {
              executeAction,
              sendSms,
            }
          );


        expect(
          executeAction
        ).toHaveBeenCalledTimes(
          1
        );


        expect(
          sendSms
        ).toHaveBeenCalledTimes(
          1
        );


        expect(
          sendSms
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            to:
              "+2348012345678",

            message:
              expect.stringContaining(
                "VB-20260906-TEST1234"
              ),
          })
        );


        const smsPayload =
          sendSms.mock.calls[0][0];


        expect(
          smsPayload.message
        ).not.toContain(
          SAFE_TRANSCRIPT
        );


        expect(
          result
        ).toMatchObject({
          actionCompleted:
            true,

          notification: {
            requested:
              true,

            attempted:
              true,

            delivered:
              true,

            accepted:
              true,

            statusCode:
              101,

            status:
              "Success",

            messageId:
              "ATPid_orchestrator_test",
          },

          moneyMovementPerformed:
            false,
        });


        expect(
          JSON.stringify(
            result
          )
        ).not.toContain(
          SAFE_TRANSCRIPT
        );
      }
    );


    test(
      "invalid phone does not call SMS and does not undo successful action",
      async () => {

        const executeAction =
          jest.fn()
            .mockResolvedValue(
              createSafeActionResult()
            );

        const sendSms =
          jest.fn();


        const result =
          await runVoicebridgeChannelOrchestration(
            {
              transcript:
                SAFE_TRANSCRIPT,

              languagePair:
                SAFE_LANGUAGE_PAIR,

              requestId:
                SAFE_REQUEST_ID,

              notifyBySms:
                true,

              phoneNumber:
                "08012345678",
            },
            {
              executeAction,
              sendSms,
            }
          );


        expect(
          executeAction
        ).toHaveBeenCalledTimes(
          1
        );


        expect(
          sendSms
        ).not.toHaveBeenCalled();


        expect(
          result
        ).toMatchObject({
          actionCompleted:
            true,

          notification: {
            requested:
              true,

            attempted:
              false,

            delivered:
              false,

            accepted:
              false,

            errorCode:
              "INVALID_SMS_RECIPIENT",
          },

          moneyMovementPerformed:
            false,
        });
      }
    );


    test(
      "SMS provider failure remains separate from successful action",
      async () => {

        const executeAction =
          jest.fn()
            .mockResolvedValue(
              createSafeActionResult()
            );

        const providerError =
          new Error(
            "Provider failed with SYNTHETIC_SMS_SECRET"
          );

        providerError.code =
          "AFRICASTALKING_REQUEST_FAILED";


        const sendSms =
          jest.fn()
            .mockRejectedValue(
              providerError
            );


        const result =
          await runVoicebridgeChannelOrchestration(
            {
              transcript:
                SAFE_TRANSCRIPT,

              languagePair:
                SAFE_LANGUAGE_PAIR,

              requestId:
                SAFE_REQUEST_ID,

              notifyBySms:
                true,

              phoneNumber:
                "+2348012345678",
            },
            {
              executeAction,
              sendSms,
            }
          );


        expect(
          result
        ).toMatchObject({
          actionCompleted:
            true,

          action: {
            taskSuccess:
              true,

            safetySuccess:
              true,

            moneyMovementPerformed:
              false,
          },

          notification: {
            requested:
              true,

            attempted:
              true,

            delivered:
              false,

            accepted:
              false,

            errorCode:
              "AFRICASTALKING_REQUEST_FAILED",
          },

          moneyMovementPerformed:
            false,
        });


        const serialized =
          JSON.stringify(
            result
          );


        expect(
          serialized
        ).not.toContain(
          "SYNTHETIC_SMS_SECRET"
        );

        expect(
          serialized
        ).not.toContain(
          SAFE_TRANSCRIPT
        );
      }
    );


    test(
      "rejected downstream action never attempts SMS",
      async () => {

        const actionError =
          new Error(
            "Unsafe action rejected."
          );

        actionError.code =
          "MANUAL_REVIEW_REQUIRED";

        actionError.statusCode =
          422;


        const executeAction =
          jest.fn()
            .mockRejectedValue(
              actionError
            );

        const sendSms =
          jest.fn();


        await expect(
          runVoicebridgeChannelOrchestration(
            {
              transcript:
                SAFE_TRANSCRIPT,

              languagePair:
                SAFE_LANGUAGE_PAIR,

              requestId:
                SAFE_REQUEST_ID,

              notifyBySms:
                true,

              phoneNumber:
                "+2348012345678",
            },
            {
              executeAction,
              sendSms,
            }
          )
        ).rejects.toMatchObject({
          name:
            "VoicebridgeOrchestratorError",

          code:
            "MANUAL_REVIEW_REQUIRED",

          statusCode:
            422,

          causeCode:
            "MANUAL_REVIEW_REQUIRED",
        });


        expect(
          sendSms
        ).not.toHaveBeenCalled();
      }
    );


    test(
      "future action result claiming money movement fails closed before SMS",
      async () => {

        const executeAction =
          jest.fn()
            .mockResolvedValue(
              createSafeActionResult({
                moneyMovementPerformed:
                  true,
              })
            );

        const sendSms =
          jest.fn();


        await expect(
          runVoicebridgeChannelOrchestration(
            {
              transcript:
                SAFE_TRANSCRIPT,

              languagePair:
                SAFE_LANGUAGE_PAIR,

              requestId:
                SAFE_REQUEST_ID,

              notifyBySms:
                true,

              phoneNumber:
                "+2348012345678",
            },
            {
              executeAction,
              sendSms,
            }
          )
        ).rejects.toMatchObject({
          name:
            "VoicebridgeOrchestratorError",

          code:
            "UNSAFE_ACTION_RESULT",

          statusCode:
            500,
        });


        expect(
          sendSms
        ).not.toHaveBeenCalled();
      }
    );


    test(
      "invalid notification flag fails before downstream action",
      async () => {

        const executeAction =
          jest.fn();

        const sendSms =
          jest.fn();


        await expect(
          runVoicebridgeChannelOrchestration(
            {
              transcript:
                SAFE_TRANSCRIPT,

              languagePair:
                SAFE_LANGUAGE_PAIR,

              requestId:
                SAFE_REQUEST_ID,

              notifyBySms:
                "yes",

              phoneNumber:
                "+2348012345678",
            },
            {
              executeAction,
              sendSms,
            }
          )
        ).rejects.toBeInstanceOf(
          VoicebridgeOrchestratorError
        );


        expect(
          executeAction
        ).not.toHaveBeenCalled();

        expect(
          sendSms
        ).not.toHaveBeenCalled();
      }
    );


    test(
      "provider non-acceptance is reported without changing action success",
      async () => {

        const executeAction =
          jest.fn()
            .mockResolvedValue(
              createSafeActionResult()
            );

        const sendSms =
          jest.fn()
            .mockResolvedValue({
              accepted:
                false,

              statusCode:
                401,

              status:
                "Rejected",

              recipientMasked:
                "+23480*****678",
            });


        const result =
          await runVoicebridgeChannelOrchestration(
            {
              transcript:
                SAFE_TRANSCRIPT,

              languagePair:
                SAFE_LANGUAGE_PAIR,

              requestId:
                SAFE_REQUEST_ID,

              notifyBySms:
                true,

              phoneNumber:
                "+2348012345678",
            },
            {
              executeAction,
              sendSms,
            }
          );


        expect(
          result.actionCompleted
        ).toBe(
          true
        );


        expect(
          result.notification
        ).toMatchObject({
          requested:
            true,

          attempted:
            true,

          delivered:
            false,

          accepted:
            false,

          errorCode:
            "SMS_NOT_ACCEPTED",
        });


        expect(
          result.moneyMovementPerformed
        ).toBe(
          false
        );
      }
    );
  }
);