const fs =
  require("fs/promises");
const os =
  require("os");
const path =
  require("path");

const {
  MANIFEST_VERSION,
  inferAudioMimeType,
  preflightCodeswitchBenchmarkManifest,
  runCodeswitchBenchmarkManifest,
  validateCodeswitchBenchmarkManifest,
} = require(
  "../services/codeswitchBenchmarkManifestService"
);

const explicitGold = {
  intent:
    "payment_confirmation_check",

  requestedAction:
    "check_payment_status",

  entities: {
    amount: 5000,
    currency: "NGN",
    timeReference:
      "yesterday",
    transactionReference:
      null,
  },
};

const reference =
  "Don Allah check my payment, na biya naira dubu biyar jiya amma ban samu confirmation ba.";

const makeManifest = () => ({
  version:
    MANIFEST_VERSION,

  samples: [
    {
      sampleId:
        "ha-en-001",

      languagePair:
        "ha-en",

      audioPath:
        "audio/ha-en-001.wav",

      referenceTranscript:
        reference,

      downstreamGold:
        explicitGold,
    },

    {
      sampleId:
        "pcm-en-001",

      languagePair:
        "pcm-en",

      audioPath:
        "audio/pcm-en-001.wav",

      referenceTranscript:
        "Abeg check my payment, I pay five thousand naira yesterday but confirmation never enter."
    },
  ],
});

const model = (
  provider
) => ({
  ok: true,

  provider,

  model:
    `${provider}-model`,

  transcript:
    reference,

  latencyMs:
    100,

  evaluation: {
    wer: 0,
    substitutions: 0,
    deletions: 0,
    insertions: 0,
    referenceWordCount:
      15,
  },
});

const downstreamModel = (
  provider
) => ({
  provider,

  evaluationAvailable:
    true,

  metrics: {
    intentCorrect:
      true,

    requestedActionCorrect:
      true,

    entitiesExactMatch:
      true,

    requiredEntityRecall:
      1,
  },

  taskSuccess:
    true,
});

const fakeBenchmarkResult =
  () => ({
    statusCode: 200,

    body: {
      ok: true,

      normalizationVersion:
        "voicebridge-nwer-v1",

      models: [
        model("sahara"),
        model("openai"),
        model("whisper"),
        model("chirp"),
      ],

      downstreamEvaluation: {
        models: [
          downstreamModel(
            "sahara"
          ),

          downstreamModel(
            "openai"
          ),

          downstreamModel(
            "whisper"
          ),

          downstreamModel(
            "chirp"
          ),
        ],
      },
    },
  });

describe(
  "codeswitchBenchmarkManifestService",
  () => {
    let repoRoot;

    beforeEach(
      async () => {
        repoRoot =
          await fs.mkdtemp(
            path.join(
              os.tmpdir(),
              "voicebridge-manifest-"
            )
          );

        await fs.mkdir(
          path.join(
            repoRoot,
            "audio"
          ),
          {
            recursive: true,
          }
        );

        await fs.writeFile(
          path.join(
            repoRoot,
            "audio",
            "ha-en-001.wav"
          ),
          Buffer.from(
            "fake-ha-audio"
          )
        );

        await fs.writeFile(
          path.join(
            repoRoot,
            "audio",
            "pcm-en-001.wav"
          ),
          Buffer.from(
            "fake-pcm-audio"
          )
        );
      }
    );

    afterEach(
      async () => {
        await fs.rm(
          repoRoot,
          {
            recursive: true,
            force: true,
          }
        );
      }
    );

    test(
      "infers supported audio MIME types",
      () => {
        expect(
          inferAudioMimeType(
            "sample.wav"
          )
        ).toBe(
          "audio/wav"
        );

        expect(
          inferAudioMimeType(
            "sample.mp3"
          )
        ).toBe(
          "audio/mpeg"
        );

        expect(
          () =>
            inferAudioMimeType(
              "sample.txt"
            )
        ).toThrow(
          "Unsupported benchmark audio extension"
        );
      }
    );

    test(
      "rejects duplicate and unsafe sample IDs",
      () => {
        const duplicate =
          makeManifest();

        duplicate.samples[1]
          .sampleId =
          "ha-en-001";

        expect(
          () =>
            validateCodeswitchBenchmarkManifest(
              duplicate
            )
        ).toThrow(
          "Duplicate benchmark sampleId"
        );

        const unsafe =
          makeManifest();

        unsafe.samples[0]
          .sampleId =
          "../escape";

        expect(
          () =>
            validateCodeswitchBenchmarkManifest(
              unsafe
            )
        ).toThrow(
          "Invalid benchmark sampleId"
        );
      }
    );

    test(
      "preflights every audio file and preserves explicit versus derived gold",
      async () => {
        const prepared =
          await preflightCodeswitchBenchmarkManifest({
            manifest:
              makeManifest(),

            repoRoot,
          });

        expect(
          prepared
        ).toHaveLength(2);

        expect(
          prepared[0]
            .goldSource
        ).toBe(
          "manifest"
        );

        expect(
          prepared[0]
            .downstreamGold
        ).toEqual(
          explicitGold
        );

        expect(
          prepared[1]
            .goldSource
        ).toBe(
          "derived-from-reference"
        );

        expect(
          prepared[1]
            .downstreamGold
            .requestedAction
        ).toBe(
          "check_payment_status"
        );

        expect(
          prepared[0]
            .audio.mimeType
        ).toBe(
          "audio/wav"
        );
      }
    );

    test(
      "fails preflight before any provider call when an audio file is missing",
      async () => {
        const manifest =
          makeManifest();

        manifest.samples[1]
          .audioPath =
          "audio/missing.wav";

        const runBenchmark =
          jest.fn();

        await expect(
          runCodeswitchBenchmarkManifest({
            manifest,

            manifestPath:
              path.join(
                repoRoot,
                "manifest.json"
              ),

            repoRoot,

            outputDir:
              "output",

            runBenchmark,
          })
        ).rejects.toThrow();

        expect(
          runBenchmark
        ).not.toHaveBeenCalled();
      }
    );

    test(
      "runs samples sequentially and writes raw plus aggregate artifacts",
      async () => {
        const manifest =
          makeManifest();

        let active =
          0;

        let maxActive =
          0;

        const runBenchmark =
          jest.fn(
            async () => {
              active += 1;

              maxActive =
                Math.max(
                  maxActive,
                  active
                );

              await new Promise(
                (resolve) =>
                  setTimeout(
                    resolve,
                    5
                  )
              );

              active -= 1;

              return fakeBenchmarkResult();
            }
          );

        const result =
          await runCodeswitchBenchmarkManifest({
            manifest,

            manifestPath:
              path.join(
                repoRoot,
                "manifest.json"
              ),

            repoRoot,

            outputDir:
              "output",

            runBenchmark,

            now: () =>
              new Date(
                "2026-09-05T12:00:00.000Z"
              ),

            logger: {
              log:
                jest.fn(),
            },
          });

        expect(
          runBenchmark
        ).toHaveBeenCalledTimes(
          2
        );

        expect(
          maxActive
        ).toBe(1);

        expect(
          result.sampleCount
        ).toBe(2);

        expect(
          result.report
            .sampleCount
        ).toBe(2);

        expect(
          result.report
            .languagePairCounts
        ).toEqual({
          "ha-en": 1,
          "pcm-en": 1,
        });

        const expectedFiles = [
          path.join(
            repoRoot,
            "output",
            "runs",
            "ha-en-001.json"
          ),

          path.join(
            repoRoot,
            "output",
            "runs",
            "pcm-en-001.json"
          ),

          path.join(
            repoRoot,
            "output",
            "benchmark-runs.json"
          ),

          path.join(
            repoRoot,
            "output",
            "benchmark-report.json"
          ),

          path.join(
            repoRoot,
            "output",
            "benchmark-report.csv"
          ),

          path.join(
            repoRoot,
            "output",
            "manifest.snapshot.json"
          ),
        ];

        for (
          const expectedFile of
            expectedFiles
        ) {
          await expect(
            fs.stat(
              expectedFile
            )
          ).resolves.toEqual(
            expect.objectContaining({
              size:
                expect.any(
                  Number
                ),
            })
          );
        }

        const reportCsv =
          await fs.readFile(
            path.join(
              repoRoot,
              "output",
              "benchmark-report.csv"
            ),
            "utf8"
          );

        expect(
          reportCsv
        ).toContain(
          "overall,,sahara"
        );

        const rawRun =
          JSON.parse(
            await fs.readFile(
              path.join(
                repoRoot,
                "output",
                "runs",
                "ha-en-001.json"
              ),
              "utf8"
            )
          );

        expect(
          rawRun.audio
        ).toEqual(
          expect.objectContaining({
            filename:
              "ha-en-001.wav",

            mimeType:
              "audio/wav",
          })
        );

        expect(
          rawRun.audio
            .buffer
        ).toBeUndefined();
      }
    );
  }
);