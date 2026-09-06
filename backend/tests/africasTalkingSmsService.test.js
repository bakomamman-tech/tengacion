const path =
  require("path");


const {
  AfricasTalkingServiceError,
} = require(
  "../services/africasTalkingClientService"
);

const {
  MAX_MESSAGE_CHARS,
  maskPhoneNumber,
  sendTransactionalStatus,
} = require(
  "../services/africasTalkingSmsService"
);


const enabledConfig = () => ({
  environment:
    "sandbox",

  username:
    "sandbox",

  apiKey:
    "SYNTHETIC_TEST_KEY",

  credentialsConfigured:
    true,

  sms: {
    enabled:
      true,

    ready:
      true,

    senderId:
      "Tengacion",
  },

  voice: {
    enabled:
      false,

    ready:
      false,
  },
});


describe(
  "africasTalkingSmsService",
  () => {

    test(
      "masks phone numbers",
      () => {

        const raw =
          "+2348012345678";

        const masked =
          maskPhoneNumber(
            raw
          );

        expect(
          masked
        ).not.toBe(
          raw
        );

        expect(
          masked
        ).toContain(
          "5678"
        );

        expect(
          masked
        ).toContain(
          "*"
        );
      }
    );


    test(
      "disabled SMS performs zero SDK initialization",
      async () => {

        const sdkFactory =
          jest.fn();

        const atConfig =
          enabledConfig();

        atConfig.sms.enabled =
          false;

        atConfig.sms.ready =
          false;


        await expect(
          sendTransactionalStatus(
            {
              to:
                "+2348012345678",

              message:
                "Payment status update.",
            },
            {
              atConfig,
              sdkFactory,
              useCache:
                false,
            }
          )
        ).rejects.toMatchObject({
          code:
            "AFRICASTALKING_DISABLED",
        });


        expect(
          sdkFactory
        ).not.toHaveBeenCalled();
      }
    );


    test(
      "missing credentials fail closed before SDK initialization",
      async () => {

        const sdkFactory =
          jest.fn();

        const atConfig =
          enabledConfig();

        atConfig.apiKey = "";

        atConfig.credentialsConfigured =
          false;


        await expect(
          sendTransactionalStatus(
            {
              to:
                "+2348012345678",

              message:
                "Payment status update.",
            },
            {
              atConfig,
              sdkFactory,
              useCache:
                false,
            }
          )
        ).rejects.toMatchObject({
          code:
            "AFRICASTALKING_NOT_CONFIGURED",
        });


        expect(
          sdkFactory
        ).not.toHaveBeenCalled();
      }
    );


    test.each([
      "",
      "08012345678",
      "2348012345678",
      "+0123456789",
      "+123",
      "+234ABC123",
    ])(
      "rejects invalid international phone number %p",
      async (phone) => {

        const getService =
          jest.fn();


        await expect(
          sendTransactionalStatus(
            {
              to:
                phone,

              message:
                "Status update.",
            },
            {
              getService,
              atConfig:
                enabledConfig(),
            }
          )
        ).rejects.toMatchObject({
          code:
            "AFRICASTALKING_INVALID_PHONE",
        });


        expect(
          getService
        ).not.toHaveBeenCalled();
      }
    );


    test(
      "rejects blank messages before service access",
      async () => {

        const getService =
          jest.fn();


        await expect(
          sendTransactionalStatus(
            {
              to:
                "+2348012345678",

              message:
                "   ",
            },
            {
              getService,
              atConfig:
                enabledConfig(),
            }
          )
        ).rejects.toMatchObject({
          code:
            "AFRICASTALKING_INVALID_MESSAGE",
        });


        expect(
          getService
        ).not.toHaveBeenCalled();
      }
    );


    test(
      "rejects oversized messages before service access",
      async () => {

        const getService =
          jest.fn();


        await expect(
          sendTransactionalStatus(
            {
              to:
                "+2348012345678",

              message:
                "x".repeat(
                  MAX_MESSAGE_CHARS +
                  1
                ),
            },
            {
              getService,
              atConfig:
                enabledConfig(),
            }
          )
        ).rejects.toMatchObject({
          code:
            "AFRICASTALKING_INVALID_MESSAGE",
        });


        expect(
          getService
        ).not.toHaveBeenCalled();
      }
    );


    test(
      "constructs the expected transactional SDK request",
      async () => {

        const send =
          jest.fn()
            .mockResolvedValue({
              SMSMessageData: {
                Message:
                  "Sent to 1/1 Total Cost: NGN 4.0000",

                Recipients: [
                  {
                    statusCode:
                      101,

                    number:
                      "+2348012345678",

                    status:
                      "Success",

                    cost:
                      "NGN 4.0000",

                    messageId:
                      "ATPid_test_123",
                  },
                ],
              },
            });


        const getService =
          jest.fn(
            () => ({
              send,
            })
          );


        const result =
          await sendTransactionalStatus(
            {
              to:
                "+2348012345678",

              message:
                "Your payment status is pending.",

              senderId:
                "Tengacion",
            },
            {
              getService,
              atConfig:
                enabledConfig(),
            }
          );


        expect(
          getService
        ).toHaveBeenCalledWith(
          "sms",
          expect.objectContaining({
            atConfig:
              expect.any(
                Object
              ),
          })
        );


        expect(
          send
        ).toHaveBeenCalledTimes(
          1
        );


        expect(
          send
        ).toHaveBeenCalledWith({
          to:
            "+2348012345678",

          message:
            "Your payment status is pending.",

          enqueue:
            false,

          senderId:
            "Tengacion",
        });


        expect(
          result
        ).toMatchObject({
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
            "ATPid_test_123",

          cost:
            "NGN 4.0000",

          recipientCount:
            1,

          enqueue:
            false,
        });


        expect(
          result.recipientMasked
        ).not.toBe(
          "+2348012345678"
        );
      }
    );


    test(
      "uses configured sender ID when explicit sender is absent",
      async () => {

        const send =
          jest.fn()
            .mockResolvedValue({
              SMSMessageData: {
                Recipients: [
                  {
                    statusCode:
                      101,

                    status:
                      "Success",

                    number:
                      "+2348012345678",
                  },
                ],
              },
            });


        const getService =
          jest.fn(
            () => ({
              send,
            })
          );


        await sendTransactionalStatus(
          {
            to:
              "+2348012345678",

            message:
              "Status update.",
          },
          {
            getService,
            atConfig:
              enabledConfig(),
          }
        );


        expect(
          send
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            senderId:
              "Tengacion",

            enqueue:
              false,
          })
        );
      }
    );


    test(
      "normalizes provider request failures without leaking the underlying error",
      async () => {

        const syntheticSecret =
          "SYNTHETIC_SECRET_SHOULD_NOT_LEAK";


        const send =
          jest.fn()
            .mockRejectedValue(
              new Error(
                `Provider failure ${syntheticSecret}`
              )
            );


        const getService =
          jest.fn(
            () => ({
              send,
            })
          );


        let capturedError =
          null;


        try {

          await sendTransactionalStatus(
            {
              to:
                "+2348012345678",

              message:
                "Status update.",
            },
            {
              getService,
              atConfig:
                enabledConfig(),
            }
          );

        } catch (error) {

          capturedError =
            error;
        }


        expect(
          capturedError
        ).toBeInstanceOf(
          AfricasTalkingServiceError
        );


        expect(
          capturedError.code
        ).toBe(
          "AFRICASTALKING_REQUEST_FAILED"
        );


        expect(
          capturedError.message
        ).not.toContain(
          syntheticSecret
        );


        expect(
          JSON.stringify(
            capturedError
          )
        ).not.toContain(
          syntheticSecret
        );
      }
    );


    test(
      "logs masked metadata only",
      async () => {

        const rawPhone =
          "+2348012345678";

        const rawMessage =
          "Sensitive payment status message";


        const send =
          jest.fn()
            .mockResolvedValue({
              SMSMessageData: {
                Recipients: [
                  {
                    statusCode:
                      101,

                    number:
                      rawPhone,

                    status:
                      "Success",

                    messageId:
                      "ATPid_safe_test",
                  },
                ],
              },
            });


        const logger = {
          info:
            jest.fn(),

          warn:
            jest.fn(),
        };


        await sendTransactionalStatus(
          {
            to:
              rawPhone,

            message:
              rawMessage,
          },
          {
            getService:
              () => ({
                send,
              }),

            atConfig:
              enabledConfig(),

            logger,
          }
        );


        expect(
          logger.info
        ).toHaveBeenCalledTimes(
          1
        );


        const serializedLog =
          JSON.stringify(
            logger.info.mock.calls
          );


        expect(
          serializedLog
        ).not.toContain(
          rawPhone
        );


        expect(
          serializedLog
        ).not.toContain(
          rawMessage
        );


        expect(
          serializedLog
        ).toContain(
          "sms_request_completed"
        );
      }
    );
  }
);