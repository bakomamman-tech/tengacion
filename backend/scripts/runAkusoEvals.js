const { runAkusoEvals } = require("../services/akusoEvalRunner");

const results = runAkusoEvals();
const failed = results.filter((entry) => !entry.passed);

console.table(results);

if (failed.length > 0) {
  process.exitCode = 1;
}
