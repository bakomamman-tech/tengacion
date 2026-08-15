class GsiPaperError extends Error {
  constructor(message, { status = 400, code = "INVALID_PAPER" } = {}) {
    super(message);
    this.name = "GsiPaperError";
    this.status = status;
    this.code = code;
  }
}

const cleanText = (value, maxLength) =>
  String(value || "")
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);

const normalizeUrl = (value, fieldLabel) => {
  const candidate = cleanText(value, 900);
  if (!candidate) return null;
  try {
    const url = new URL(candidate);
    if (!["http:", "https:"].includes(url.protocol)) throw new Error("Unsupported protocol");
    return url.toString();
  } catch {
    throw new GsiPaperError(`Enter a valid http or https link for ${fieldLabel}.`, {
      code: "INVALID_PAPER_URL",
    });
  }
};

const normalizeDoi = (value) => {
  const candidate = cleanText(value, 300)
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "")
    .replace(/^doi:\s*/i, "");
  if (!candidate) return null;
  if (!/^10\.\d{4,9}\/\S+$/i.test(candidate)) {
    throw new GsiPaperError("Enter a valid DOI, for example 10.1234/example.2026.1.", {
      code: "INVALID_PAPER_DOI",
    });
  }
  return candidate.toLowerCase();
};

const normalizeAuthors = (value) => {
  const rawAuthors = Array.isArray(value) ? value : String(value || "").split(/[,;\n]/);
  return [...new Set(rawAuthors.map((author) => cleanText(author, 160)).filter(Boolean))].slice(0, 30);
};

const normalizePaper = (value = {}) => {
  const currentYear = new Date().getUTCFullYear();
  const publicationYear = Number.parseInt(value.publicationYear, 10);
  const paper = {
    title: cleanText(value.title, 320),
    abstract: cleanText(value.abstract, 5000),
    field: cleanText(value.field, 160),
    authors: normalizeAuthors(value.authors),
    institution: cleanText(value.institution, 260) || null,
    countryCode: cleanText(value.countryCode, 2).toUpperCase(),
    publicationYear,
    doi: normalizeDoi(value.doi),
    openAccessUrl: normalizeUrl(value.openAccessUrl, "the open-access paper"),
    journalName: cleanText(value.journalName, 260) || null,
  };

  if (paper.title.length < 8) {
    throw new GsiPaperError("Add the paper's full title (at least 8 characters).", {
      code: "PAPER_TITLE_REQUIRED",
    });
  }
  if (paper.abstract.length < 80) {
    throw new GsiPaperError("Add an abstract of at least 80 characters so the record is useful to readers.", {
      code: "PAPER_ABSTRACT_REQUIRED",
    });
  }
  if (!paper.field) {
    throw new GsiPaperError("Select or enter the paper's research field.", {
      code: "PAPER_FIELD_REQUIRED",
    });
  }
  if (!paper.authors.length) {
    throw new GsiPaperError("Add at least one named author.", { code: "PAPER_AUTHORS_REQUIRED" });
  }
  if (!/^[A-Z]{2}$/.test(paper.countryCode)) {
    throw new GsiPaperError("Enter the two-letter country code for the research context.", {
      code: "PAPER_COUNTRY_REQUIRED",
    });
  }
  if (!Number.isInteger(publicationYear) || publicationYear < 1900 || publicationYear > currentYear + 1) {
    throw new GsiPaperError(`Enter a publication year from 1900 to ${currentYear + 1}.`, {
      code: "INVALID_PUBLICATION_YEAR",
    });
  }

  return paper;
};

module.exports = { GsiPaperError, normalizePaper };
