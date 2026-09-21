const express = require("express");
const request = require("supertest");

jest.mock("../services/africasTalkingVoiceProcessingService", () => ({
  processAfricasTalkingVoiceRecording: jest.fn(),
}));

const { config } = require("../config/env");
const {
  processAfricasTalkingVoiceRecording,
} = require("../services/africasTalkingVoiceProcessingService");
const { buildLanguageMenuXml, resolveLanguagePairFromDigits } =
  require("../services/africasTalkingLanguageMenuService");
const router = require("../routes/codeswitch");

const app = express();
app.use(express.json({ limit: "512kb" }));
app.use(express.urlencoded({ extended: true, limit: "512kb" }));
app.use("/api/codeswitch", router);

const base = "/api/codeswitch/africastalking/voice";
const privateSession = "TEST_PRIVATE_SESSION";
const privateCaller = "+2348012345678";

describe("Africa's Talking explicit language-selection flow", () => {
  let previousCallbackBaseUrl;

  beforeAll(() => {
    previousCallbackBaseUrl = config.africasTalking.callbackBaseUrl;
    config.africasTalking.callbackBaseUrl = "https://voicebridge.example.com";
  });

  afterAll(() => {
    config.africasTalking.callbackBaseUrl = previousCallbackBaseUrl;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("initial call asks for one digit and does not record before a selection", async () => {
    const response = await request(app)
      .post(base + "/callback")
      .type("form")
      .send({ sessionId: privateSession, callerNumber: privateCaller });

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toMatch(/application\/xml/);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.text).toContain('<GetDigits numDigits="1" timeout="10"');
    expect(response.text).toContain(
      'callbackUrl="https://voicebridge.example.com' + base + '/language"'
    );
    expect(response.text).toContain("Press 1 for Hausa and English");
    expect(response.text).toContain("Press 2 for Nigerian Pidgin and English");
    expect(response.text).not.toContain("<Record");
    expect(response.text).not.toContain(privateSession);
    expect(response.text).not.toContain(privateCaller);
    expect(processAfricasTalkingVoiceRecording).not.toHaveBeenCalled();
  });

  test.each([
    ["1", "ha-en", "ha"],
    ["2", "pcm-en", "pcm"],
  ])("key %s routes the recording into %s (%s)", async (key, pair, code) => {
    const selected = await request(app)
      .post(base + "/language")
      .type("form")
      .send({ dtmfDigits: key, sessionId: privateSession });

    expect(selected.status).toBe(200);
    expect(selected.headers["content-type"]).toMatch(/application\/xml/);
    expect(selected.headers["cache-control"]).toBe("no-store");
    expect(selected.text).toContain("<Record");
    expect(selected.text).toContain(
      'callbackUrl="https://voicebridge.example.com' +
      base + '/recording?languagePair=' + pair + '"'
    );
    expect(selected.text).not.toContain("languagePair=" + (key === "1" ? "pcm-en" : "ha-en"));
    expect(selected.text).not.toContain(privateSession);
    expect(processAfricasTalkingVoiceRecording).not.toHaveBeenCalled();

    // Exercise the actual processing callback with the same selected pair.
    processAfricasTalkingVoiceRecording.mockResolvedValue({
      processingCompleted: true,
      languagePair: pair,
      recording: { downloaded: true, stored: false },
      transcription: {
        completed: true, provider: "sahara", model: "sahara-v2.5",
        languageCode: code, transcriptReturned: false,
      },
      action: { executedAction: "create_payment_verification_case", moneyMovementPerformed: false },
      notification: { requested: false, attempted: false, delivered: false },
      moneyMovementPerformed: false,
    });
    const processed = await request(app)
      .post(base + "/recording?languagePair=" + pair)
      .type("form")
      .send({
        recordingUrl: "https://recordings.example.com/test.wav",
        sessionId: privateSession,
      });
    expect(processed.status).toBe(200);
    expect(processAfricasTalkingVoiceRecording).toHaveBeenCalledWith(
      expect.objectContaining({ languagePair: pair })
    );
    expect(processed.body.processing.transcription.languageCode).toBe(code);
    expect(JSON.stringify(processed.body)).not.toContain(privateSession);
  });

  test("invalid keypad digit causes one retry without silently recording", async () => {
    const response = await request(app)
      .post(base + "/language")
      .type("form")
      .send({ dtmfDigits: "9", sessionId: privateSession });

    expect(response.status).toBe(200);
    expect(response.text).toContain("<GetDigits");
    expect(response.text).toContain(
      'callbackUrl="https://voicebridge.example.com' + base + '/language?retry=1"'
    );
    expect(response.text).not.toContain("<Record");
    expect(processAfricasTalkingVoiceRecording).not.toHaveBeenCalled();
  });

  test("a second invalid or empty response ends the call without recording", async () => {
    for (const dtmfDigits of ["9", "", "12"]) {
      const response = await request(app)
        .post(base + "/language?retry=1")
        .type("form")
        .send({ dtmfDigits });

      expect(response.status).toBe(200);
      expect(response.text).toContain("Please call again");
      expect(response.text).not.toContain("<Record");
      expect(response.text).not.toContain("<GetDigits");
    }
    expect(processAfricasTalkingVoiceRecording).not.toHaveBeenCalled();
  });

  test("no configured HTTPS callback URL fails closed without a recording", async () => {
    config.africasTalking.callbackBaseUrl = "";
    try {
      const response = await request(app)
        .post(base + "/callback")
        .type("form")
        .send({ sessionId: privateSession });

      expect(response.status).toBe(200);
      expect(response.text).toContain("temporarily unavailable");
      expect(response.text).not.toContain("<Record");
      expect(response.text).not.toContain("<GetDigits");
    } finally {
      config.africasTalking.callbackBaseUrl = "https://voicebridge.example.com";
    }
  });

  test("recognizes only the two documented single-digit choices", () => {
    expect(resolveLanguagePairFromDigits("1")).toBe("ha-en");
    expect(resolveLanguagePairFromDigits("2")).toBe("pcm-en");
    expect(resolveLanguagePairFromDigits("12")).toBeNull();
    expect(resolveLanguagePairFromDigits("")).toBeNull();
    expect(resolveLanguagePairFromDigits({ value: "2" })).toBeNull();
    expect(() => buildLanguageMenuXml({ callbackBaseUrl: "http://unsafe.example.com" }))
      .toThrow();
  });
});
