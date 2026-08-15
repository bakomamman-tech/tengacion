const {
  buildPaperRegistryEntry,
  buildRegistryEntry,
} = require("../services/gsiRegistryService");

describe("GSI registry entries", () => {
  test("maps a paper record into a searchable public summary", () => {
    const entry = buildPaperRegistryEntry({
      publicId: "record-123",
      paper: {
        title: "Community health delivery",
        abstract: "A public abstract.",
        field: "Public health",
        authors: ["Ada Okafor", "Musa Bello"],
        countryCode: "NG",
        publicationYear: 2026,
      },
      gsiScore: { version: "GSI-Paper-1.0", total: 72 },
      impactEvidence: { verificationStatus: "not-provided" },
      confirmedAt: new Date("2026-08-15T00:00:00.000Z"),
    });

    expect(entry).toMatchObject({
      archiveId: "record-123",
      recordKind: "paper",
      title: "Community health delivery",
      subtitle: "Ada Okafor, Musa Bello",
      publicRecordPath: "/gsi/papers/record-123",
      gsiScore: 72,
    });
  });

  test("maps a permanent journal archive into the same browse index", () => {
    const entry = buildRegistryEntry({
      recordType: "GSI Journal Onboarding Record",
      journal: { displayName: "African Health Review", publisher: "Example University", countryCode: "NG" },
      provenance: { provider: "OpenAlex" },
      gsiScore: { version: "GSI-Archive-1.2", total: 81 },
      impactEvidence: { verificationStatus: "self-reported" },
    }, {
      id: "bafyjournal",
      publicRecordPath: "/gsi/records/bafyjournal",
      permanentUrl: "https://ipfs.io/ipfs/bafyjournal",
      savedAt: "2026-08-15T00:00:00.000Z",
    });

    expect(entry).toMatchObject({
      recordKind: "journal",
      title: "African Health Review",
      sourceProvider: "OpenAlex",
      impactEvidenceStatus: "self-reported",
    });
  });
});
