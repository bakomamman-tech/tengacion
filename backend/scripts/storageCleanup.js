const path = require("path");
const dotenv = require("dotenv");
const mongoose = require("mongoose");

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

require("../config/env");

const connectDB = require("../config/db");
const {
  getStorageActionCatalog,
  getStorageOverview,
  previewCleanup,
  previewIndexSync,
  runCleanup,
  runIndexSync,
} = require("../services/storageMaintenanceService");

const parseActions = (args) => {
  const actionArg = args.find((value) => String(value || "").startsWith("--actions="));
  if (!actionArg) {
    return [];
  }

  return String(actionArg.split("=").slice(1).join("=") || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
};

const printLine = (label, value = "") => {
  if (value === "" || value === undefined || value === null) {
    console.log(label);
    return;
  }
  console.log(`${label}: ${value}`);
};

const main = async () => {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run") || !args.includes("--run");
  const syncIndexes = args.includes("--sync-indexes");
  const actions = parseActions(args);

  await connectDB();

  try {
    const overview = await getStorageOverview();
    const result = dryRun ? await previewCleanup(actions) : await runCleanup(actions);
    const indexResult = syncIndexes
      ? dryRun
        ? await previewIndexSync()
        : await runIndexSync()
      : null;

    printLine("Storage cleanup mode", dryRun ? "dry-run" : "execute");
    printLine(
      "Actions",
      result.actions.length ? result.actions.join(", ") : getStorageActionCatalog().map((entry) => entry.key).join(", ")
    );
    printLine("Collections scanned", overview.totals.collections);
    printLine("Estimated documents", overview.totals.estimatedDocuments);
    printLine("Estimated storage size", overview.totals.storageSizeBytes);
    console.log("");
    console.log("Top collections by storage:");
    overview.collections.slice(0, 10).forEach((row) => {
      console.log(
        `- ${row.collectionName} (${row.modelName || "no model"}): docs=${row.estimatedDocumentCount}, avg=${row.averageDocumentSizeBytes}B, indexes=${row.indexCount}, waste=${row.likelyWasteFields.join(", ") || "none"}`
      );
    });
    console.log("");
    console.log(JSON.stringify(result, null, 2));

    if (indexResult) {
      console.log("");
      console.log("Index sync plan:");
      console.log(JSON.stringify(indexResult, null, 2));
    }

    if (dryRun) {
      console.log("");
      console.log("Dry-run completed. Re-run with --run to apply the cleanup.");
      if (syncIndexes) {
        console.log("Index sync is also in preview mode. Re-run with --run --sync-indexes to apply it.");
      }
    } else {
      console.log("");
      console.log("Cleanup completed successfully.");
      if (syncIndexes) {
        console.log("Index sync completed successfully.");
      }
    }
  } finally {
    await mongoose.disconnect().catch(() => null);
  }
};

main().catch((error) => {
  console.error("Storage cleanup failed:", error?.message || error);
  process.exitCode = 1;
});
