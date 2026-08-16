const {
  GsiOpenAlexError,
  normalizeIssn,
  normalizeSource,
  normalizeWork,
  parseWebsiteQuery,
  searchJournals,
} = require("../services/gsiOpenAlexService");

const jsonResponse = (payload, { status = 200 } = {}) => Promise.resolve({
  ok: status >= 200 && status < 300,
  status,
  json: async () => payload,
});

const openAlexSource = (overrides = {}) => ({
  id: "https://openalex.org/S123",
  display_name: "Example Journal",
  type: "journal",
  issn_l: "1234-5678",
  issn: ["1234-5678"],
  host_organization_name: "Example Publisher",
  homepage_url: "https://example-journal.org",
  works_count: 120,
  ...overrides,
});

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
    expect(normalizeIssn("24678821")).toBe("2467-8821");
    expect(normalizeIssn("2467-8821")).toBe("2467-8821");
    expect(normalizeIssn("journal title only")).toBe("");
  });

  test("builds bounded website search candidates from academic words and abbreviations", () => {
    expect(parseWebsiteQuery("www.panafrican-med-journal.com/about")).toMatchObject({
      domain: "panafrican-med-journal.com",
      searchText: "pan african medical journal",
    });
    expect(parseWebsiteQuery("www.panafrican-med-journal.com/about").searchCandidates).toEqual([
      "pan african medical journal",
      "pan african medical journal about",
      "about",
      "panafrican med journal about",
    ]);
    expect(parseWebsiteQuery("ghanamedj.org").searchCandidates).toEqual([
      "ghana medical journal",
      "ghanamedj",
    ]);
    expect(parseWebsiteQuery("africanhealthsciences.org").searchCandidates).toEqual([
      "african health sciences",
      "africanhealthsciences",
    ]);
    expect(parseWebsiteQuery("African Health Sciences")).toBeNull();
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
      abstract_inverted_index: { A: [0], study: [1], in: [2], context: [3] },
      authorships: [
        {
          author: { id: "https://openalex.org/A8", display_name: "Researcher" },
          institutions: [
            {
              id: "https://openalex.org/I9",
              display_name: "Institution",
              country_code: "ng",
            },
          ],
        },
      ],
    });

    expect(source).toMatchObject({ id: "S123", displayName: "Journal Name", worksCount: 12 });
    expect(work).toMatchObject({
      id: "W456",
      isOpenAccess: true,
      hasAbstract: true,
      abstract: "A study in context",
    });
    expect(work.authors[0].institutions[0]).toEqual({
      id: "I9",
      displayName: "Institution",
      countryCode: "NG",
    });
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

  test("resolves publisher names to journal sources in the publisher lineage", async () => {
    process.env.OPENALEX_API_KEY = "test-key";
    const fetchMock = jest.spyOn(global, "fetch").mockImplementation((input) => {
      const url = new URL(String(input));
      if (url.pathname === "/publishers") {
        return jsonResponse({
          results: [{
            id: "https://openalex.org/P4310320990",
            display_name: "Elsevier",
            alternate_titles: ["Elsevier B.V."],
          }],
        });
      }
      if (url.searchParams.get("filter")?.includes("host_organization_lineage")) {
        return jsonResponse({ results: [openAlexSource({
          display_name: "The Lancet",
          host_organization_name: "Elsevier",
          issn_l: "0140-6736",
        })] });
      }
      return jsonResponse({ meta: { count: 0 }, results: [] });
    });

    const payload = await searchJournals("Elsevier");

    expect(payload).toMatchObject({ matchType: "publisher", fallbackUsed: false });
    expect(payload.results[0]).toMatchObject({
      displayName: "The Lancet",
      matchedBy: "publisher",
      matchLabel: "Publisher: Elsevier",
    });
    expect(fetchMock.mock.calls.some(([input]) => {
      const url = new URL(String(input));
      return url.searchParams.get("filter") ===
        "type:journal,host_organization_lineage:P4310320990";
    })).toBe(true);
  });

  test("ranks an exact homepage-domain match first for website searches", async () => {
    process.env.OPENALEX_API_KEY = "test-key";
    jest.spyOn(global, "fetch").mockImplementation((input) => {
      const url = new URL(String(input));
      expect(url.pathname).toBe("/sources");
      expect(url.searchParams.get("search")).toBe("the lancet");
      return jsonResponse({ results: [
        openAlexSource({
          id: "https://openalex.org/S987",
          display_name: "The Lancet",
          homepage_url: "https://www.thelancet.com/journals/lancet/home",
        }),
        openAlexSource({
          id: "https://openalex.org/S654",
          display_name: "Lancet Review",
          homepage_url: "https://unrelated.example.org",
        }),
      ] });
    });

    const payload = await searchJournals("https://www.thelancet.com");

    expect(payload.matchType).toBe("website");
    expect(payload.results.map((source) => source.id)).toEqual(["S987", "S654"]);
    expect(payload.results[0]).toMatchObject({
      matchedBy: "website",
      matchLabel: "Website: thelancet.com",
    });
    expect(payload.results[1].matchedBy).toBe("website-derived");
  });

  test("preserves NIJOTECH exact website discovery", async () => {
    process.env.OPENALEX_API_KEY = "test-key";
    const fetchMock = jest.spyOn(global, "fetch").mockImplementation((input) => {
      const url = new URL(String(input));
      if (url.hostname === "api.crossref.org") {
        throw new Error("Crossref should not be needed for an exact OpenAlex homepage match");
      }
      expect(url.pathname).toBe("/sources");
      expect(url.searchParams.get("search")).toBe("nijotech");
      return jsonResponse({ results: [openAlexSource({
        id: "https://openalex.org/S130385790",
        display_name: "Nigerian Journal of Technology",
        issn_l: "0331-8443",
        issn: ["0331-8443", "2467-8821"],
        homepage_url: "https://www.nijotech.com/",
      })] });
    });

    const payload = await searchJournals("https://www.nijotech.com/");

    expect(payload.matchType).toBe("website");
    expect(payload.results).toHaveLength(1);
    expect(payload.results[0]).toMatchObject({
      displayName: "Nigerian Journal of Technology",
      matchedBy: "website",
      matchLabel: "Website: nijotech.com",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test.each([
    [
      "https://ghanamedj.org/",
      "ghanamedj.org",
      "ghana medical journal",
      "Ghana Medical Journal",
      ["0016-9560", "2616-163X"],
      "S123001",
    ],
    [
      "ghanamedj.org",
      "ghanamedj.org",
      "ghana medical journal",
      "Ghana Medical Journal",
      ["0016-9560", "2616-163X"],
      "S123002",
    ],
    [
      "https://africanhealthsciences.org/",
      "africanhealthsciences.org",
      "african health sciences",
      "African Health Sciences",
      ["1680-6905", "1729-0503"],
      "S123003",
    ],
    [
      "africanhealthsciences.org",
      "africanhealthsciences.org",
      "african health sciences",
      "African Health Sciences",
      ["1680-6905", "1729-0503"],
      "S123004",
    ],
  ])("resolves website %s through a general Crossref ISSN bridge", async (
    query,
    domain,
    expectedSearch,
    title,
    issns,
    sourceId
  ) => {
    process.env.OPENALEX_API_KEY = "test-key";
    const openAlexSearches = [];
    const fetchMock = jest.spyOn(global, "fetch").mockImplementation((input) => {
      const url = new URL(String(input));
      if (url.hostname === "api.crossref.org") {
        expect(url.searchParams.get("query")).toBe(expectedSearch);
        return jsonResponse({ message: { items: [{
          title,
          publisher: "Regional Medical Publisher",
          ISSN: issns,
          "ISSN-L": issns[0],
          URL: `https://api.crossref.org/journals/${issns[0]}`,
        }] } });
      }
      if (url.searchParams.get("filter")?.includes(`issn:${issns.join("|")}`)) {
        return jsonResponse({ results: [openAlexSource({
          id: `https://openalex.org/${sourceId}`,
          display_name: title,
          issn_l: issns[0],
          issn: issns,
          homepage_url: `https://${domain}/journal-home`,
        })] });
      }
      openAlexSearches.push(url.searchParams.get("search"));
      return jsonResponse({ meta: { count: 0 }, results: [] });
    });

    const payload = await searchJournals(query);

    expect(openAlexSearches).toContain(expectedSearch);
    expect(payload.matchType).toBe("website");
    expect(payload.externalCandidates).toEqual([]);
    expect(payload.results[0]).toMatchObject({
      id: sourceId,
      displayName: title,
      matchedBy: "website",
      matchLabel: `Website: ${domain}`,
    });
    expect(fetchMock.mock.calls.some(([input]) =>
      new URL(String(input)).hostname === "api.crossref.org"
    )).toBe(true);
  });

  test("a bogus website rejects unrelated text and Crossref candidates cleanly", async () => {
    process.env.OPENALEX_API_KEY = "test-key";
    jest.spyOn(global, "fetch").mockImplementation((input) => {
      const url = new URL(String(input));
      if (url.hostname === "api.crossref.org") {
        return jsonResponse({ message: { items: [{
          title: "Ghana Medical Journal",
          publisher: "Unrelated Publisher",
          ISSN: ["0016-9560"],
          "ISSN-L": "0016-9560",
        }] } });
      }
      if (url.searchParams.get("filter")?.includes("issn:0016-9560")) {
        return jsonResponse({ results: [openAlexSource({
          display_name: "Ghana Medical Journal",
          issn_l: "0016-9560",
          issn: ["0016-9560"],
          homepage_url: "https://ghanamedj.org/",
        })] });
      }
      return jsonResponse({ results: [openAlexSource({
        display_name: "African Health Sciences",
        homepage_url: "https://africanhealthsciences.org/",
      })] });
    });

    const payload = await searchJournals("bogus-journal-website.example");

    expect(payload.results).toEqual([]);
    expect(payload.externalCandidates).toEqual([]);
    expect(payload.matchType).toBe("website");
  });

  test.each(["2467-8821", "24678821"])("keeps exact ISSN discovery for %s", async (query) => {
    process.env.OPENALEX_API_KEY = "test-key";
    const fetchMock = jest.spyOn(global, "fetch").mockImplementation((input) => {
      const url = new URL(String(input));
      expect(url.pathname).toBe("/sources/issn:2467-8821");
      return jsonResponse(openAlexSource({
        display_name: "Nigerian Journal of Technology",
        issn_l: "2467-8821",
        issn: ["2467-8821"],
      }));
    });

    const payload = await searchJournals(query);

    expect(payload.matchType).toBe("issn");
    expect(payload.results[0]).toMatchObject({
      displayName: "Nigerian Journal of Technology",
      matchedBy: "issn",
      matchLabel: "Exact ISSN: 2467-8821",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("uses Crossref ISSNs to recover a journal missing from title and publisher search", async () => {
    process.env.OPENALEX_API_KEY = "test-key";
    jest.spyOn(global, "fetch").mockImplementation((input) => {
      const url = new URL(String(input));
      if (url.hostname === "api.crossref.org") {
        return jsonResponse({ message: { items: [{
          title: "Regional Discovery Journal",
          publisher: "Community Press",
          ISSN: ["2049-3630"],
          "ISSN-L": "2049-3630",
          URL: "https://api.crossref.org/journals/2049-3630",
        }] } });
      }
      if (url.pathname === "/publishers") return jsonResponse({ results: [] });
      if (url.searchParams.get("filter")?.includes("issn:2049-3630")) {
        return jsonResponse({ results: [openAlexSource({
          id: "https://openalex.org/S2049",
          display_name: "Regional Discovery Journal",
          issn_l: "2049-3630",
          issn: ["2049-3630"],
        })] });
      }
      return jsonResponse({ meta: { count: 0 }, results: [] });
    });

    const payload = await searchJournals("Regional Discovery");

    expect(payload).toMatchObject({ matchType: "crossref", fallbackUsed: true });
    expect(payload.results[0]).toMatchObject({
      id: "S2049",
      matchedBy: "crossref",
      matchLabel: "ISSN resolved through Crossref",
    });
  });
});
