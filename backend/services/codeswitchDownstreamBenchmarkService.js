const {
  SUPPORTED_LANGUAGE_PAIRS,
  analyzeCodeswitchIntent,
} = require("./codeswitchIntentService");

const DOWNSTREAM_EVAL_VERSION =
  "voicebridge-downstream-eval-v1";

const ENTITY_FIELDS = Object.freeze([
  "amount",
  "currency",
  "timeReference",
  "transactionReference",
]);

const isPlainObject = (value) =>
  Boolean(
    value &&
      typeof value === "object" &&
      !Array.isArray(value)
  );

const normalizeEntityValue = (
  field,
  value
) => {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return null;
  }

  if (field === "amount") {
    const numeric = Number(value);

    return Number.isFinite(numeric)
      ? numeric
      : value;
  }

  if (
    field === "currency" &&
    typeof value === "string"
  ) {
    return value.trim().toUpperCase();
  }

  return typeof value === "string"
    ? value.trim()
    : value;
};

const normalizeEntities = (
  entities = {}
) =>
  Object.fromEntries(
    ENTITY_FIELDS.map((field) => [
      field,
      normalizeEntityValue(
        field,
        entities?.[field]
      ),
    ])
  );

const validateGold = ({
  gold,
  languagePair,
}) => {
  if (
    !SUPPORTED_LANGUAGE_PAIRS.includes(
      languagePair
    )
  ) {
    throw new RangeError(
      "languagePair must be one of: ha-en, pcm-en."
    );
  }

  if (!isPlainObject(gold)) {
    throw new TypeError(
      "gold must be an object."
    );
  }

  if (
    typeof gold.intent !== "string" ||
    !gold.intent.trim()
  ) {
    throw new TypeError(
      "gold.intent must be a non-empty string."
    );
  }

  if (
    typeof gold.requestedAction !==
      "string" ||
    !gold.requestedAction.trim()
  ) {
    throw new TypeError(
      "gold.requestedAction must be a non-empty string."
    );
  }

  if (!isPlainObject(gold.entities)) {
    throw new TypeError(
      "gold.entities must be an object."
    );
  }

  return {
    intent: gold.intent.trim(),
    requestedAction:
      gold.requestedAction.trim(),
    entities: normalizeEntities(
      gold.entities
    ),
  };
};

const evaluatePrediction = ({
  prediction,
  gold,
}) => {
  const predictedEntities =
    normalizeEntities(
      prediction.entities
    );

  const entityFields =
    ENTITY_FIELDS.map((field) => {
      const expected =
        gold.entities[field];

      const predicted =
        predictedEntities[field];

      return {
        field,
        expected,
        predicted,
        correct:
          Object.is(
            predicted,
            expected
          ),
        required:
          expected !== null,
        unexpected:
          expected === null &&
          predicted !== null,
      };
    });

  const correctEntityFields =
    entityFields.filter(
      (field) => field.correct
    ).length;

  const requiredFields =
    entityFields.filter(
      (field) => field.required
    );

  const matchedRequiredFields =
    requiredFields.filter(
      (field) => field.correct
    ).length;

  const unexpectedEntityFields =
    entityFields.filter(
      (field) => field.unexpected
    );

  const intentCorrect =
    prediction.intent ===
    gold.intent;

  const requestedActionCorrect =
    prediction.requestedAction ===
    gold.requestedAction;

  const entitiesExactMatch =
    correctEntityFields ===
    ENTITY_FIELDS.length;

  const taskSuccess =
    intentCorrect &&
    requestedActionCorrect &&
    entitiesExactMatch;

  return {
    intentCorrect,
    requestedActionCorrect,

    entityFieldAccuracy:
      correctEntityFields /
      ENTITY_FIELDS.length,

    entitiesExactMatch,

    requiredEntityRecall:
      requiredFields.length > 0
        ? matchedRequiredFields /
          requiredFields.length
        : 1,

    unexpectedEntityCount:
      unexpectedEntityFields.length,

    taskSuccess,

    entityFields,
  };
};

const evaluateModel = ({
  modelResult,
  languagePair,
  gold,
}) => {
  const provider =
    modelResult?.provider || "unknown";

  const model =
    modelResult?.model || null;

  if (
    modelResult?.ok !== true
  ) {
    return {
      provider,
      model,
      evaluationAvailable: false,
      taskSuccess: false,
      reason:
        "ASR provider did not return a successful transcript.",
    };
  }

  if (
    typeof modelResult.transcript !==
      "string" ||
    !modelResult.transcript.trim()
  ) {
    return {
      provider,
      model,
      evaluationAvailable: false,
      taskSuccess: false,
      reason:
        "ASR provider returned no usable transcript.",
    };
  }

  const prediction =
    analyzeCodeswitchIntent({
      transcript:
        modelResult.transcript,
      languagePair,
    });

  const metrics =
    evaluatePrediction({
      prediction,
      gold,
    });

  return {
    provider,
    model,
    evaluationAvailable: true,

    prediction: {
      intent: prediction.intent,
      entities:
        normalizeEntities(
          prediction.entities
        ),
      requestedAction:
        prediction.requestedAction,
    },

    metrics,

    taskSuccess:
      metrics.taskSuccess,
  };
};

const rate = (
  numerator,
  denominator
) =>
  denominator > 0
    ? numerator / denominator
    : null;

const evaluateDownstreamBenchmark = ({
  models,
  languagePair,
  gold,
} = {}) => {
  if (!Array.isArray(models)) {
    throw new TypeError(
      "models must be an array."
    );
  }

  const safeGold =
    validateGold({
      gold,
      languagePair,
    });

  const evaluations =
    models.map((modelResult) =>
      evaluateModel({
        modelResult,
        languagePair,
        gold: safeGold,
      })
    );

  const available =
    evaluations.filter(
      (result) =>
        result.evaluationAvailable
    );

  const intentCorrectCount =
    available.filter(
      (result) =>
        result.metrics.intentCorrect
    ).length;

  const actionCorrectCount =
    available.filter(
      (result) =>
        result.metrics
          .requestedActionCorrect
    ).length;

  const entityExactCount =
    available.filter(
      (result) =>
        result.metrics
          .entitiesExactMatch
    ).length;

  const taskSuccessCount =
    evaluations.filter(
      (result) =>
        result.taskSuccess === true
    ).length;

  return {
    evaluationVersion:
      DOWNSTREAM_EVAL_VERSION,

    evaluationOnly: true,

    databaseWritesPerformed: false,
    moneyMovementPerformed: false,

    languagePair,

    gold: safeGold,

    requestedModels:
      evaluations.length,

    evaluatedModels:
      available.length,

    summary: {
      modelCompletionRate:
        rate(
          available.length,
          evaluations.length
        ),

      intentAccuracy:
        rate(
          intentCorrectCount,
          available.length
        ),

      requestedActionAccuracy:
        rate(
          actionCorrectCount,
          available.length
        ),

      entityExactMatchRate:
        rate(
          entityExactCount,
          available.length
        ),

      taskSuccessCount,

      taskSuccessRate:
        rate(
          taskSuccessCount,
          evaluations.length
        ),
    },

    models: evaluations,
  };
};

module.exports = {
  DOWNSTREAM_EVAL_VERSION,
  ENTITY_FIELDS,
  evaluateDownstreamBenchmark,
  evaluatePrediction,
};