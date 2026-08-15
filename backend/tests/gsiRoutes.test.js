const express = require("express");
const request = require("supertest");

const mockImportJournal = jest.fn();
const mockScoreJournal = jest.fn();
const mockScorePaper = jest.fn();
const mockIndexPaperRecord = jest.fn();
const mockIndexPublishedRecord = jest.fn();
const mockListRegistryRecords = jest.fn();
const mockBuildArchivalRecord = jest.fn();
const mockFetchArchivedRecord = jest.fn();
const mockPublishRecord = jest.fn();

jest.mock("../models/GsiPaperRecord", () => ({
  create: jest.fn(),
  findOne: jest.fn(),
}));

jest.mock("../services/gsiOpenAlexService", () => ({
  GsiOpenAlexError: class GsiOpenAlexError extends Error {},
  importJournal: (...args) => mockImportJournal(...args),
  searchJournals: jest.fn(),
}));

jest.mock("../services/gsiScoringService", () => ({
  GSI_PAPER_SCORING_VERSION: "GSI-Paper-1.0",
  GSI_SCORING_VERSION: "GSI-Archive-1.2",
  scoreJournal: (...args) => mockScoreJournal(...args),
  scorePaper: (...args) => mockScorePaper(...args),
}));

jest.mock("../services/gsiRegistryService", () => ({
  indexPaperRecord: (...args) => mockIndexPaperRecord(...args),
  indexPublishedRecord: (...args) => mockIndexPublishedRecord(...args),
  listRegistryRecords: (...args) => mockListRegistryRecords(...args),
}));

jest.mock("../services/gsiArchiveService", () => ({
  GsiArchiveError: class GsiArchiveError extends Error {
    constructor(message, { status = 502, code = "ARCHIVE_UNAVAILABLE" } = {}) {
      super(message);
      this.status = status;
      this.code = code;
    }
  },
  buildArchivalRecord: (...args) => mockBuildArchivalRecord(...args),
  fetchArchivedRecord: (...args) => mockFetchArchivedRecord(...args),
  publishRecord: (...args) => mockPublishRecord(...args),
}));

const gsiRouter = require("../routes/gsi");

const createApp = () => {
  const app = express();
  app.use(express.json());
  app.use("/api/gsi", gsiRouter);
  return app;
};

describe("GSI routes", () => {
  beforeEach(() => {
    mockImportJournal.mockReset();
    mockScoreJournal.mockReset();
    mockScorePaper.mockReset();
    mockIndexPaperRecord.mockReset();
    mockIndexPublishedRecord.mockReset();
    mockListRegistryRecords.mockReset();
    mockBuildArchivalRecord.mockReset();
    mockFetchArchivedRecord.mockReset();
    mockPublishRecord.mockReset();
    mockImportJournal.mockResolvedValue({ source: { id: "S123" }, publications: [] });
    mockScoreJournal.mockReturnValue({ version: "GSI-Archive-1.2", total: 4 });
    mockScorePaper.mockReturnValue({ version: "GSI-Paper-1.0", total: 70 });
  });

  test("reports the active scoring version", async () => {
    const response = await request(createApp()).get("/api/gsi/status");

    expect(response.status).toBe(200);
    expect(response.body.scoringVersion).toBe("GSI-Archive-1.2");
    expect(response.body.paperScoringVersion).toBe("GSI-Paper-1.0");
  });

  test("rejects local-impact claims without a safe public evidence URL", async () => {
    const response = await request(createApp())
      .post("/api/gsi/journals/S123/score")
      .send({
        impactEvidence: {
          policyMentions: 2,
          sourceUrl: "javascript:alert(1)",
          attested: true,
        },
      });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("INVALID_IMPACT_EVIDENCE_URL");
    expect(mockScoreJournal).not.toHaveBeenCalled();
  });

  test("requires attestation before self-reported evidence affects the score", async () => {
    const response = await request(createApp())
      .post("/api/gsi/journals/S123/score")
      .send({
        impactEvidence: {
          ngoAdoptions: 3,
          sourceUrl: "https://example.org/programme",
        },
      });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("IMPACT_EVIDENCE_ATTESTATION_REQUIRED");
    expect(mockScoreJournal).not.toHaveBeenCalled();
  });

  test("normalizes sourced claims and returns the recalculated score", async () => {
    const response = await request(createApp())
      .post("/api/gsi/journals/S123/score")
      .send({
        impactEvidence: {
          policyMentions: "2",
          ngoAdoptions: "3",
          localCitations: "4",
          sourceUrl: "https://example.org/programme",
          summary: "Adopted by a regional health programme.",
          attested: true,
        },
      });

    expect(response.status).toBe(200);
    expect(response.body.impactEvidence).toMatchObject({
      policyMentions: 2,
      ngoAdoptions: 3,
      localCitations: 4,
      verificationStatus: "self-reported",
    });
    expect(mockScoreJournal).toHaveBeenCalledWith(expect.objectContaining({
      impactEvidence: expect.objectContaining({
        sourceUrl: "https://example.org/programme",
        verificationStatus: "self-reported",
      }),
    }));
  });

  test("validates paper metadata before returning a paper-level score", async () => {
    const response = await request(createApp()).post("/api/gsi/papers/score").send({
      paper: {
        title: "Community health delivery in Northern Nigeria",
        abstract: "This study documents a community health delivery model and evaluates how local clinics used it across several districts over a two-year period.",
        field: "Public health",
        authors: "Ada Okafor, Musa Bello",
        countryCode: "NG",
        publicationYear: 2026,
        openAccessUrl: "https://example.org/paper",
      },
    });

    expect(response.status).toBe(200);
    expect(response.body.paper.authors).toEqual(["Ada Okafor", "Musa Bello"]);
    expect(response.body.score.version).toBe("GSI-Paper-1.0");
    expect(mockScorePaper).toHaveBeenCalledWith(expect.objectContaining({
      paper: expect.objectContaining({ countryCode: "NG" }),
    }));
  });

  test("publishes the archive and returns complete journal/work registry status", async () => {
    const record = {
      recordType: "GSI Journal Onboarding Record",
      journal: { displayName: "Pan African Medical Journal" },
      publications: [{ id: "W1" }, { id: "W2" }],
      provenance: { archivedPublications: 2 },
      gsiScore: { total: 90 },
    };
    const archive = {
      id: "bafkreieomt2dt7l5zfgzycjpebgzsggyh565wbdm7l2mllws4wpfo7edca",
      publicRecordPath: "/gsi/records/example",
    };
    const imported = { source: { id: "S123" }, publications: [{ id: "W1" }, { id: "W2" }] };
    mockImportJournal.mockResolvedValue(imported);
    mockBuildArchivalRecord.mockReturnValue(record);
    mockPublishRecord.mockResolvedValue(archive);
    mockIndexPublishedRecord.mockResolvedValue({
      status: "indexed",
      journalIndexed: true,
      worksIndexed: 2,
      expectedWorks: 2,
    });

    const response = await request(createApp())
      .post("/api/gsi/journals/S123/publish")
      .send({ confirmed: true });

    expect(response.status).toBe(201);
    expect(response.body.registryIndexed).toBe(true);
    expect(response.body.registry).toMatchObject({ journalIndexed: true, worksIndexed: 2 });
    expect(mockIndexPublishedRecord).toHaveBeenCalledWith(record, archive, {
      sourcePublications: imported.publications,
    });
  });

  test("keeps a successful immutable archive and reports a warning when registry indexing fails", async () => {
    const record = {
      recordType: "GSI Journal Onboarding Record",
      journal: { displayName: "Pan African Medical Journal" },
      publications: [{ id: "W1" }],
      provenance: { archivedPublications: 1 },
      gsiScore: { total: 90 },
    };
    const archive = {
      id: "bafkreieomt2dt7l5zfgzycjpebgzsggyh565wbdm7l2mllws4wpfo7edca",
      publicRecordPath: "/gsi/records/example",
    };
    const registryError = new Error("MongoDB unavailable");
    registryError.registryStatus = {
      status: "pending",
      journalIndexed: false,
      worksIndexed: 0,
      expectedWorks: 1,
    };
    mockBuildArchivalRecord.mockReturnValue(record);
    mockPublishRecord.mockResolvedValue(archive);
    mockIndexPublishedRecord.mockRejectedValue(registryError);

    const response = await request(createApp())
      .post("/api/gsi/journals/S123/publish")
      .send({ confirmed: true });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.archive).toEqual(archive);
    expect(response.body.registryIndexed).toBe(false);
    expect(response.body.registry).toMatchObject({ status: "pending", journalIndexed: false });
    expect(response.body.warning).toContain("IPFS record is permanent and safe");
    expect(mockPublishRecord).toHaveBeenCalledTimes(1);
  });

  test("returns registry results, global counters, and pagination through the public API", async () => {
    mockListRegistryRecords.mockResolvedValue({
      results: [{ archiveId: "cid:work:W1", recordKind: "journal-work" }],
      pagination: { page: 2, limit: 1, total: 3, pages: 3 },
      counts: { totalPublicRecords: 5, journals: 1, papers: 1, journalWorks: 3 },
    });

    const response = await request(createApp())
      .get("/api/gsi/registry")
      .query({
        q: "https://openalex.org/S2755481371",
        type: "journal-work",
        page: 2,
        limit: 1,
      });

    expect(response.status).toBe(200);
    expect(response.body.counts.journalWorks).toBe(3);
    expect(response.body.pagination.page).toBe(2);
    expect(mockListRegistryRecords).toHaveBeenCalledWith(expect.objectContaining({
      type: "journal-work",
      q: "https://openalex.org/S2755481371",
      page: "2",
      limit: "1",
    }));
  });
});
