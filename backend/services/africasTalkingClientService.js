const crypto =
  require("crypto");

const {
  config,
} = require("../config/env");


const SERVICE_VERSION =
  "voicebridge-africastalking-client-v1";


const SERVICE_KEYS =
  Object.freeze({
    sms: "SMS",
    voice: "VOICE",
  });


class AfricasTalkingServiceError
  extends Error {

  constructor(
    code,
    message,
    {
      statusCode = 503,
      cause = null,
    } = {}
  ) {
    super(message);

    this.name =
      "AfricasTalkingServiceError";

    this.code = code;

    this.statusCode =
      statusCode;

    if (cause) {
      this.cause = cause;
    }
  }
}


let cachedClient = null;

let cachedIdentity = "";


const toText = (value) =>
  typeof value === "string"
    ? value.trim()
    : value == null
      ? ""
      : String(value).trim();


const resolveAfricasTalkingConfig = (
  overrideConfig
) =>
  overrideConfig ||
  config.africasTalking ||
  {};


const getCredentialIdentity = (
  atConfig
) => {

  const username =
    toText(
      atConfig?.username
    );

  const environment =
    toText(
      atConfig?.environment
    );

  const apiKey =
    toText(
      atConfig?.apiKey
    );


  const apiKeyFingerprint =
    apiKey
      ? crypto
          .createHash("sha256")
          .update(
            apiKey,
            "utf8"
          )
          .digest("hex")
      : "";


  return [
    environment,
    username,
    apiKeyFingerprint,
  ].join(":");
};


const assertCredentialsConfigured = (
  atConfig
) => {

  const username =
    toText(
      atConfig?.username
    );

  const apiKey =
    toText(
      atConfig?.apiKey
    );


  if (
    !username ||
    !apiKey
  ) {
    throw new AfricasTalkingServiceError(
      "AFRICASTALKING_NOT_CONFIGURED",
      "Africa's Talking credentials are not configured.",
      {
        statusCode: 503,
      }
    );
  }


  return {
    username,
    apiKey,
  };
};


const assertServiceEnabled = (
  service,
  atConfig
) => {

  const normalizedService =
    toText(service)
      .toLowerCase();


  if (
    !Object.prototype.hasOwnProperty.call(
      SERVICE_KEYS,
      normalizedService
    )
  ) {
    throw new AfricasTalkingServiceError(
      "AFRICASTALKING_UNSUPPORTED_SERVICE",
      "Unsupported Africa's Talking service.",
      {
        statusCode: 400,
      }
    );
  }


  const serviceConfig =
    atConfig?.[
      normalizedService
    ];


  if (
    !serviceConfig?.enabled
  ) {
    throw new AfricasTalkingServiceError(
      "AFRICASTALKING_DISABLED",
      `Africa's Talking ${normalizedService} integration is disabled.`,
      {
        statusCode: 503,
      }
    );
  }


  return normalizedService;
};


const createDefaultSdkClient = (
  credentials
) => {

  // Deliberately lazy:
  // importing this service does not load or
  // initialize the Africa's Talking SDK.
  const initializeAfricasTalking =
    require("africastalking");


  if (
    typeof initializeAfricasTalking !==
    "function"
  ) {
    throw new AfricasTalkingServiceError(
      "AFRICASTALKING_SDK_INVALID",
      "Africa's Talking SDK initializer is unavailable.",
      {
        statusCode: 500,
      }
    );
  }


  return initializeAfricasTalking({
    username:
      credentials.username,

    apiKey:
      credentials.apiKey,
  });
};


const createAfricasTalkingClient = ({
  atConfig,
  sdkFactory,
} = {}) => {

  const resolvedConfig =
    resolveAfricasTalkingConfig(
      atConfig
    );


  const credentials =
    assertCredentialsConfigured(
      resolvedConfig
    );


  const factory =
    typeof sdkFactory ===
      "function"
      ? sdkFactory
      : createDefaultSdkClient;


  try {

    const client =
      factory(
        credentials
      );


    if (
      !client ||
      typeof client !==
        "object"
    ) {
      throw new Error(
        "SDK factory returned an invalid client."
      );
    }


    return client;

  } catch (error) {

    if (
      error instanceof
        AfricasTalkingServiceError
    ) {
      throw error;
    }


    throw new AfricasTalkingServiceError(
      "AFRICASTALKING_CLIENT_INIT_FAILED",
      "Africa's Talking client initialization failed.",
      {
        statusCode: 503,
        cause: error,
      }
    );
  }
};


const getAfricasTalkingClient = ({
  atConfig,
  sdkFactory,
  useCache = true,
} = {}) => {

  const resolvedConfig =
    resolveAfricasTalkingConfig(
      atConfig
    );


  // Dependency-injected factories are never
  // placed in the module-level production cache.
  if (
    typeof sdkFactory ===
      "function"
  ) {
    return createAfricasTalkingClient({
      atConfig:
        resolvedConfig,

      sdkFactory,
    });
  }


  const identity =
    getCredentialIdentity(
      resolvedConfig
    );


  if (
    useCache &&
    cachedClient &&
    cachedIdentity ===
      identity
  ) {
    return cachedClient;
  }


  const client =
    createAfricasTalkingClient({
      atConfig:
        resolvedConfig,
    });


  if (useCache) {
    cachedClient =
      client;

    cachedIdentity =
      identity;
  }


  return client;
};


const getAfricasTalkingService = (
  service,
  {
    atConfig,
    sdkFactory,
    useCache = true,
  } = {}
) => {

  const resolvedConfig =
    resolveAfricasTalkingConfig(
      atConfig
    );


  const normalizedService =
    assertServiceEnabled(
      service,
      resolvedConfig
    );


  const client =
    getAfricasTalkingClient({
      atConfig:
        resolvedConfig,

      sdkFactory,

      useCache,
    });


  const sdkKey =
    SERVICE_KEYS[
      normalizedService
    ];


  const serviceClient =
    client?.[
      sdkKey
    ];


  if (
    !serviceClient
  ) {
    throw new AfricasTalkingServiceError(
      "AFRICASTALKING_SERVICE_UNAVAILABLE",
      `Africa's Talking ${normalizedService} service is unavailable.`,
      {
        statusCode: 503,
      }
    );
  }


  return serviceClient;
};


const getAfricasTalkingReadiness = (
  overrideConfig
) => {

  const atConfig =
    resolveAfricasTalkingConfig(
      overrideConfig
    );


  return {
    version:
      SERVICE_VERSION,

    environment:
      toText(
        atConfig.environment
      ),

    credentialsConfigured:
      Boolean(
        atConfig.credentialsConfigured
      ),

    smsEnabled:
      Boolean(
        atConfig.sms?.enabled
      ),

    smsReady:
      Boolean(
        atConfig.sms?.ready
      ),

    voiceEnabled:
      Boolean(
        atConfig.voice?.enabled
      ),

    voiceReady:
      Boolean(
        atConfig.voice?.ready
      ),

    callbackBaseUrlConfigured:
      Boolean(
        toText(
          atConfig.callbackBaseUrl
        )
      ),
  };
};


const resetAfricasTalkingClientForTests =
  () => {

    cachedClient = null;

    cachedIdentity = "";
  };


module.exports = {
  SERVICE_VERSION,
  AfricasTalkingServiceError,
  createAfricasTalkingClient,
  getAfricasTalkingClient,
  getAfricasTalkingService,
  getAfricasTalkingReadiness,
  resetAfricasTalkingClientForTests,
};