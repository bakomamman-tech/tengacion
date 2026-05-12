const fs = require("fs");
const path = require("path");

const parseArgs = (argv = []) =>
  argv.reduce(
    (options, arg, index) => {
      if (arg === "--json") {
        options.json = true;
      } else if (arg === "--checks") {
        options.includeChecks = true;
      } else if (arg === "--output" && argv[index + 1]) {
        options.output = argv[index + 1];
      } else if (arg.startsWith("--output=")) {
        options.output = arg.slice("--output=".length);
      } else if (arg === "--suite" && argv[index + 1]) {
        options.suite = argv[index + 1];
      } else if (arg.startsWith("--suite=")) {
        options.suite = arg.slice("--suite=".length);
      } else if (arg === "--tag" && argv[index + 1]) {
        options.tag = argv[index + 1];
      } else if (arg.startsWith("--tag=")) {
        options.tag = arg.slice("--tag=".length);
      }
      return options;
    },
    {
      json: false,
      includeChecks: false,
      output: "",
      suite: "",
      tag: "",
    }
  );

const buildReport = (results) => ({
  generatedAt: new Date().toISOString(),
  summary: results.summary,
  results: Array.from(results),
});

const writeReport = (outputPath, report) => {
  if (!outputPath) {
    return "";
  }

  const resolved = path.resolve(process.cwd(), outputPath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, `${JSON.stringify(report, null, 2)}\n`);
  return resolved;
};

const loadEvalRunner = ({ quiet = false } = {}) => {
  if (!quiet) {
    return require("../services/akusoEvalRunner");
  }

  const originalLog = console.log;
  console.log = () => {};
  try {
    return require("../services/akusoEvalRunner");
  } finally {
    console.log = originalLog;
  }
};

const options = parseArgs(process.argv.slice(2));
const { runAkusoEvals } = loadEvalRunner({ quiet: options.json });
const results = runAkusoEvals({
  suite: options.suite,
  tag: options.tag,
  includeChecks: options.includeChecks || options.json || Boolean(options.output),
});
const report = buildReport(results);
const failed = results.filter((entry) => !entry.passed);
const failedRouteTargets = Array.isArray(report.summary?.failedRouteTargets)
  ? report.summary.failedRouteTargets
  : [];
const tableRows = results.map((entry) => ({
  id: entry.id,
  suite: entry.suite,
  severity: entry.severity,
  route: entry.routeKey || "",
  passed: entry.passed,
  bucket: entry.categoryBucket,
  feature: entry.featureKey,
  task: entry.task,
}));

const writtenPath = writeReport(options.output, report);

if (options.json) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.table(tableRows);
  console.log("Akuso eval summary:", report.summary);
  if (failedRouteTargets.length) {
    console.log("Akuso route quality target failures:", failedRouteTargets);
  }
  if (writtenPath) {
    console.log(`Akuso eval report written to ${writtenPath}`);
  }
}

if (failed.length > 0 || failedRouteTargets.length > 0) {
  process.exitCode = 1;
}
