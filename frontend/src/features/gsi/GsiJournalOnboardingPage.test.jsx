import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  calculateScore: vi.fn(),
  importJournal: vi.fn(),
  publishJournal: vi.fn(),
  searchJournals: vi.fn(),
}));

vi.mock("./gsiApi", () => ({
  calculateGsiJournalScore: mocks.calculateScore,
  importGsiJournal: mocks.importJournal,
  publishGsiJournal: mocks.publishJournal,
  searchGsiJournals: mocks.searchJournals,
}));

import GsiJournalOnboardingPage from "./GsiJournalOnboardingPage";

const source = {
  id: "S123",
  displayName: "African Public Health Review",
  publisher: "Example University",
  countryCode: "NG",
  issnL: "1234-5678",
  issns: ["1234-5678"],
  worksCount: 1,
  citedByCount: 8,
  isOpenAccess: true,
  openAlexUrl: "https://openalex.org/S123",
};

const score = {
  version: "GSI-Archive-1.2",
  total: 84,
  sampleSize: 1,
  summary: "The journal has documented local impact.",
  fairnessNote: "This score does not use impact factor.",
  methodologyNote: "Research publication types form the scoring sample.",
  context: {
    countries: ["NG"],
    excludedPublications: 0,
    impactEvidenceStatus: "self-reported",
  },
  components: [{
    key: "localImpact",
    label: "Documented local impact",
    score: 8,
    weight: 10,
    explanation: "Uses self-reported counts linked to a public evidence source.",
    metrics: [{ label: "Policy mentions", value: 2, percent: 61 }],
  }],
};

const renderPage = () => render(
  <MemoryRouter initialEntries={["/gsi"]}>
    <GsiJournalOnboardingPage />
  </MemoryRouter>
);

describe("GSI local-impact evidence", () => {
  beforeEach(() => {
    window.scrollTo = vi.fn();
    mocks.calculateScore.mockReset();
    mocks.importJournal.mockReset();
    mocks.publishJournal.mockReset();
    mocks.searchJournals.mockReset();
    mocks.searchJournals.mockResolvedValue({ results: [source] });
    mocks.importJournal.mockResolvedValue({
      source,
      publications: [{
        id: "W1",
        title: "Community health systems",
        authors: [],
        publicationYear: 2025,
        isOpenAccess: true,
        doi: "https://doi.org/10.1000/example",
      }],
      importSummary: {
        totalWorks: 1,
        reviewedWorks: 1,
        importedAt: "2026-08-15T00:00:00.000Z",
      },
      score,
    });
    mocks.calculateScore.mockResolvedValue({
      score,
      impactEvidence: {
        policyMentions: 2,
        ngoAdoptions: 0,
        localCitations: 0,
        summary: null,
        sourceUrl: "https://government.example/policy",
        verificationStatus: "self-reported",
      },
    });
  });

  it("requires linked and attested evidence before recalculating the score", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText("Journal name, ISSN, publisher, or website"), "African health");
    await user.click(screen.getByRole("button", { name: "Find journal" }));
    await user.click(await screen.findByRole("button", { name: /This is my journal/i }));

    const calculateButton = screen.getByRole("button", { name: /Calculate GSI Score/i });
    await user.type(screen.getByLabelText("Government policy mentions"), "2");
    expect(calculateButton).toBeDisabled();

    await user.type(screen.getByLabelText("Public evidence link"), "https://government.example/policy");
    await user.click(screen.getByText(/I confirm these claims are accurate/i));
    expect(calculateButton).toBeEnabled();

    await user.click(calculateButton);

    await waitFor(() => expect(mocks.calculateScore).toHaveBeenCalledWith("S123", expect.objectContaining({
      policyMentions: "2",
      sourceUrl: "https://government.example/policy",
      attested: true,
    })));
    expect(await screen.findByRole("heading", { name: /GSI Score, explained/i })).toBeInTheDocument();
    expect(screen.getByText("Local impact: self-reported")).toBeInTheDocument();
  });
});
