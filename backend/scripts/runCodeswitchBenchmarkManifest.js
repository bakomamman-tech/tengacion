const path =
  require("path");

const dotenv =
  require("dotenv");

const {
  loadCodeswitchBenchmarkManifest,
  preflightCodeswitchBenchmarkManifest,
  runCodeswitchBenchmarkManifest,
} = require(
  "../services/codeswitchBenchmarkManifestService"
);

const REPO_ROOT =
  path.resolve(
    __dirname,
    "../.."
  );

dotenv.config({
  path:
    path.join(
      REPO_ROOT,
      ".env"
    ),
  quiet: true,
});

dotenv.config({
  path:
    path.join(
      REPO_ROOT,
      "backend",
      ".env"
    ),
  quiet: true,
});

const usage = () => {
  console.log(`
VoiceBridge benchmark manifest runner

Usage:
  npm run benchmark:codeswitch --prefix backend -- <manifest.json> --validate-only
  npm run benchmark:codeswitch --prefix backend -- <manifest.json> --live
  npm run benchmark:codeswitch --prefix backend -- <manifest.json> --live --output <directory>

Paths are resolved relative to the repository root unless absolute.

Provider APIs are never called unless --live is explicitly supplied.

Example:
  npm run benchmark:codeswitch --prefix backend -- artifacts/voicebridge-benchmark/manifest.json --validate-only
`);
};

const parseArgs = (
  argv
) => {
  const args =
    [...argv];

  if (
    args.includes("--help") ||
    args.includes("-h")
  ) {
    return {
      help: true,
    };
  }

  const manifestArg =
    args.find(
      (arg, index) =>
        !arg.startsWith(
          "--"
        ) &&
        args[
          index - 1
        ] !==
          "--output"
    );

  if (!manifestArg) {
    throw new TypeError(
      "A benchmark manifest path is required."
    );
  }

  const outputIndex =
    args.indexOf(
      "--output"
    );

  const outputArg =
    outputIndex >= 0
      ? args[
          outputIndex + 1
        ]
      : null;

  if (
    outputIndex >= 0 &&
    (
      !outputArg ||
      outputArg.startsWith(
        "--"
      )
    )
  ) {
    throw new TypeError(
      "--output requires a directory path."
    );
  }

  const validateOnly =
    args.includes(
      "--validate-only"
    );

  const live =
    args.includes(
      "--live"
    );

  if (
    validateOnly &&
    live
  ) {
    throw new RangeError(
      "--validate-only and --live cannot be used together."
    );
  }

  return {
    help: false,

    manifestArg,

    validateOnly,

    live,

    outputArg,
  };
};

const resolveRepoPath = (
  value
) =>
  path.isAbsolute(value)
    ? path.normalize(value)
    : path.resolve(
        REPO_ROOT,
        value
      );

const main =
  async () => {
    const parsed =
      parseArgs(
        process.argv.slice(2)
      );

    if (parsed.help) {
      usage();
      return;
    }

    const manifestPath =
      resolveRepoPath(
        parsed.manifestArg
      );

    const manifest =
      await loadCodeswitchBenchmarkManifest({
        manifestPath,
      });

    if (
      parsed.validateOnly
    ) {
      const prepared =
        await preflightCodeswitchBenchmarkManifest({
          manifest,
          repoRoot:
            REPO_ROOT,
        });

      console.log(
        "\nVoiceBridge benchmark manifest is valid."
      );

      console.table(
        prepared.map(
          ({
            sample,
            audio,
            goldSource,
          }) => ({
            sampleId:
              sample.sampleId,

            languagePair:
              sample.languagePair,

            evaluationMode:
              sample.evaluationMode,

            filename:
              audio.filename,

            bytes:
              audio.buffer.length,

            mimeType:
              audio.mimeType,

            sha256:
              audio.sha256,

            goldSource,
          })
        )
      );

      console.log(
        `Validated ${prepared.length} sample(s). No provider API calls were made.`
      );

      return;
    }

    if (!parsed.live) {
      throw new Error(
        "Provider execution requires explicit --live. Use --validate-only for preflight."
      );
    }

    const outputDir =
      parsed.outputArg ||
      "artifacts/voicebridge-benchmark";

    const result =
      await runCodeswitchBenchmarkManifest({
        manifest,

        manifestPath,

        repoRoot:
          REPO_ROOT,

        outputDir,
      });

    console.log(
      `\nCompleted ${result.sampleCount} VoiceBridge benchmark sample(s).`
    );

    console.log(
      `Raw runs: ${result.paths.runsDir}`
    );

    console.log(
      `Combined runs: ${result.paths.combinedRuns}`
    );

    console.log(
      `Report JSON: ${result.paths.reportJson}`
    );

    console.log(
      `Report CSV: ${result.paths.reportCsv}`
    );
  };

main().catch(
  (error) => {
    console.error(
      "\nVoiceBridge benchmark manifest runner failed:"
    );

    console.error(
      error?.message ||
      error
    );

    process.exitCode =
      1;
  }
);