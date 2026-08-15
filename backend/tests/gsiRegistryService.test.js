const {
  buildJournalWorkRegistryEntries,
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
      journal: {
        openAlexId: "S2755481371",
        displayName: "Pan African Medical Journal",
        publisher: "African Field Epidemiology Network",
        countryCode: "UG",
        issnL: "1937-8688",
        issns: ["1937-8688"],
        worksCount: 10706,
      },
      provenance: { provider: "OpenAlex", totalWorks: 10701, reviewedWorks: 100, scoredPublications: 98, archivedPublications: 62 },
      gsiScore: { version: "GSI-Archive-1.2", total: 81, sampleSize: 98 },
      impactEvidence: { verificationStatus: "self-reported" },
    }, {
      id: "bafyjournal",
      publicRecordPath: "/gsi/records/bafyjournal",
      permanentUrl: "https://ipfs.io/ipfs/bafyjournal",
      savedAt: "2026-08-15T00:00:00.000Z",
    });

    expect(entry).toMatchObject({
      recordKind: "journal",
      title: "Pan African Medical Journal",
      sourceProvider: "OpenAlex",
      impactEvidenceStatus: "self-reported",
      openAlexSourceId: "S2755481371",
      issnL: "1937-8688",
      issns: ["1937-8688"],
      indexedWorks: 10706,
      queryMatchedWorks: 10701,
      reviewedWorks: 100,
      scoredWorks: 98,
      retainedWorks: 62,
    });
  });

  test("creates explicit journal-work entries that link to permanent parent evidence", () => {
    const cid = "bafkreieomt2dt7l5zfgzycjpebgzsggyh565wbdm7l2mllws4wpfo7edca";
    const entries = buildJournalWorkRegistryEntries({
      recordType: "GSI Journal Onboarding Record",
      createdAt: "2026-08-15T00:00:00.000Z",
      journal: { displayName: "Pan African Medical Journal", countryCode: "UG", issnL: "1937-8688" },
      gsiScore: { total: 90, version: "GSI-Archive-1.2" },
      publications: [{
        id: "W123",
        title: "Cervical cancer prevention",
        doi: "https://doi.org/10.1000/example",
        publicationYear: 2026,
        topics: ["Oncology"],
        authors: [{
          displayName: "Thandiwe Banda",
          institutions: [{ displayName: "Kamuzu University", countryCode: "MW" }],
        }],
      }],
    }, {
      id: cid,
      publicRecordPath: `/gsi/records/${cid}`,
      permanentUrl: `https://ipfs.io/ipfs/${cid}`,
      savedAt: "2026-08-15T00:00:00.000Z",
    });

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      recordKind: "journal-work",
      parentArchiveId: cid,
      openAlexWorkId: "W123",
      title: "Cervical cancer prevention",
      authors: ["Thandiwe Banda"],
      institutions: ["Kamuzu University"],
      countryCodes: ["MW"],
      countryNames: ["Malawi"],
      scoreContext: "parent-journal",
      publicRecordPath: `/gsi/records/${cid}#publication-W123`,
    });
  });
});
