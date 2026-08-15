const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

const GsiRegistryRecord = require("../models/GsiRegistryRecord");
const {
  backfillPublishedJournal,
  indexPaperRecord,
  indexPublishedRecord,
  listRegistryRecords,
} = require("../services/gsiRegistryService");

const PAMJ_CID = "bafkreieomt2dt7l5zfgzycjpebgzsggyh565wbdm7l2mllws4wpfo7edca";
const archive = {
  id: PAMJ_CID,
  publicRecordPath: `/gsi/records/${PAMJ_CID}`,
  permanentUrl: `https://ipfs.io/ipfs/${PAMJ_CID}`,
  savedAt: "2026-08-15T00:00:00.000Z",
};
const journalRecord = {
  recordType: "GSI Journal Onboarding Record",
  createdAt: "2026-08-15T00:00:00.000Z",
  journal: {
    displayName: "Pan African Medical Journal",
    publisher: "African Field Epidemiology Network",
    countryCode: "UG",
    issnL: "1937-8688",
    worksCount: 10706,
  },
  provenance: {
    provider: "OpenAlex",
    totalWorks: 10701,
    reviewedWorks: 100,
    scoredPublications: 98,
    archivedPublications: 3,
  },
  gsiScore: { version: "GSI-Archive-1.2", total: 90, sampleSize: 98 },
  impactEvidence: { verificationStatus: "not-provided" },
  publications: [
    {
      id: "W1001",
      doi: "https://doi.org/10.11604/pamj.2026.1.1",
      title: "Cervical cancer control and prevention in Malawi",
      publicationYear: 2026,
      authors: [{
        displayName: "Thandiwe Banda",
        institutions: [{ displayName: "Kamuzu University of Health Sciences", countryCode: "MW" }],
      }],
      topics: ["Cervical Cancer Prevention", "Oncology"],
    },
    {
      id: "W1002",
      doi: "https://doi.org/10.11604/pamj.2026.1.2",
      title: "Maternal health delivery across Lagos clinics",
      publicationYear: 2025,
      authors: [{
        displayName: "Ada Okafor",
        institutions: [{ displayName: "University of Lagos", countryCode: "NG" }],
      }],
      topics: ["Maternal Health", "Public Health"],
    },
    {
      id: "W1003",
      title: "Community tuberculosis detection programmes",
      publicationYear: 2024,
      authors: [{
        displayName: "Musa Bello",
        institutions: [{ displayName: "Makerere University", countryCode: "UG" }],
      }],
      topics: ["Tuberculosis", "Infectious Disease"],
    },
  ],
};

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create({ instance: { launchTimeout: 60000 } });
  await mongoose.connect(mongod.getUri(), {
    serverSelectionTimeoutMS: 60000,
    socketTimeoutMS: 60000,
  });
  await GsiRegistryRecord.syncIndexes();
});

beforeEach(async () => {
  await GsiRegistryRecord.deleteMany({});
});

afterAll(async () => {
  try {
    await mongoose.disconnect();
  } finally {
    if (mongod) await mongod.stop();
  }
});

describe("GSI journal registry persistence and discovery", () => {
  test("upserts a journal and its retained works without duplicating entries on retry", async () => {
    const first = await indexPublishedRecord(journalRecord, archive);
    const second = await indexPublishedRecord(journalRecord, archive);

    expect(first).toMatchObject({ journalIndexed: true, worksIndexed: 3, entriesIndexed: 4 });
    expect(second).toMatchObject({ journalIndexed: true, worksIndexed: 3, entriesIndexed: 4 });
    expect(await GsiRegistryRecord.countDocuments()).toBe(4);
    expect(await GsiRegistryRecord.countDocuments({ recordKind: "journal-work" })).toBe(3);
    expect(await GsiRegistryRecord.findOne({ openAlexWorkId: "W1001" }).lean()).toMatchObject({
      parentArchiveId: PAMJ_CID,
      recordKind: "journal-work",
      journalName: "Pan African Medical Journal",
      scoreContext: "parent-journal",
      publicRecordPath: `/gsi/records/${PAMJ_CID}#publication-W1001`,
    });
  });

  test.each([
    ["publication title", { q: "Cervical cancer" }, "W1001"],
    ["author", { q: "Thandiwe Banda" }, "W1001"],
    ["topic", { q: "Tuberculosis" }, "W1003"],
    ["institution or place", { q: "Lagos" }, "W1002"],
    ["country name", { q: "Malawi" }, "W1001"],
    ["DOI", { q: "10.11604/pamj.2026.1.1" }, "W1001"],
  ])("searches journal works by %s", async (_label, query, expectedWorkId) => {
    await indexPublishedRecord(journalRecord, archive);

    const response = await listRegistryRecords(query);

    expect(response.results).toHaveLength(1);
    expect(response.results[0].openAlexWorkId).toBe(expectedWorkId);
  });

  test("filters by country and each explicit record kind", async () => {
    await indexPublishedRecord(journalRecord, archive);
    await indexPaperRecord({
      publicId: "00000000-0000-4000-8000-000000000001",
      paper: {
        title: "Independent malaria paper",
        authors: ["Amina Yusuf"],
        abstract: "Malaria programme evidence.",
        field: "Public health",
        countryCode: "NG",
        publicationYear: 2026,
      },
      gsiScore: { version: "GSI-Paper-1.0", total: 72 },
      impactEvidence: { verificationStatus: "not-provided" },
      confirmedAt: new Date("2026-08-15T00:00:00.000Z"),
    });

    expect((await listRegistryRecords({ country: "MW" })).results.map((entry) => entry.openAlexWorkId)).toEqual(["W1001"]);
    expect((await listRegistryRecords({ type: "journal" })).results).toHaveLength(1);
    expect((await listRegistryRecords({ type: "paper" })).results).toHaveLength(1);
    expect((await listRegistryRecords({ type: "journal-work" })).results).toHaveLength(3);
    expect((await listRegistryRecords()).counts).toEqual({
      totalPublicRecords: 5,
      journals: 1,
      papers: 1,
      journalWorks: 3,
      researchOutputs: 4,
    });
  });

  test("preserves pagination for publication results", async () => {
    await indexPublishedRecord(journalRecord, archive);

    const firstPage = await listRegistryRecords({ type: "journal-work", limit: 2, page: 1 });
    const secondPage = await listRegistryRecords({ type: "journal-work", limit: 2, page: 2 });

    expect(firstPage.results).toHaveLength(2);
    expect(firstPage.pagination).toEqual({ page: 1, limit: 2, total: 3, pages: 2 });
    expect(secondPage.results).toHaveLength(1);
  });

  test("escapes regex metacharacters and applies the field filter to all topics", async () => {
    await indexPublishedRecord(journalRecord, archive);

    expect((await listRegistryRecords({ q: ".*" })).results).toHaveLength(0);
    expect((await listRegistryRecords({ field: "Infectious Disease" })).results.map((entry) => entry.openAlexWorkId)).toEqual(["W1003"]);
  });

  test("backfills the known PAMJ CID idempotently without changing its archive", async () => {
    const fetchRecord = jest.fn().mockResolvedValue({
      id: PAMJ_CID,
      contentHash: "sha256:fixture",
      permanentUrl: archive.permanentUrl,
      record: journalRecord,
    });

    const first = await backfillPublishedJournal(PAMJ_CID, { fetchRecord });
    const second = await backfillPublishedJournal(PAMJ_CID, { fetchRecord });

    expect(first.registry).toMatchObject({ journalIndexed: true, worksIndexed: 3 });
    expect(second.registry).toMatchObject({ journalIndexed: true, worksIndexed: 3 });
    expect(fetchRecord).toHaveBeenCalledTimes(2);
    expect(await GsiRegistryRecord.countDocuments()).toBe(4);
    expect(first.archive.id).toBe(PAMJ_CID);
  });

  test("validates CID shape and genuine journal record type before backfill writes", async () => {
    const fetchRecord = jest.fn();
    await expect(backfillPublishedJournal("not-a-cid", { fetchRecord })).rejects.toMatchObject({
      code: "INVALID_RECORD_ID",
    });
    expect(fetchRecord).not.toHaveBeenCalled();

    fetchRecord.mockResolvedValue({
      id: PAMJ_CID,
      record: { recordType: "Something Else" },
    });
    await expect(backfillPublishedJournal(PAMJ_CID, { fetchRecord })).rejects.toMatchObject({
      code: "INVALID_RECORD",
    });
    expect(await GsiRegistryRecord.countDocuments()).toBe(0);
  });
});
