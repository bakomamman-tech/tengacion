const express = require("express");
const request = require("supertest");

const codeswitchRoutes = require("../routes/codeswitch");

const app = express();
app.use(express.json());
app.use("/api/codeswitch", codeswitchRoutes);

describe("VoiceBridge CodeSwitch routes", () => {
  test("reports Phase 1 health", async () => {
    const response = await request(app).get("/api/codeswitch/health").expect(200);

    expect(response.body).toEqual({
      ok: true,
      service: "Tengacion VoiceBridge",
      phase: 1,
    });
    expect(response.headers["cache-control"]).toBe("no-store");
  });

  test("normalizes a transcript through the API", async () => {
    const response = await request(app)
      .post("/api/codeswitch/normalize")
      .send({ text: "Please check my order!" })
      .expect(200);

    expect(response.body).toEqual({
      original: "Please check my order!",
      normalized: "please check my order",
    });
  });

  test("calculates the mandatory normalized WER through the API", async () => {
    const response = await request(app)
      .post("/api/codeswitch/wer")
      .send({
        reference: "Please check my order!",
        hypothesis: "please check my order",
      })
      .expect(200);

    expect(response.body).toEqual({
      wer: 0,
      substitutions: 0,
      deletions: 0,
      insertions: 0,
      referenceWordCount: 4,
      normalizedReference: "please check my order",
      normalizedHypothesis: "please check my order",
    });
  });

  test("returns an explicit undefined-WER response for an empty reference", async () => {
    const response = await request(app)
      .post("/api/codeswitch/wer")
      .send({ reference: "!!!", hypothesis: "hello" })
      .expect(200);

    expect(response.body).toEqual(
      expect.objectContaining({
        wer: null,
        insertions: 1,
        referenceWordCount: 0,
        undefinedReason: expect.stringMatching(/requires at least one reference word/i),
      })
    );
  });

  test("rejects missing or non-string transcript fields", async () => {
    await request(app)
      .post("/api/codeswitch/normalize")
      .send({})
      .expect(400, { error: "text must be a string." });

    await request(app)
      .post("/api/codeswitch/wer")
      .send({ reference: "hello", hypothesis: 42 })
      .expect(400, { error: "hypothesis must be a string." });
  });

  test.each(["transcribe", "benchmark", "intent"])(
    "keeps /%s as a clear Phase 1 placeholder",
    async (endpoint) => {
      const response = await request(app)
        .post(`/api/codeswitch/${endpoint}`)
        .send({})
        .expect(501);

      expect(response.body).toEqual({
        ok: false,
        service: "Tengacion VoiceBridge",
        phase: 1,
        endpoint,
        integrationEnabled: false,
        message: "External ASR and agent integrations are not enabled in Phase 1.",
      });
    }
  );
});
