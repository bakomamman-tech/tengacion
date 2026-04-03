const path = require("path");
const dotenv = require("dotenv");
const mongoose = require("mongoose");

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

require("../config/env");

const connectDB = require("../config/db");
const { getMediaAuditSummary } = require("../services/mediaAuditService");

const formatNumber = (value) => Number(value || 0).toLocaleString();

const printLine = (label, value = "") => {
  if (value === "" || value === undefined || value === null) {
    console.log(label);
    return;
  }
  console.log(`${label}: ${value}`);
};

const main = async () => {
  await connectDB();

  try {
    const summary = await getMediaAuditSummary();

    printLine("Media audit mode", "read-only");
    printLine("Total media assets", formatNumber(summary.totals.assets));
    printLine("Cloudinary-backed", formatNumber(summary.totals.cloudinary));
    printLine("Legacy local", formatNumber(summary.totals.legacyLocal));
    printLine("Other remote", formatNumber(summary.totals.otherRemote));
    printLine("Malformed", formatNumber(summary.totals.malformed));
    console.log("");
    console.log("By source:");
    summary.bySource.forEach((row) => {
      console.log(
        `- ${row.label}: assets=${formatNumber(row.assets)}, cloudinary=${formatNumber(row.cloudinary)}, legacyLocal=${formatNumber(row.legacyLocal)}, otherRemote=${formatNumber(row.otherRemote)}, malformed=${formatNumber(row.malformed)}`
      );
    });
  } finally {
    await mongoose.disconnect().catch(() => null);
  }
};

main().catch((error) => {
  console.error("Legacy media audit failed:", error?.message || error);
  process.exitCode = 1;
});
