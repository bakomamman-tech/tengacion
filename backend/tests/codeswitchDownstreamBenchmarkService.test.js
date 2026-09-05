const {
  DOWNSTREAM_EVAL_VERSION,
  ENTITY_FIELDS,
  evaluateDownstreamBenchmark,
  evaluatePrediction,
} = require("../services/codeswitchDownstreamBenchmarkService");

describe("VoiceBridge downstream benchmark evaluation", () => {
  const GOLD = {
    intent: "payment_confirmation_check",
    requestedAction: "check_payment_status",
    entities: {
      amount: 5000,
      currency: "NGN",
      timeReference: "yesterday",
      transactionReference: null,
    },
  };

  test("exposes a versioned four-field entity contract", () => {
    expect(DOWNSTREAM_EVAL_VERSION).toBe(
      "voicebridge-downstream-eval-v1"
    );

    expect(ENTITY_FIELDS).toEqual([
      "amount",
      "currency",
      "timeReference",
      "transactionReference",
    ]);
  });

  test("marks an exact downstream prediction as successful", () => {
    const result = evaluatePrediction({
      prediction: {
        intent: "payment_confirmation_check",
        requestedAction: "check_payment_status",
        entities: {
          amount: 5000,
          currency: "ngn",
          timeReference: "yesterday",
          transactionReference: null,
        },
      },
      gold: GOLD,
    });

    expect(result).toEqual(
      expect.objectContaining({
        intentCorrect: true,
        requestedActionCorrect: true,
        entityFieldAccuracy: 1,
        entitiesExactMatch: true,
        requiredEntityRecall: 1,
        unexpectedEntityCount: 0,
        taskSuccess: true,
      })
    );
  });

  test("does not report task success when a required entity is wrong", () => {
    const result = evaluatePrediction({
      prediction: {
        intent: "payment_confirmation_check",
        requestedAction: "check_payment_status",
        entities: {
          amount: 4000,
          currency: "NGN",
          timeReference: "yesterday",
          transactionReference: null,
        },
      },
      gold: GOLD,
    });

    expect(result.intentCorrect).toBe(true);
    expect(result.requestedActionCorrect).toBe(true);
    expect(result.entitiesExactMatch).toBe(false);
    expect(result.entityFieldAccuracy).toBe(0.75);
    expect(result.requiredEntityRecall).toBeCloseTo(2 / 3);
    expect(result.taskSuccess).toBe(false);
  });

  test("evaluates a successful Hausa-English ASR result end to end", () => {
    const result = evaluateDownstreamBenchmark({
      languagePair: "ha-en",
      gold: GOLD,
      models: [
        {
          ok: true,
          provider: "sahara",
          model: "sahara-v2.5",
          transcript:
            "Don Allah check my payment, na biya naira dubu biyar jiya amma ban samu confirmation ba",
        },
      ],
    });

    expect(result).toEqual(
      expect.objectContaining({
        evaluationVersion: "voicebridge-downstream-eval-v1",
        evaluationOnly: true,
        databaseWritesPerformed: false,
        moneyMovementPerformed: false,
        languagePair: "ha-en",
        requestedModels: 1,
        evaluatedModels: 1,
      })
    );

    expect(result.summary).toEqual({
      modelCompletionRate: 1,
      intentAccuracy: 1,
      requestedActionAccuracy: 1,
      entityExactMatchRate: 1,
      taskSuccessCount: 1,
      taskSuccessRate: 1,
    });

    expect(result.models[0]).toEqual(
      expect.objectContaining({
        provider: "sahara",
        model: "sahara-v2.5",
        evaluationAvailable: true,
        taskSuccess: true,
      })
    );
  });

  test("counts failed ASR providers in end-to-end task success", () => {
    const result = evaluateDownstreamBenchmark({
      languagePair: "ha-en",
      gold: GOLD,
      models: [
        {
          ok: true,
          provider: "sahara",
          model: "sahara-v2.5",
          transcript:
            "Don Allah check my payment na biya naira dubu biyar jiya amma ban samu confirmation ba",
        },
        {
          ok: false,
          provider: "openai",
          model: "gpt-transcribe",
          error: {
            code: "OPENAI_REQUEST_FAILED",
          },
        },
      ],
    });

    expect(result.requestedModels).toBe(2);
    expect(result.evaluatedModels).toBe(1);

    expect(result.summary).toEqual(
      expect.objectContaining({
        modelCompletionRate: 0.5,
        intentAccuracy: 1,
        requestedActionAccuracy: 1,
        entityExactMatchRate: 1,
        taskSuccessCount: 1,
        taskSuccessRate: 0.5,
      })
    );

    expect(result.models[1]).toEqual(
      expect.objectContaining({
        provider: "openai",
        evaluationAvailable: false,
        taskSuccess: false,
      })
    );
  });

  test("supports Nigerian Pidgin-English downstream evaluation", () => {
    const result = evaluateDownstreamBenchmark({
      languagePair: "pcm-en",
      gold: {
        intent: "payment_confirmation_check",
        requestedAction: "check_payment_status",
        entities: {
          amount: 5000,
          currency: "NGN",
          timeReference: "yesterday",
          transactionReference: null,
        },
      },
      models: [
        {
          ok: true,
          provider: "whisper",
          model: "whisper-1",
          transcript:
            "Abeg check my payment, I pay naira 5000 yesterday but confirmation never enter",
        },
      ],
    });

    expect(result.evaluatedModels).toBe(1);
    expect(result.models[0].taskSuccess).toBe(true);
    expect(result.summary.taskSuccessRate).toBe(1);
  });

  test("rejects invalid benchmark inputs", () => {
    expect(() =>
      evaluateDownstreamBenchmark({
        models: {},
        languagePair: "ha-en",
        gold: GOLD,
      })
    ).toThrow(TypeError);

    expect(() =>
      evaluateDownstreamBenchmark({
        models: [],
        languagePair: "fr-en",
        gold: GOLD,
      })
    ).toThrow(
      "languagePair must be one of: ha-en, pcm-en."
    );
  });
});
