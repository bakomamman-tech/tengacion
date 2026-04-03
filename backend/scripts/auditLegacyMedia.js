const { run } = require("./reportLegacyMedia");

run(process.argv.slice(2)).catch((error) => {
  console.error("Legacy media audit failed:", error?.message || error);
  process.exitCode = 1;
});
