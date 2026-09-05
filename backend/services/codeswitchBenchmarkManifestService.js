const fs =
  require("fs/promises");
const path =
  require("path");

const {
  MAX_TRANSCRIPT_CHARS,
  MAX_TRANSCRIPT_WORDS,
  normalizeTranscript,
} = require(
  "./codeswitchService"
);

const {
  analyzeCodeswitchIntent,
} = require(
  "./codeswitchIntentService"
);

const {
  runCodeswitchBenchmark,
} = require(
  "./codeswitchBenchmarkService"
);

const {
  evaluateDownstreamBenchmark,
} = require(
  "./codeswitchDownstreamBenchmarkService"
);

const {
  aggregateCodeswitchBenchmarkRuns,
  buildCodeswitchBenchmarkCsv,
} = require(
  "./codeswitchBenchmarkReportService"
);

const MANIFEST_VERSION =
  "voicebridge-benchmark-manifest-v1";

const LANGUAGE_PAIR_TO_CODE =
  Object.freeze({
    "ha-en": "ha",
    "pcm-en": "pcm",
  });

const MIME_BY_EXTENSION =
  Object.freeze({
    ".wav": "audio/wav",
    ".mp3": "audio/mpeg",
    ".m4a": "audio/mp4",
    ".mp4": "audio/mp4",
    ".webm": "audio/webm",
    ".ogg": "audio/ogg",
    ".flac": "audio/flac",
  });

const SAMPLE_ID_PATTERN =
  /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

const isPlainObject = (
  value
) =>
  Boolean(
    value &&
      typeof value ===
        "object" &&
      !Array.isArray(value)
  );

const inferAudioMimeType = (
  filename
) => {
  if (
    typeof filename !==
      "string" ||
    !filename.trim()
  ) {
    throw new TypeError(
      "Audio filename must be a non-empty string."
    );
  }

  const extension =
    path
      .extname(filename)
      .toLowerCase();

  const mimeType =
    MIME_BY_EXTENSION[
      extension
    ];

  if (!mimeType) {
    throw new RangeError(
      `Unsupported benchmark audio extension: ${extension || "(none)"}`
    );
  }

  return mimeType;
};

const buildDownstreamGold = (
  analysis
) => ({
  intent:
    analysis.intent,

  requestedAction:
    analysis.requestedAction,

  entities: {
    amount:
      analysis.entities?.amount ??
      null,

    currency:
      analysis.entities?.currency ??
      null,

    timeReference:
      analysis.entities
        ?.timeReference ??
      null,

    transactionReference:
      analysis.entities
        ?.transactionReference ??
      null,
  },
});

const validateReferenceTranscript =
  (
    referenceTranscript,
    sampleId
  ) => {
    if (
      typeof referenceTranscript !==
        "string" ||
      !referenceTranscript.trim()
    ) {
      throw new TypeError(
        `Benchmark sample ${sampleId} must contain a non-empty referenceTranscript.`
      );
    }

    if (
      referenceTranscript.length >
      MAX_TRANSCRIPT_CHARS
    ) {
      throw new RangeError(
        `Benchmark sample ${sampleId} referenceTranscript exceeds ${MAX_TRANSCRIPT_CHARS} characters.`
      );
    }

    const normalized =
      normalizeTranscript(
        referenceTranscript
      );

    const wordCount =
      normalized
        ? normalized.split(
            " "
          ).length
        : 0;

    if (wordCount === 0) {
      throw new RangeError(
        `Benchmark sample ${sampleId} referenceTranscript contains no normalized words.`
      );
    }

    if (
      wordCount >
      MAX_TRANSCRIPT_WORDS
    ) {
      throw new RangeError(
        `Benchmark sample ${sampleId} referenceTranscript exceeds ${MAX_TRANSCRIPT_WORDS} normalized words.`
      );
    }
  };

const validateSample = (
  sample,
  seenSampleIds
) => {
  if (
    !isPlainObject(sample)
  ) {
    throw new TypeError(
      "Every benchmark manifest sample must be an object."
    );
  }

  if (
    typeof sample.sampleId !==
      "string" ||
    !sample.sampleId.trim()
  ) {
    throw new TypeError(
      "Every benchmark manifest sample must have a non-empty sampleId."
    );
  }

  const sampleId =
    sample.sampleId.trim();

  if (
    !SAMPLE_ID_PATTERN.test(
      sampleId
    )
  ) {
    throw new RangeError(
      `Invalid benchmark sampleId: ${sampleId}`
    );
  }

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
    !Object.prototype
      .hasOwnProperty.call(
        LANGUAGE_PAIR_TO_CODE,
        sample.languagePair
      )
  ) {
    throw new RangeError(
      "languagePair must be one of: ha-en, pcm-en."
    );
  }

  if (
    typeof sample.audioPath !==
      "string" ||
    !sample.audioPath.trim()
  ) {
    throw new TypeError(
      `Benchmark sample ${sampleId} must contain a non-empty audioPath.`
    );
  }

  validateReferenceTranscript(
    sample.referenceTranscript,
    sampleId
  );

  if (
    sample.mimeType !==
      undefined &&
    (
      typeof sample.mimeType !==
        "string" ||
      !sample.mimeType.trim()
    )
  ) {
    throw new TypeError(
      `Benchmark sample ${sampleId} mimeType must be a non-empty string when supplied.`
    );
  }

  if (
    sample.source !==
      undefined &&
    !isPlainObject(
      sample.source
    )
  ) {
    throw new TypeError(
      `Benchmark sample ${sampleId} source must be an object when supplied.`
    );
  }

  if (
    sample.downstreamGold !==
      undefined &&
    sample.downstreamGold !==
      null
  ) {
    evaluateDownstreamBenchmark({
      models: [],
      languagePair:
        sample.languagePair,
      gold:
        sample.downstreamGold,
    });
  }

  return {
    ...sample,
    sampleId,
    audioPath:
      sample.audioPath.trim(),
  };
};

const validateCodeswitchBenchmarkManifest =
  (
    manifest
  ) => {
    if (
      !isPlainObject(
        manifest
      )
    ) {
      throw new TypeError(
        "VoiceBridge benchmark manifest must be an object."
      );
    }

    if (
      manifest.version !==
      MANIFEST_VERSION
    ) {
      throw new RangeError(
        `Benchmark manifest version must be ${MANIFEST_VERSION}.`
      );
    }

    if (
      !Array.isArray(
        manifest.samples
      ) ||
      manifest.samples.length ===
        0
    ) {
      throw new TypeError(
        "Benchmark manifest samples must be a non-empty array."
      );
    }

    const seenSampleIds =
      new Set();

    return {
      ...manifest,

      samples:
        manifest.samples.map(
          (sample) =>
            validateSample(
              sample,
              seenSampleIds
            )
        ),
    };
  };

const resolveRepoPath = (
  repoRoot,
  filePath
) => {
  if (
    typeof repoRoot !==
      "string" ||
    !repoRoot.trim()
  ) {
    throw new TypeError(
      "repoRoot must be a non-empty string."
    );
  }

  return path.isAbsolute(
    filePath
  )
    ? path.normalize(
        filePath
      )
    : path.resolve(
        repoRoot,
        filePath
      );
};

const loadCodeswitchBenchmarkManifest =
  async ({
    manifestPath,
    fsApi = fs,
  } = {}) => {
    if (
      typeof manifestPath !==
        "string" ||
      !manifestPath.trim()
    ) {
      throw new TypeError(
        "manifestPath must be a non-empty string."
      );
    }

    const raw =
      await fsApi.readFile(
        manifestPath,
        "utf8"
      );

    let manifest;

    try {
      manifest =
        JSON.parse(raw);
    } catch {
      throw new SyntaxError(
        "VoiceBridge benchmark manifest must contain valid JSON."
      );
    }

    return validateCodeswitchBenchmarkManifest(
      manifest
    );
  };

const preflightCodeswitchBenchmarkManifest =
  async ({
    manifest,
    repoRoot,
    fsApi = fs,
    analyzeIntent =
      analyzeCodeswitchIntent,
  } = {}) => {
    const validated =
      validateCodeswitchBenchmarkManifest(
        manifest
      );

    const prepared = [];

    /*
     * Preflight every audio file before
     * the first provider API call.
     *
     * This prevents spending credits on
     * sample 1 only to discover sample 5
     * has a missing/broken path.
     */
    for (
      const sample of
        validated.samples
    ) {
      const audioFilePath =
        resolveRepoPath(
          repoRoot,
          sample.audioPath
        );

      const buffer =
        await fsApi.readFile(
          audioFilePath
        );

      if (
        !Buffer.isBuffer(buffer) ||
        buffer.length === 0
      ) {
        throw new RangeError(
          `Benchmark audio is empty: ${sample.audioPath}`
        );
      }

      const mimeType =
        sample.mimeType ||
        inferAudioMimeType(
          audioFilePath
        );

      let downstreamGold =
        sample.downstreamGold ||
        null;

      let goldSource =
        "manifest";

      if (!downstreamGold) {
        const analysis =
          analyzeIntent({
            transcript:
              sample.referenceTranscript,

            languagePair:
              sample.languagePair,
          });

        downstreamGold =
          buildDownstreamGold(
            analysis
          );

        goldSource =
          "derived-from-reference";
      }

      /*
       * Validate derived gold too.
       */
      evaluateDownstreamBenchmark({
        models: [],
        languagePair:
          sample.languagePair,
        gold:
          downstreamGold,
      });

      prepared.push({
        sample,
        audioFilePath,
        audio: {
          buffer,

          filename:
            path.basename(
              audioFilePath
            ),

          mimeType,
        },

        downstreamGold,
        goldSource,
      });
    }

    return prepared;
  };

const writeJson =
  async (
    fsApi,
    filePath,
    value
  ) => {
    await fsApi.writeFile(
      filePath,
      JSON.stringify(
        value,
        null,
        2
      ) + "\n",
      "utf8"
    );
  };

const runCodeswitchBenchmarkManifest =
  async ({
    manifest,
    manifestPath,
    repoRoot,
    outputDir,
    fsApi = fs,
    runBenchmark =
      runCodeswitchBenchmark,
    analyzeIntent =
      analyzeCodeswitchIntent,
    now = () =>
      new Date(),
    logger = console,
  } = {}) => {
    if (
      typeof manifestPath !==
        "string" ||
      !manifestPath.trim()
    ) {
      throw new TypeError(
        "manifestPath must be a non-empty string."
      );
    }

    if (
      typeof outputDir !==
        "string" ||
      !outputDir.trim()
    ) {
      throw new TypeError(
        "outputDir must be a non-empty string."
      );
    }

    const prepared =
      await preflightCodeswitchBenchmarkManifest({
        manifest,
        repoRoot,
        fsApi,
        analyzeIntent,
      });

    const resolvedOutputDir =
      resolveRepoPath(
        repoRoot,
        outputDir
      );

    const runsDir =
      path.join(
        resolvedOutputDir,
        "runs"
      );

    await fsApi.mkdir(
      runsDir,
      {
        recursive: true,
      }
    );

    const runRecords = [];

    /*
     * Deliberately sequential.
     *
     * Each benchmark call already fans
     * one source clip out to all four
     * providers. Running multiple clips
     * in parallel would multiply provider
     * concurrency and distort reliability.
     */
    for (
      const preparedSample of
        prepared
    ) {
      const {
        sample,
        audio,
        downstreamGold,
        goldSource,
      } =
        preparedSample;

      if (
        logger &&
        typeof logger.log ===
          "function"
      ) {
        logger.log(
          `[voicebridge:manifest] running ${sample.sampleId} (${sample.languagePair})`
        );
      }

      const result =
        await runBenchmark({
          audio,

          languagePair:
            sample.languagePair,

          languageCode:
            LANGUAGE_PAIR_TO_CODE[
              sample.languagePair
            ],

          referenceTranscript:
            sample.referenceTranscript,

          downstreamGold,

          requestId:
            `manifest-${sample.sampleId}`,
        });

      const capturedAt =
        now().toISOString();

      const runRecord = {
        sampleId:
          sample.sampleId,

        languagePair:
          sample.languagePair,

        source:
          sample.source ||
          null,

        audio: {
          path:
            sample.audioPath,

          filename:
            audio.filename,

          mimeType:
            audio.mimeType,

          bytes:
            audio.buffer.length,
        },

        referenceTranscript:
          sample.referenceTranscript,

        downstreamGold,

        goldSource,

        capturedAt,

        statusCode:
          result.statusCode,

        benchmark:
          result.body,
      };

      runRecords.push(
        runRecord
      );

      await writeJson(
        fsApi,
        path.join(
          runsDir,
          `${sample.sampleId}.json`
        ),
        runRecord
      );
    }

    const report =
      aggregateCodeswitchBenchmarkRuns(
        runRecords
      );

    const generatedAt =
      now().toISOString();

    const reportArtifact = {
      ...report,

      generatedAt,

      manifestVersion:
        manifest.version,

      sourceManifest:
        path.basename(
          manifestPath
        ),
    };

    const csv =
      buildCodeswitchBenchmarkCsv(
        reportArtifact
      );

    const runsArtifact = {
      manifestVersion:
        manifest.version,

      generatedAt,

      sourceManifest:
        path.basename(
          manifestPath
        ),

      samples:
        runRecords,
    };

    const paths = {
      outputDir:
        resolvedOutputDir,

      runsDir,

      combinedRuns:
        path.join(
          resolvedOutputDir,
          "benchmark-runs.json"
        ),

      reportJson:
        path.join(
          resolvedOutputDir,
          "benchmark-report.json"
        ),

      reportCsv:
        path.join(
          resolvedOutputDir,
          "benchmark-report.csv"
        ),

      manifestSnapshot:
        path.join(
          resolvedOutputDir,
          "manifest.snapshot.json"
        ),
    };

    await writeJson(
      fsApi,
      paths.combinedRuns,
      runsArtifact
    );

    await writeJson(
      fsApi,
      paths.reportJson,
      reportArtifact
    );

    await fsApi.writeFile(
      paths.reportCsv,
      csv,
      "utf8"
    );

    await writeJson(
      fsApi,
      paths.manifestSnapshot,
      manifest
    );

    return {
      sampleCount:
        runRecords.length,

      runs:
        runRecords,

      report:
        reportArtifact,

      paths,
    };
  };

module.exports = {
  LANGUAGE_PAIR_TO_CODE,
  MANIFEST_VERSION,
  buildDownstreamGold,
  inferAudioMimeType,
  loadCodeswitchBenchmarkManifest,
  preflightCodeswitchBenchmarkManifest,
  runCodeswitchBenchmarkManifest,
  validateCodeswitchBenchmarkManifest,
};