const {
  DEFAULT_PROVIDER_IDS,
} = require("./codeswitchProviderRegistry");

const REPORT_VERSION =
  "voicebridge-benchmark-report-v1";

const SUPPORTED_LANGUAGE_PAIRS =
  Object.freeze([
    "ha-en",
    "pcm-en",
  ]);

const isPlainObject = (value) =>
  Boolean(
    value &&
      typeof value === "object" &&
      !Array.isArray(value)
  );

const rate = (
  numerator,
  denominator
) =>
  denominator > 0
    ? numerator / denominator
    : null;

const mean = (values) =>
  values.length > 0
    ? values.reduce(
        (sum, value) =>
          sum + value,
        0
      ) / values.length
    : null;

const validateRun = (
  run,
  seenSampleIds
) => {
  if (!isPlainObject(run)) {
    throw new TypeError(
      "Every benchmark run must be an object."
    );
  }

  if (
    typeof run.sampleId !==
      "string" ||
    !run.sampleId.trim()
  ) {
    throw new TypeError(
      "Every benchmark run must have a non-empty sampleId."
    );
  }

  const sampleId =
    run.sampleId.trim();

  if (
    seenSampleIds.has(
      sampleId
    )
  ) {
    throw new RangeError(
      `Duplicate benchmark sampleId: ${sampleId}`
    );
  }

  seenSampleIds.add(
    sampleId
  );

  if (
    !SUPPORTED_LANGUAGE_PAIRS
      .includes(
        run.languagePair
      )
  ) {
    throw new RangeError(
      "languagePair must be one of: ha-en, pcm-en."
    );
  }

  if (
    !isPlainObject(
      run.benchmark
    ) ||
    !Array.isArray(
      run.benchmark.models
    )
  ) {
    throw new TypeError(
      `Benchmark run ${sampleId} must contain benchmark.models.`
    );
  }

  return {
    ...run,
    sampleId,
  };
};

const validateRuns = (
  runs
) => {
  if (
    !Array.isArray(runs) ||
    runs.length === 0
  ) {
    throw new TypeError(
      "Benchmark runs must be a non-empty array."
    );
  }

  const seenSampleIds =
    new Set();

  return runs.map(
    (run) =>
      validateRun(
        run,
        seenSampleIds
      )
  );
};

const getProviderModel = (
  run,
  providerId
) =>
  run.benchmark.models.find(
    (model) =>
      model?.provider ===
      providerId
  ) || null;

const getProviderDownstream =
  (
    run,
    providerId
  ) => {
    const downstream =
      run.benchmark
        ?.downstreamEvaluation;

    if (
      !downstream ||
      !Array.isArray(
        downstream.models
      )
    ) {
      return {
        requested: false,
        evaluation: null,
      };
    }

    return {
      requested: true,

      evaluation:
        downstream.models.find(
          (model) =>
            model?.provider ===
            providerId
        ) || null,
    };
  };

const aggregateProvider = (
  runs,
  providerId
) => {
  let successfulTranscriptions =
    0;

  let totalReferenceWords =
    0;

  let totalWordErrors =
    0;

  const wers = [];
  const latencies = [];

  let downstreamRequestedSamples =
    0;

  let downstreamEvaluatedSamples =
    0;

  let intentCorrectCount =
    0;

  let actionCorrectCount =
    0;

  let entityExactCount =
    0;

  let taskSuccessCount =
    0;

  const requiredEntityRecalls =
    [];

  for (
    const run of runs
  ) {
    const model =
      getProviderModel(
        run,
        providerId
      );

    if (
      model?.ok === true
    ) {
      successfulTranscriptions +=
        1;

      if (
        Number.isFinite(
          model.latencyMs
        )
      ) {
        latencies.push(
          model.latencyMs
        );
      }

      const evaluation =
        model.evaluation;

      if (
        evaluation &&
        Number.isFinite(
          evaluation.wer
        ) &&
        Number.isInteger(
          evaluation.referenceWordCount
        ) &&
        evaluation
          .referenceWordCount >
          0 &&
        Number.isInteger(
          evaluation.substitutions
        ) &&
        Number.isInteger(
          evaluation.deletions
        ) &&
        Number.isInteger(
          evaluation.insertions
        )
      ) {
        const errors =
          evaluation.substitutions +
          evaluation.deletions +
          evaluation.insertions;

        totalReferenceWords +=
          evaluation
            .referenceWordCount;

        totalWordErrors +=
          errors;

        wers.push(
          evaluation.wer
        );
      }
    }

    const {
      requested,
      evaluation:
        downstreamEvaluation,
    } =
      getProviderDownstream(
        run,
        providerId
      );

    if (requested) {
      downstreamRequestedSamples +=
        1;
    }

    if (
      downstreamEvaluation
        ?.taskSuccess === true
    ) {
      taskSuccessCount +=
        1;
    }

    if (
      downstreamEvaluation
        ?.evaluationAvailable !==
      true
    ) {
      continue;
    }

    downstreamEvaluatedSamples +=
      1;

    const metrics =
      downstreamEvaluation
        .metrics || {};

    if (
      metrics.intentCorrect ===
      true
    ) {
      intentCorrectCount +=
        1;
    }

    if (
      metrics
        .requestedActionCorrect ===
      true
    ) {
      actionCorrectCount +=
        1;
    }

    if (
      metrics
        .entitiesExactMatch ===
      true
    ) {
      entityExactCount +=
        1;
    }

    if (
      Number.isFinite(
        metrics
          .requiredEntityRecall
      )
    ) {
      requiredEntityRecalls.push(
        metrics
          .requiredEntityRecall
      );
    }
  }

  return {
    provider:
      providerId,

    samplesRequested:
      runs.length,

    successfulTranscriptions,

    completionRate:
      rate(
        successfulTranscriptions,
        runs.length
      ),

    werSampleCount:
      wers.length,

    totalReferenceWords,

    totalWordErrors,

    corpusWer:
      rate(
        totalWordErrors,
        totalReferenceWords
      ),

    meanSampleWer:
      mean(
        wers
      ),

    averageLatencyMs:
      mean(
        latencies
      ),

    downstreamRequestedSamples,

    downstreamEvaluatedSamples,

    intentAccuracy:
      rate(
        intentCorrectCount,
        downstreamEvaluatedSamples
      ),

    requestedActionAccuracy:
      rate(
        actionCorrectCount,
        downstreamEvaluatedSamples
      ),

    entityExactMatchRate:
      rate(
        entityExactCount,
        downstreamEvaluatedSamples
      ),

    averageRequiredEntityRecall:
      mean(
        requiredEntityRecalls
      ),

    taskSuccessCount,

    /*
     * Provider failures remain failures
     * for downstream task success.
     * This prevents a provider from
     * improving its score by failing
     * to return a transcript.
     */
    taskSuccessRate:
      rate(
        taskSuccessCount,
        downstreamRequestedSamples
      ),
  };
};

const buildProviderTable = (
  runs
) =>
  DEFAULT_PROVIDER_IDS.map(
    (providerId) =>
      aggregateProvider(
        runs,
        providerId
      )
  );

const aggregateCodeswitchBenchmarkRuns =
  (
    runs
  ) => {
    const safeRuns =
      validateRuns(
        runs
      );

    const languagePairCounts =
      Object.fromEntries(
        SUPPORTED_LANGUAGE_PAIRS.map(
          (languagePair) => [
            languagePair,

            safeRuns.filter(
              (run) =>
                run.languagePair ===
                languagePair
            ).length,
          ]
        )
      );

    const normalizationVersions =
      [
        ...new Set(
          safeRuns
            .map(
              (run) =>
                run.benchmark
                  ?.normalizationVersion
            )
            .filter(Boolean)
        ),
      ];

    const byLanguagePair =
      Object.fromEntries(
        SUPPORTED_LANGUAGE_PAIRS
          .map(
            (languagePair) => {
              const pairRuns =
                safeRuns.filter(
                  (run) =>
                    run.languagePair ===
                    languagePair
                );

              if (
                pairRuns.length ===
                0
              ) {
                return null;
              }

              return [
                languagePair,
                {
                  sampleCount:
                    pairRuns.length,

                  providers:
                    buildProviderTable(
                      pairRuns
                    ),
                },
              ];
            }
          )
          .filter(Boolean)
      );

    return {
      reportVersion:
        REPORT_VERSION,

      sampleCount:
        safeRuns.length,

      providerOrder:
        [...DEFAULT_PROVIDER_IDS],

      normalizationVersions,

      languagePairCounts,

      providers:
        buildProviderTable(
          safeRuns
        ),

      byLanguagePair,
    };
  };

const csvEscape = (
  value
) => {
  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }

  const text =
    String(value);

  return /[",\r\n]/.test(
    text
  )
    ? `"${text.replace(
        /"/g,
        '""'
      )}"`
    : text;
};

const metricForCsv = (
  value
) =>
  Number.isFinite(value)
    ? value.toFixed(6)
    : "";

const providerToCsvRow = ({
  scope,
  languagePair,
  summary,
}) => [
  scope,
  languagePair || "",
  summary.provider,
  summary.samplesRequested,
  summary.successfulTranscriptions,
  metricForCsv(
    summary.completionRate
  ),
  summary.werSampleCount,
  summary.totalReferenceWords,
  summary.totalWordErrors,
  metricForCsv(
    summary.corpusWer
  ),
  metricForCsv(
    summary.meanSampleWer
  ),
  metricForCsv(
    summary.averageLatencyMs
  ),
  summary
    .downstreamRequestedSamples,
  summary
    .downstreamEvaluatedSamples,
  metricForCsv(
    summary.intentAccuracy
  ),
  metricForCsv(
    summary
      .requestedActionAccuracy
  ),
  metricForCsv(
    summary
      .entityExactMatchRate
  ),
  metricForCsv(
    summary
      .averageRequiredEntityRecall
  ),
  summary.taskSuccessCount,
  metricForCsv(
    summary.taskSuccessRate
  ),
];

const buildCodeswitchBenchmarkCsv =
  (
    report
  ) => {
    if (
      !isPlainObject(report) ||
      report.reportVersion !==
        REPORT_VERSION ||
      !Array.isArray(
        report.providers
      )
    ) {
      throw new TypeError(
        "A valid VoiceBridge benchmark report is required."
      );
    }

    const rows = [
      [
        "scope",
        "language_pair",
        "provider",
        "samples_requested",
        "successful_transcriptions",
        "completion_rate",
        "wer_sample_count",
        "total_reference_words",
        "total_word_errors",
        "corpus_wer",
        "mean_sample_wer",
        "average_latency_ms",
        "downstream_requested_samples",
        "downstream_evaluated_samples",
        "intent_accuracy",
        "requested_action_accuracy",
        "entity_exact_match_rate",
        "average_required_entity_recall",
        "task_success_count",
        "task_success_rate",
      ],
    ];

    for (
      const provider of
        report.providers
    ) {
      rows.push(
        providerToCsvRow({
          scope:
            "overall",

          languagePair:
            "",

          summary:
            provider,
        })
      );
    }

    for (
      const [
        languagePair,
        pairReport,
      ] of Object.entries(
        report.byLanguagePair ||
          {}
      )
    ) {
      for (
        const provider of
          pairReport.providers
      ) {
        rows.push(
          providerToCsvRow({
            scope:
              "language_pair",

            languagePair,

            summary:
              provider,
          })
        );
      }
    }

    return (
      rows
        .map(
          (row) =>
            row
              .map(
                csvEscape
              )
              .join(",")
        )
        .join("\n") +
      "\n"
    );
  };

module.exports = {
  REPORT_VERSION,
  SUPPORTED_LANGUAGE_PAIRS,
  aggregateCodeswitchBenchmarkRuns,
  aggregateProvider,
  buildCodeswitchBenchmarkCsv,
  validateRuns,
};