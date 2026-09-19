const { isTengaAgentPilotMode, isPilotApiPath, tengaAgentPilotApiGuard } = require("../config/tengaAgentPilotMode");

describe("isolated TengaAgent pilot safeguard", () => {
  const pilotEnv = {
    TENGAAGENT_PILOT_MODE: "true",
    RENDER_SERVICE_ID: "srv-dalprie7bikc73a6hhgg",
    NODE_ENV: "production",
  };
  it("requires an explicit flag, the exact isolated Render service and production security mode", () => {
    expect(isTengaAgentPilotMode(pilotEnv)).toBe(true);
    expect(isTengaAgentPilotMode({ ...pilotEnv, TENGAAGENT_PILOT_MODE: "false" })).toBe(false);
    expect(isTengaAgentPilotMode({ ...pilotEnv, RENDER_SERVICE_ID: "srv-production" })).toBe(false);
    expect(isTengaAgentPilotMode({ ...pilotEnv, NODE_ENV: "development" })).toBe(false);
  });
  it("allows TengaAgent conversations, owner work, login and health but refuses checkout and unrelated APIs", () => {
    expect(isPilotApiPath("/health/ready", "GET")).toBe(true);
    expect(isPilotApiPath("/auth/login", "POST")).toBe(true);
    expect(isPilotApiPath("/tengaagent/owner/workspace", "POST")).toBe(true);
    expect(isPilotApiPath("/tengaagent/public/acme/agent/message", "POST")).toBe(true);
    expect(isPilotApiPath("/tengaagent/billing/plans", "GET")).toBe(true);
    expect(isPilotApiPath("/tengaagent/billing/checkout", "POST")).toBe(false);
    expect(isPilotApiPath("/tengaagent/billing/webhook/paystack", "POST")).toBe(false);
    expect(isPilotApiPath("/payments/checkout", "POST")).toBe(false);
    expect(isPilotApiPath("/marketplace/orders", "POST")).toBe(false);
    expect(isPilotApiPath("/tengaagent/whatsapp/webhook", "POST")).toBe(false);
  });
  it("rejects payment operations in pilot mode before reaching application routes", () => {
    const previous = {
      TENGAAGENT_PILOT_MODE: process.env.TENGAAGENT_PILOT_MODE,
      RENDER_SERVICE_ID: process.env.RENDER_SERVICE_ID,
      NODE_ENV: process.env.NODE_ENV,
    };
    try {
      Object.assign(process.env, pilotEnv);
      const req = { path: "/payments/checkout", method: "POST" };
      const res = { status: jest.fn().mockReturnThis(), set: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
      const next = jest.fn();
      tengaAgentPilotApiGuard(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: "TENGAAGENT_PILOT_ONLY" }));
      expect(next).not.toHaveBeenCalled();
      req.path = "/tengaagent/owner/workspace";
      tengaAgentPilotApiGuard(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);
    } finally {
      for (const [key, value] of Object.entries(previous)) {
        if (value === undefined) delete process.env[key]; else process.env[key] = value;
      }
    }
  });
});
