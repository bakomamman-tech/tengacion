const path = require("path");
const dotenv = require("dotenv");
const mongoose = require("mongoose");

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

require("../config/env");

const connectDB = require("../config/db");
const { getLegacyMediaReport } = require("../services/mediaAuditService");

const toInt = (value, fallback = 0) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const formatNumber = (value) => Number(value || 0).toLocaleString();

const parseArgs = (argv = []) => {
  const args = Array.isArray(argv) ? argv : [];
  const options = {
    verbose: args.includes("--verbose"),
    json: args.includes("--json"),
    help: args.includes("--help") || args.includes("-h"),
    sampleLimit: 10,
    model: "",
  };

  args.forEach((entry) => {
    const value = String(entry || "");
    if (value.startsWith("--samples=")) {
      options.sampleLimit = toInt(value.split("=").slice(1).join("="), 10) || 10;
    }
    if (value.startsWith("--model=")) {
      options.model = value.split("=").slice(1).join("=");
    }
  });

  return options;
};

const printLine = (label, value = "") => {
  if (value === "" || value === undefined || value === null) {
    console.log(label);
    return;
  }
  console.log(`${label}: ${value}`);
};

const formatSamples = (samples = []) =>
  (Array.isArray(samples) ? samples : [])
    .map((entry) => `${entry.id}${entry.fields?.length ? ` (${entry.fields.join(", ")})` : ""}`)
    .join(", ");

const printHelp = () => {
  console.log("Usage: node scripts/reportLegacyMedia.js [--verbose] [--samples=10] [--model=Post] [--json]");
  console.log("");
  console.log("Flags:");
  console.log("- --verbose    Include mixed/unknown samples and top legacy field counts");
  console.log("- --samples=N  Limit sample record output per status");
  console.log("- --model=Name Scan only one model, e.g. User, Post, Track");
  console.log("- --json       Print the report as JSON");
};

const printTextReport = (report, options = {}) => {
  console.log("=== Legacy Media Report ===");
  printLine("Mode", "read-only");
  printLine("Generated at", report.generatedAt);
  printLine("Sample limit", report.sampleLimit);
  if (report.modelFilter?.length) {
    printLine("Model filter", report.modelFilter.join(", "));
  }
  console.log("");

  report.models.forEach((model) => {
    console.log(`Model: ${model.modelName}`);
    console.log(`- total scanned: ${formatNumber(model.totalScanned)}`);
    console.log(`- with media: ${formatNumber(model.withMedia)}`);
    console.log(`- cloudinary: ${formatNumber(model.cloudinary)}`);
    console.log(`- legacy local: ${formatNumber(model.legacyLocal)}`);
    console.log(`- mixed: ${formatNumber(model.mixed)}`);
    console.log(`- unknown: ${formatNumber(model.unknown)}`);
    console.log(`- other remote: ${formatNumber(model.otherRemote)}`);
    console.log(`- no media: ${formatNumber(model.noMedia)}`);
    if (model.sampleLegacyRecords?.length) {
      console.log(`- sample legacy record IDs: ${formatSamples(model.sampleLegacyRecords)}`);
    }
    if (options.verbose && model.sampleMixedRecords?.length) {
      console.log(`- sample mixed record IDs: ${formatSamples(model.sampleMixedRecords)}`);
    }
    if (options.verbose && model.sampleUnknownRecords?.length) {
      console.log(`- sample unknown record IDs: ${formatSamples(model.sampleUnknownRecords)}`);
    }
    if (options.verbose && model.legacyFieldCounts?.length) {
      const fieldSummary = model.legacyFieldCounts
        .slice(0, report.sampleLimit)
        .map((entry) => `${entry.field} (${formatNumber(entry.count)})`)
        .join(", ");
      console.log(`- top legacy fields: ${fieldSummary}`);
    }
    console.log("");
  });

  console.log("=== Grand Totals ===");
  console.log(`- total scanned: ${formatNumber(report.grandTotals.totalScanned)}`);
  console.log(`- with media: ${formatNumber(report.grandTotals.withMedia)}`);
  console.log(`- cloudinary: ${formatNumber(report.grandTotals.cloudinary)}`);
  console.log(`- legacy local: ${formatNumber(report.grandTotals.legacyLocal)}`);
  console.log(`- mixed: ${formatNumber(report.grandTotals.mixed)}`);
  console.log(`- unknown: ${formatNumber(report.grandTotals.unknown)}`);
  console.log(`- other remote: ${formatNumber(report.grandTotals.otherRemote)}`);
  console.log(`- no media: ${formatNumber(report.grandTotals.noMedia)}`);
};

const run = async (argv = process.argv.slice(2)) => {
  const options = parseArgs(argv);
  if (options.help) {
    printHelp();
    return;
  }

  await connectDB();

  try {
    const report = await getLegacyMediaReport(options);
    if (options.json) {
      console.log(JSON.stringify(report, null, 2));
      return;
    }
    printTextReport(report, options);
  } finally {
    await mongoose.disconnect().catch(() => null);
  }
};

if (require.main === module) {
  run().catch((error) => {
    console.error("Legacy media report failed:", error?.message || error);
    process.exitCode = 1;
  });
}

module.exports = {
  parseArgs,
  printTextReport,
  run,
};
