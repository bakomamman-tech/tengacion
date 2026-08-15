const fs = require("fs");
const path = require("path");

const { buildStaticAkusoReleaseGate } = require("../services/assistant/releaseGateService");

const outputArg = process.argv.find((arg) => arg.startsWith("--output="));
const outputPath = outputArg
  ? outputArg.slice("--output=".length)
  : path.resolve(__dirname, "../../artifacts/akuso-release-gate.json");
const report = buildStaticAkusoReleaseGate({ includeChecks: true });
const failedChecks = report.checks.filter((check) => check.blocking && !check.passed);
const payload = {
  ...report,
  decision: failedChecks.length ? "blocked" : "ready_pending_review_backlog",
  releaseReady: failedChecks.length === 0,
  blockers: failedChecks.map((check) => check.label),
  reviewBacklog: {
    checked: false,
    note: "Review the authenticated Admin Assistant release gate before deployment.",
  },
};

const resolved = path.resolve(process.cwd(), outputPath);
fs.mkdirSync(path.dirname(resolved), { recursive: true });
fs.writeFileSync(resolved, `${JSON.stringify(payload, null, 2)}\n`);

console.log(`Akuso release gate: ${payload.decision}`);
console.log(`Report: ${resolved}`);
if (failedChecks.length) {
  console.error(`Blocking checks: ${payload.blockers.join(", ")}`);
  process.exitCode = 1;
}
