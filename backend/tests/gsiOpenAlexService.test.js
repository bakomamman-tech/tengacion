const {
  GsiOpenAlexError,
  normalizeIssn,
  normalizeSource,
  normalizeWork,
  searchJournals,
} = require("../services/gsiOpenAlexService");

describe("GSI OpenAlex service", () => {
  const originalKey = process.env.OPENALEX_API_KEY;

  afterEach(() => {
    if (originalKey === undefined) delete process.env.OPENALEX_API_KEY;
    else process.env.OPENALEX_API_KEY = originalKey;
    jest.restoreAllMocks();
  });

  test("normalizes ISSNs in compact and hyphenated input", () => {
    expect(normalizeIssn("ISSN 1234567X")).toBe("1234-567X");
    expect(normalizeIssn("1234-5678")).toBe("1234-5678");
    expect(normalizeIssn("journal title only")).toBe("");
  });

  test("normalizes source and publication evidence defensively", () => {
    const source = normalizeSource({
      id: "https://openalex.org/S123",
      display_name: " Journal   Name ",
      issn_l: "1234-5678",
      works_count: 12,
    });
    const work = normalizeWork({
      id: "https://openalex.org/W456",
      title: "A study",
      publication_year: 2025,
      open_access: { is_oa: true },
      abstract_inverted_index: { A: [0] },
      authorships: [
        {
          author: { id: "https://openalex.org/A8", display_name: "Researcher" },
          institutions: [
            {
              id: "https://openalex.org/I9",
              display_name: "Institution",
              country_code: "ng",
              is_global_south: true,
            },
          ],
        },
      ],
    });

    expect(source).toMatchObject({ id: "S123", displayName: "Journal Name", worksCount: 12 });
    expect(work).toMatchObject({ id: "W456", isOpenAccess: true, hasAbstract: true });
    expect(work.authors[0].institutions[0]).toMatchObject({ countryCode: "NG", isGlobalSouth: true });
  });

  test("returns a helpful service state when the required API key is absent", async () => {
    delete process.env.OPENALEX_API_KEY;
    await expect(searchJournals("African Journal")).rejects.toMatchObject({
      code: "OPENALEX_NOT_CONFIGURED",
      status: 503,
    });
  });

  test("rejects vague searches before contacting OpenAlex", async () => {
    process.env.OPENALEX_API_KEY = "test-key";
    await expect(searchJournals("a")).rejects.toBeInstanceOf(GsiOpenAlexError);
  });
});
