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
