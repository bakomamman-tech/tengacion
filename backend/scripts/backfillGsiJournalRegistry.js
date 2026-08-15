const mongoose = require("mongoose");

const connectDB = require("../config/db");
const { backfillPublishedJournal } = require("../services/gsiRegistryService");

const backfillGsiJournalRegistry = async (cid, { dryRun = false } = {}) => {
  if (dryRun) {
    return backfillPublishedJournal(cid, {
      indexRecord: async (record) => ({
        status: "validated",
        journalIndexed: false,
        worksIndexed: 0,
        expectedWorks: Array.isArray(record.publications) ? record.publications.length : 0,
      }),
    });
  }
  return backfillPublishedJournal(cid);
};

if (require.main === module) {
  const cid = String(process.argv[2] || "").trim();
  const dryRun = process.argv.includes("--dry-run");

  (async () => {
    if (!cid || cid.startsWith("--")) {
      throw new Error("Usage: npm run backfill:gsi-journal -- <CID> [--dry-run]");
    }
    if (!dryRun) await connectDB();
    try {
      const result = await backfillGsiJournalRegistry(cid, { dryRun });
      console.log(JSON.stringify({
        cid: result.archive.id,
        journal: result.record.journal?.displayName || "Untitled journal",
        registry: result.registry,
        immutableArchiveModified: false,
      }, null, 2));
    } finally {
      if (!dryRun && mongoose.connection.readyState !== 0) await mongoose.disconnect();
    }
  })().catch((error) => {
    console.error(`[backfillGsiJournalRegistry] ${error.code || "FAILED"}: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { backfillGsiJournalRegistry };
