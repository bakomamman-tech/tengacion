const {
  buildArchivalRecord,
  serializeRecord,
} = require("../services/gsiArchiveService");

const makeWork = (index) => ({
  id: `W${index}`,
  doi: `https://doi.org/10.1000/${index}`,
  title: `Publication ${index} ${"evidence ".repeat(20)}`,
  publicationDate: "2025-01-01",
  publicationYear: 2025,
  type: "article",
  language: "en",
  citedByCount: index,
  isOpenAccess: true,
  hasAbstract: true,
  authors: [
    {
      id: `A${index}`,
      displayName: `Author ${index}`,
      institutions: [
        { id: "I1", displayName: "Example University", countryCode: "NG" },
      ],
    },
  ],
  topics: [{ displayName: "Public health" }],
});

describe("GSI archival records", () => {
  test("creates canonical, bounded, provenance-rich public records", () => {
    const record = buildArchivalRecord({
      source: {
        id: "S123",
        openAlexUrl: "https://openalex.org/S123",
        displayName: "Original title",
        publisher: "Original publisher",
        issnL: "1234-5678",
        issns: ["1234-5678"],
        worksCount: 200,
        citedByCount: 500,
      },
      publications: Array.from({ length: 100 }, (_, index) => makeWork(index + 1)),
      importSummary: {
        importedAt: "2026-08-10T00:00:00.000Z",
        totalWorks: 200,
        reviewedWorks: 100,
        isSample: true,
      },
      score: { version: "GSI-Archive-1.2", total: 80, components: [] },
      editorialReview: {
        displayName: "Editor-confirmed title",
        publisher: "Confirmed publisher",
        homepageUrl: "https://journal.example",
        countryCode: "NG",
        issnL: "1234-5678",
      },
      impactEvidence: {
        policyMentions: 2,
        ngoAdoptions: 1,
        localCitations: 4,
        summary: "Used in a state public-health programme.",
        sourceUrl: "https://example.org/policy-evidence",
        verificationStatus: "self-reported",
      },
    });
    const serialized = serializeRecord(record);

    expect(record.journal.displayName).toBe("Editor-confirmed title");
    expect(record.provenance.provider).toBe("OpenAlex");
    expect(record.provenance.archivedPublications).toBe(record.publications.length);
    expect(record.provenance.impactEvidenceStatus).toBe("self-reported");
    expect(record.impactEvidence).toMatchObject({
      policyMentions: 2,
      ngoAdoptions: 1,
      localCitations: 4,
      verificationStatus: "self-reported",
    });
    expect(record.publications.length).toBeGreaterThan(0);
    expect(record.publications[0].authors[0].institutions[0]).not.toHaveProperty(
      "isGlobalSouth"
    );
    expect(Buffer.byteLength(serialized, "utf8")).toBeLessThanOrEqual(95000);
    expect(serialized).toBe(serializeRecord(JSON.parse(serialized)));
  });
});
