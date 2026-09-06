const {
  config,
} = require("../config/env");

const {
  AfricasTalkingServiceError,
  getAfricasTalkingService,
} = require("./africasTalkingClientService");


const SERVICE_VERSION =
  "voicebridge-africastalking-sms-v1";

const MAX_MESSAGE_CHARS =
  480;

const E164_PATTERN =
  /^\+[1-9]\d{7,14}$/;

const SENDER_ID_PATTERN =
  /^[A-Za-z0-9_-]{1,32}$/;


const toText = (value) =>
  typeof value === "string"
    ? value.trim()
    : value == null
      ? ""
      : String(value).trim();


const maskPhoneNumber = (
  value
) => {

  const phone =
    toText(value);

  if (!phone) {
    return "";
  }

  if (phone.length <= 8) {
    return "***";
  }

  const hiddenCount =
    Math.max(
      4,
      phone.length - 8
    );

  return (
    phone.slice(0, 4) +
    "*".repeat(
      hiddenCount
    ) +
    phone.slice(-4)
  );
};


const validatePhoneNumber = (
  value
) => {

  const phone =
    toText(value);

  if (
    !E164_PATTERN.test(
      phone
    )
  ) {
    throw new AfricasTalkingServiceError(
      "AFRICASTALKING_INVALID_PHONE",
      "SMS recipient must use international E.164 format.",
      {
        statusCode: 400,
      }
    );
  }

  return phone;
};


const validateMessage = (
  value
) => {

  const message =
    toText(value);

  if (!message) {
    throw new AfricasTalkingServiceError(
      "AFRICASTALKING_INVALID_MESSAGE",
      "SMS message must not be empty.",
      {
        statusCode: 400,
      }
    );
  }

  if (
    message.length >
    MAX_MESSAGE_CHARS
  ) {
    throw new AfricasTalkingServiceError(
      "AFRICASTALKING_INVALID_MESSAGE",
      `SMS message must not exceed ${MAX_MESSAGE_CHARS} characters.`,
      {
        statusCode: 400,
      }
    );
  }

  return message;
};


const resolveSenderId = (
  explicitSenderId,
  atConfig
) => {

  const senderId =
    toText(
      explicitSenderId
    ) ||
    toText(
      atConfig?.sms?.senderId
    );

  if (!senderId) {
    return "";
  }

  if (
    !SENDER_ID_PATTERN.test(
      senderId
    )
  ) {
    throw new AfricasTalkingServiceError(
      "AFRICASTALKING_INVALID_SENDER_ID",
      "Africa's Talking SMS sender ID is invalid.",
      {
        statusCode: 400,
      }
    );
  }

  return senderId;
};


const normalizeStatusCode = (
  value
) => {

  const parsed =
    Number(value);

  return Number.isFinite(
    parsed
  )
    ? parsed
    : null;
};


const normalizeSmsResponse = (
  response,
  {
    requestedTo,
  } = {}
) => {

  const messageData =
    response?.SMSMessageData &&
    typeof response.SMSMessageData ===
      "object"
      ? response.SMSMessageData
      : {};

  const recipients =
    Array.isArray(
      messageData.Recipients
    )
      ? messageData.Recipients
      : [];

  const requested =
    toText(
      requestedTo
    );

  const recipient =
    recipients.find(
      (entry) =>
        toText(
          entry?.number
        ) === requested
    ) ||
    recipients[0] ||
    {};

  const statusCode =
    normalizeStatusCode(
      recipient.statusCode
    );

  const status =
    toText(
      recipient.status
    );

  const accepted =
    statusCode === 101 ||
    /^success$/i.test(
      status
    );

  return {
    version:
      SERVICE_VERSION,

    provider:
      "africastalking",

    channel:
      "sms",

    accepted,

    statusCode,

    status,

    messageId:
      toText(
        recipient.messageId
      ),

    cost:
      toText(
        recipient.cost
      ),

    recipientMasked:
      maskPhoneNumber(
        recipient.number ||
        requested
      ),

    recipientCount:
      recipients.length,

    enqueue:
      false,
  };
};


const sendTransactionalStatus =
  async (
    {
      to,
      message,
      senderId,
    } = {},
    dependencies = {}
  ) => {

    const phone =
      validatePhoneNumber(
        to
      );

    const normalizedMessage =
      validateMessage(
        message
      );

    const atConfig =
      dependencies.atConfig ||
      config.africasTalking ||
      {};

    const normalizedSenderId =
      resolveSenderId(
        senderId,
        atConfig
      );

    const getService =
      typeof dependencies.getService ===
        "function"
        ? dependencies.getService
        : getAfricasTalkingService;

    const logger =
      dependencies.logger &&
      typeof dependencies.logger ===
        "object"
        ? dependencies.logger
        : null;

    let sms;

    try {

      sms =
        getService(
          "sms",
          {
            atConfig,

            sdkFactory:
              dependencies.sdkFactory,

            useCache:
              dependencies.useCache !==
                false,
          }
        );

    } catch (error) {

      if (
        error instanceof
          AfricasTalkingServiceError
      ) {
        throw error;
      }

      throw new AfricasTalkingServiceError(
        "AFRICASTALKING_SERVICE_UNAVAILABLE",
        "Africa's Talking SMS service is unavailable.",
        {
          statusCode: 503,
        }
      );
    }


    if (
      !sms ||
      typeof sms.send !==
        "function"
    ) {
      throw new AfricasTalkingServiceError(
        "AFRICASTALKING_SERVICE_UNAVAILABLE",
        "Africa's Talking SMS service is unavailable.",
        {
          statusCode: 503,
        }
      );
    }


    const request = {
      to:
        phone,

      message:
        normalizedMessage,

      enqueue:
        false,
    };


    if (normalizedSenderId) {
      request.senderId =
        normalizedSenderId;
    }


    let response;

    try {

      response =
        await sms.send(
          request
        );

    } catch {

      if (
        typeof logger?.warn ===
        "function"
      ) {
        logger.warn(
          "[voicebridge-africastalking-sms]",
          {
            event:
              "sms_request_failed",

            recipient:
              maskPhoneNumber(
                phone
              ),

            provider:
              "africastalking",
          }
        );
      }

      throw new AfricasTalkingServiceError(
        "AFRICASTALKING_REQUEST_FAILED",
        "Africa's Talking SMS request failed.",
        {
          statusCode: 502,
        }
      );
    }


    const normalized =
      normalizeSmsResponse(
        response,
        {
          requestedTo:
            phone,
        }
      );


    if (
      typeof logger?.info ===
      "function"
    ) {
      logger.info(
        "[voicebridge-africastalking-sms]",
        {
          event:
            "sms_request_completed",

          recipient:
            normalized.recipientMasked,

          provider:
            normalized.provider,

          accepted:
            normalized.accepted,

          statusCode:
            normalized.statusCode,
        }
      );
    }


    return normalized;
  };


module.exports = {
  SERVICE_VERSION,
  MAX_MESSAGE_CHARS,
  E164_PATTERN,
  maskPhoneNumber,
  validatePhoneNumber,
  validateMessage,
  normalizeSmsResponse,
  sendTransactionalStatus,
};