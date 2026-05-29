const { config } = require("../config/env");

const getKeyMode = (value = "") => {
  const secret = String(value || "").trim();
  if (secret.startsWith("sk_live_")) return "live";
  if (secret.startsWith("sk_test_")) return "test";
  if (secret.startsWith("pk_")) return "public";
  return secret ? "unknown" : "missing";
};

const parseResponseBody = async (response) => {
  try {
    return await response.json();
  } catch {
    return {};
  }
};

const verifyPaystackKey = async ({ fetchImpl = global.fetch } = {}) => {
  const secret = String(config.PAYSTACK_SECRET_KEY || config.paystackSecretKey || "").trim();
  const mode = getKeyMode(secret);
  if (!secret) {
    throw new Error("PAYSTACK_SECRET_KEY is not configured.");
  }

  if (mode === "public") {
    throw new Error("PAYSTACK_SECRET_KEY is a public pk_ key. Use the secret sk_live_ key.");
  }

  if (config.paystackRequireLiveKey && mode !== "live") {
    throw new Error("PAYSTACK_SECRET_KEY must be an sk_live_ key for live payments.");
  }

  if (typeof fetchImpl !== "function") {
    throw new Error("Fetch is not available in this Node runtime.");
  }

  const baseUrl = String(config.PAYSTACK_BASE_URL || config.paystackBaseUrl || "https://api.paystack.co")
    .replace(/\/+$/, "");
  const response = await fetchImpl(`${baseUrl}/balance`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${secret}`,
    },
  });
  const payload = await parseResponseBody(response);

  if (!response.ok || payload?.status !== true) {
    const message = payload?.message || `Paystack auth check failed (${response.status || 0}).`;
    throw new Error(message);
  }

  return {
    mode,
    httpStatus: response.status,
    message: payload?.message || "Paystack accepted the configured key.",
  };
};

if (require.main === module) {
  verifyPaystackKey()
    .then((result) => {
      console.log(
        `Paystack key verified: mode=${result.mode}, http=${result.httpStatus}, message=${result.message}`
      );
    })
    .catch((error) => {
      console.error(`Paystack key verification failed: ${error.message}`);
      process.exit(1);
    });
}

module.exports = {
  getKeyMode,
  verifyPaystackKey,
};
