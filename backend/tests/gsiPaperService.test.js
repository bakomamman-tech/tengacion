const { GsiPaperError, normalizePaper } = require("../services/gsiPaperService");

const completePaper = (overrides = {}) => ({
  title: "Community health delivery in Northern Nigeria",
  abstract: "This study documents a community health delivery model and evaluates how local clinics used it across several districts over a two-year period.",
  field: "Public health",
  authors: "Ada Okafor, Musa Bello",
  institution: "Example University",
  countryCode: "ng",
  publicationYear: 2026,
  doi: "https://doi.org/10.1234/EXAMPLE.1",
  openAccessUrl: "https://repository.example/paper",
  journalName: "Journal of Community Health",
  ...overrides,
});

describe("GSI paper normalization", () => {
  test("normalizes discovery metadata and public links", () => {
    expect(normalizePaper(completePaper())).toMatchObject({
      authors: ["Ada Okafor", "Musa Bello"],
      countryCode: "NG",
      doi: "10.1234/example.1",
      openAccessUrl: "https://repository.example/paper",
    });
  });

  test("requires an abstract substantial enough for a public record", () => {
    expect(() => normalizePaper(completePaper({ abstract: "Too short" }))).toThrow(GsiPaperError);
    try {
      normalizePaper(completePaper({ abstract: "Too short" }));
    } catch (error) {
      expect(error.code).toBe("PAPER_ABSTRACT_REQUIRED");
    }
  });

  test("rejects unsafe full-text links", () => {
    expect(() => normalizePaper(completePaper({ openAccessUrl: "javascript:alert(1)" })))
      .toThrow(/valid http or https/i);
  });
});
