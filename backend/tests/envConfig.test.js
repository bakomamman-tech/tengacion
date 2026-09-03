const path = require("path");

describe("environment configuration", () => {
  test("requires production auth token secrets before startup", () => {
    const originalEnv = { ...process.env };
    jest.resetModules();

    process.env = {
      ...originalEnv,
      NODE_ENV: "production",
      MONGO_URI: "mongodb://127.0.0.1:27017/tengacion",
      JWT_SECRET: "x".repeat(32),
      JWT_REFRESH_SECRET: "",
      AUTH_CHALLENGE_SECRET: "",
      PORT: "5000",
      ASSISTANT_ENABLED: "false",
      OPENAI_API_KEY: "",
    };

    try {
      expect(() => require("../config/env")).toThrow(/JWT_REFRESH_SECRET/i);
      expect(() => require("../config/env")).toThrow(/AUTH_CHALLENGE_SECRET/i);
    } finally {
      process.env = originalEnv;
      jest.resetModules();
      require("../../apps/api/config/env");
    }
  });

  test("accepts production auth token secrets when all required values are set", () => {
    const originalEnv = { ...process.env };
    jest.resetModules();

    process.env = {
      ...originalEnv,
      NODE_ENV: "production",
      MONGO_URI: "mongodb://127.0.0.1:27017/tengacion",
      JWT_SECRET: "x".repeat(32),
      JWT_REFRESH_SECRET: "r".repeat(32),
      AUTH_CHALLENGE_SECRET: "c".repeat(32),
      PORT: "5000",
      ASSISTANT_ENABLED: "false",
      OPENAI_API_KEY: "",
    };

    try {
      const { config } = require("../config/env");

      expect(config.isProduction).toBe(true);
      expect(config.JWT_REFRESH_SECRET).toBe("r".repeat(32));
      expect(config.AUTH_CHALLENGE_SECRET).toBe("c".repeat(32));
    } finally {
      process.env = originalEnv;
      jest.resetModules();
      require("../../apps/api/config/env");
    }
  });
});

describe("environment config loading", () => {
  test("prefers the repo root env file before backend-local fallbacks", () => {
    const { buildEnvCandidates } = require("../config/env");
    const backendDir = path.resolve(__dirname, "..");
    const configDir = path.resolve(backendDir, "config");

    expect(
      buildEnvCandidates({
        cwd: backendDir,
        configDir,
        fileName: ".env",
      })
    ).toEqual([
      path.resolve(backendDir, "..", ".env"),
      path.resolve(backendDir, ".env"),
    ]);
  });

  test("loads Sahara server settings and redacts the API key from log data", () => {
    const originalEnv = { ...process.env };
    const secret = "sahara-test-secret-never-log";
    jest.resetModules();

    process.env = {
      ...originalEnv,
      NODE_ENV: "test",
      SAHARA_API_KEY: secret,
      SAHARA_REQUEST_TIMEOUT_MS: "120000",
      SAHARA_POLL_TIMEOUT_MS: "24000",
      SAHARA_POLL_DELAY_MS: "250",
      SAHARA_POLL_MAX_ATTEMPTS: "7",
    };

    try {
      const { config, redactSecretsForLog } = require("../config/env");

      expect(config.sahara).toEqual({
        apiKey: secret,
        apiKeyConfigured: true,
        requestTimeoutMs: 120000,
        pollTimeoutMs: 24000,
        pollDelayMs: 250,
        pollMaxAttempts: 7,
      });
      const safeLog = redactSecretsForLog({
        SAHARA_API_KEY: secret,
        nested: { saharaApiKey: secret },
      });
      expect(safeLog).toEqual({
        saharaApiKeyConfigured: true,
        nested: { saharaApiKeyConfigured: true },
      });
      expect(JSON.stringify(safeLog)).not.toContain(secret);
    } finally {
      process.env = originalEnv;
      jest.resetModules();
      require("../../apps/api/config/env");
    }
  });
});
