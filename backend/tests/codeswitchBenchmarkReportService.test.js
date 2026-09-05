const {
  REPORT_VERSION,
  aggregateCodeswitchBenchmarkRuns,
  buildCodeswitchBenchmarkCsv,
  validateRuns,
} = require(
  "../services/codeswitchBenchmarkReportService"
);

const wer = ({
  substitutions = 0,
  deletions = 0,
  insertions = 0,
  referenceWordCount,
}) => ({
  wer:
    (
      substitutions +
      deletions +
      insertions
    ) /
    referenceWordCount,

  substitutions,
  deletions,
  insertions,
  referenceWordCount,
});

const successModel = ({
  provider,
  latencyMs,
  evaluation,
}) => ({
  ok: true,
  provider,
  model:
    `${provider}-model`,
  transcript:
    "sample transcript",
  latencyMs,
  evaluation,
});

const failureModel = (
  provider
) => ({
  ok: false,
  provider,
  error: {
    code:
      "PROVIDER_FAILED",
    message:
      "Provider failed.",
  },
});

const downstream = ({
  provider,
  available = true,
  intentCorrect = true,
  requestedActionCorrect =
    true,
  entitiesExactMatch = true,
  requiredEntityRecall = 1,
  taskSuccess = true,
}) =>
  available
    ? {
        provider,
        evaluationAvailable:
          true,

        metrics: {
          intentCorrect,
          requestedActionCorrect,
          entitiesExactMatch,
          requiredEntityRecall,
        },

        taskSuccess,
      }
    : {
        provider,
        evaluationAvailable:
          false,

        taskSuccess:
          false,

        reason:
          "ASR provider failed.",
      };

const makeRun = ({
  sampleId,
  languagePair,
  models,
  downstreamModels,
}) => ({
  sampleId,
  languagePair,

  benchmark: {
    normalizationVersion:
      "voicebridge-nwer-v1",

    models,

    downstreamEvaluation: {
      models:
        downstreamModels,
    },
  },
});

describe(
  "codeswitchBenchmarkReportService",
  () => {
    const runs = [
      makeRun({
        sampleId:
          "ha-en-001",

        languagePair:
          "ha-en",

        models: [
          successModel({
            provider:
              "sahara",

            latencyMs:
              100,

            evaluation:
              wer({
                substitutions:
                  1,
                referenceWordCount:
                  10,
              }),
          }),

          successModel({
            provider:
              "openai",

            latencyMs:
              200,

            evaluation:
              wer({
                substitutions:
                  2,
                referenceWordCount:
                  10,
              }),
          }),

          failureModel(
            "whisper"
          ),

          successModel({
            provider:
              "chirp",

            latencyMs:
              150,

            evaluation:
              wer({
                referenceWordCount:
                  10,
              }),
          }),
        ],

        downstreamModels: [
          downstream({
            provider:
              "sahara",
          }),

          downstream({
            provider:
              "openai",

            entitiesExactMatch:
              false,

            requiredEntityRecall:
              0.5,

            taskSuccess:
              false,
          }),

          downstream({
            provider:
              "whisper",

            available:
              false,

            taskSuccess:
              false,
          }),

          downstream({
            provider:
              "chirp",
          }),
        ],
      }),

      makeRun({
        sampleId:
          "pcm-en-001",

        languagePair:
          "pcm-en",

        models: [
          successModel({
            provider:
              "sahara",

            latencyMs:
              120,

            evaluation:
              wer({
                referenceWordCount:
                  5,
              }),
          }),

          successModel({
            provider:
              "openai",

            latencyMs:
              220,

            evaluation:
              wer({
                substitutions:
                  1,
                referenceWordCount:
                  5,
              }),
          }),

          successModel({
            provider:
              "whisper",

            latencyMs:
              300,

            evaluation:
              wer({
                substitutions:
                  2,
                referenceWordCount:
                  5,
              }),
          }),

          successModel({
            provider:
              "chirp",

            latencyMs:
              160,

            evaluation:
              wer({
                substitutions:
                  1,
                referenceWordCount:
                  5,
              }),
          }),
        ],

        downstreamModels: [
          downstream({
            provider:
              "sahara",
          }),

          downstream({
            provider:
              "openai",

            intentCorrect:
              false,

            entitiesExactMatch:
              false,

            requiredEntityRecall:
              0.5,

            taskSuccess:
              false,
          }),

          downstream({
            provider:
              "whisper",

            taskSuccess:
              true,
          }),

          downstream({
            provider:
              "chirp",
          }),
        ],
      }),
    ];

    test(
      "aggregates corpus WER instead of only averaging sample WER",
      () => {
        const report =
          aggregateCodeswitchBenchmarkRuns(
            runs
          );

        expect(
          report.reportVersion
        ).toBe(
          REPORT_VERSION
        );

        expect(
          report.sampleCount
        ).toBe(2);

        const sahara =
          report.providers.find(
            (provider) =>
              provider.provider ===
              "sahara"
          );

        expect(
          sahara.totalReferenceWords
        ).toBe(15);

        expect(
          sahara.totalWordErrors
        ).toBe(1);

        expect(
          sahara.corpusWer
        ).toBeCloseTo(
          1 / 15,
          8
        );

        expect(
          sahara.meanSampleWer
        ).toBeCloseTo(
          0.05,
          8
        );

        expect(
          sahara.averageLatencyMs
        ).toBe(110);
      }
    );

    test(
      "counts provider failure against task success but not semantic accuracy denominator",
      () => {
        const report =
          aggregateCodeswitchBenchmarkRuns(
            runs
          );

        const whisper =
          report.providers.find(
            (provider) =>
              provider.provider ===
              "whisper"
          );

        expect(
          whisper.samplesRequested
        ).toBe(2);

        expect(
          whisper
            .successfulTranscriptions
        ).toBe(1);

        expect(
          whisper.completionRate
        ).toBe(0.5);

        expect(
          whisper
            .downstreamRequestedSamples
        ).toBe(2);

        expect(
          whisper
            .downstreamEvaluatedSamples
        ).toBe(1);

        expect(
          whisper.intentAccuracy
        ).toBe(1);

        expect(
          whisper.taskSuccessCount
        ).toBe(1);

        expect(
          whisper.taskSuccessRate
        ).toBe(0.5);
      }
    );

    test(
      "produces separate Hausa-English and Pidgin-English provider summaries",
      () => {
        const report =
          aggregateCodeswitchBenchmarkRuns(
            runs
          );

        expect(
          report.languagePairCounts
        ).toEqual({
          "ha-en": 1,
          "pcm-en": 1,
        });

        expect(
          report.byLanguagePair[
            "ha-en"
          ].sampleCount
        ).toBe(1);

        expect(
          report.byLanguagePair[
            "pcm-en"
          ].sampleCount
        ).toBe(1);

        const openAiOverall =
          report.providers.find(
            (provider) =>
              provider.provider ===
              "openai"
          );

        expect(
          openAiOverall.corpusWer
        ).toBeCloseTo(
          3 / 15,
          8
        );

        expect(
          openAiOverall
            .intentAccuracy
        ).toBe(0.5);

        expect(
          openAiOverall
            .entityExactMatchRate
        ).toBe(0);

        expect(
          openAiOverall
            .taskSuccessRate
        ).toBe(0);
      }
    );

    test(
      "keeps asr-only samples out of downstream metric denominators",
      () => {
        const providers = [
          "sahara",
          "openai",
          "whisper",
          "chirp",
        ];

        const asrOnlyRun = {
          sampleId:
            "ha-en-asr-only",

          languagePair:
            "ha-en",

          evaluationMode:
            "asr-only",

          benchmark: {
            normalizationVersion:
              "voicebridge-nwer-v1",

            models:
              providers.map(
                (provider) =>
                  successModel({
                    provider,
                    latencyMs:
                      100,
                    evaluation:
                      wer({
                        referenceWordCount:
                          10,
                      }),
                  })
              ),
          },
        };

        const report =
          aggregateCodeswitchBenchmarkRuns([
            asrOnlyRun,
          ]);

        for (
          const provider of
            report.providers
        ) {
          expect(
            provider
              .downstreamRequestedSamples
          ).toBe(0);

          expect(
            provider
              .downstreamEvaluatedSamples
          ).toBe(0);

          expect(
            provider.intentAccuracy
          ).toBeNull();

          expect(
            provider.taskSuccessRate
          ).toBeNull();
        }
      }
    );

    test(
      "exports report-ready CSV rows",
      () => {
        const report =
          aggregateCodeswitchBenchmarkRuns(
            runs
          );

        const csv =
          buildCodeswitchBenchmarkCsv(
            report
          );

        expect(csv).toContain(
          "scope,language_pair,provider"
        );

        expect(csv).toContain(
          "overall,,sahara"
        );

        expect(csv).toContain(
          "language_pair,ha-en,sahara"
        );

        expect(csv).toContain(
          "language_pair,pcm-en,openai"
        );
      }
    );

    test(
      "rejects duplicate sample IDs",
      () => {
        expect(
          () =>
            validateRuns([
              runs[0],
              {
                ...runs[1],
                sampleId:
                  runs[0]
                    .sampleId,
              },
            ])
        ).toThrow(
          "Duplicate benchmark sampleId"
        );
      }
    );

    test(
      "rejects unsupported language pairs",
      () => {
        expect(
          () =>
            validateRuns([
              {
                ...runs[0],
                languagePair:
                  "yo-en",
              },
            ])
        ).toThrow(
          "languagePair must be one of: ha-en, pcm-en."
        );
      }
    );
  }
);