process.env.NODE_ENV = "test";
process.env.MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/tengacion-paystack-key-test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test_secret_1234567890123456789012";
process.env.PAYSTACK_SECRET_KEY =
  process.env.PAYSTACK_SECRET_KEY || "sk_test_paystack_secret_1234567890";

const { getKeyMode, verifyPaystackKey } = require("../scripts/verifyPaystackKey");

describe("verifyPaystackKey", () => {
  test("classifies secret key modes without exposing key material", () => {
    expect(getKeyMode("sk_live_abc")).toBe("live");
    expect(getKeyMode("sk_test_abc")).toBe("test");
    expect(getKeyMode("pk_live_abc")).toBe("public");
    expect(getKeyMode("")).toBe("missing");
  });

  test("accepts a successful Paystack auth response", async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        status: true,
        message: "Balances retrieved",
        data: [{ balance: 12345 }],
      }),
    });

    await expect(verifyPaystackKey({ fetchImpl })).resolves.toMatchObject({
      httpStatus: 200,
      message: "Balances retrieved",
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.paystack.co/balance",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: expect.stringMatching(/^Bearer sk_/),
        }),
      })
    );
  });

  test("rejects Paystack invalid key responses", async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({
        status: false,
        message: "Invalid key",
      }),
    });

    await expect(verifyPaystackKey({ fetchImpl })).rejects.toThrow("Invalid key");
  });
});
