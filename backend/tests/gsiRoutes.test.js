const express = require("express");
const request = require("supertest");

const mockImportJournal = jest.fn();
const mockScoreJournal = jest.fn();

jest.mock("../services/gsiOpenAlexService", () => ({
  GsiOpenAlexError: class GsiOpenAlexError extends Error {},
  importJournal: (...args) => mockImportJournal(...args),
  searchJournals: jest.fn(),
}));

jest.mock("../services/gsiScoringService", () => ({
  GSI_SCORING_VERSION: "GSI-Archive-1.2",
  scoreJournal: (...args) => mockScoreJournal(...args),
}));

jest.mock("../services/gsiArchiveService", () => ({
  GsiArchiveError: class GsiArchiveError extends Error {
    constructor(message, { status = 502, code = "ARCHIVE_UNAVAILABLE" } = {}) {
      super(message);
      this.status = status;
      this.code = code;
    }
  },
  buildArchivalRecord: jest.fn(),
  fetchArchivedRecord: jest.fn(),
  publishRecord: jest.fn(),
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
    mockImportJournal.mockResolvedValue({ source: { id: "S123" }, publications: [] });
    mockScoreJournal.mockReturnValue({ version: "GSI-Archive-1.2", total: 4 });
  });

  test("reports the active scoring version", async () => {
    const response = await request(createApp()).get("/api/gsi/status");

    expect(response.status).toBe(200);
    expect(response.body.scoringVersion).toBe("GSI-Archive-1.2");
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
});
