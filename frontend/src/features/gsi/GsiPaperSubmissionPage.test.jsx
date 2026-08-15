import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ calculate: vi.fn(), publish: vi.fn() }));
vi.mock("./gsiApi", () => ({
  calculateGsiPaperScore: mocks.calculate,
  publishGsiPaper: mocks.publish,
}));

import GsiPaperSubmissionPage from "./GsiPaperSubmissionPage";

const paper = {
  title: "Community health delivery in Northern Nigeria",
  abstract: "This study documents a community health delivery model and evaluates how local clinics used it across several districts over a two-year period.",
  field: "Public health",
  authors: ["Ada Okafor", "Musa Bello"],
  institution: null,
  countryCode: "NG",
  publicationYear: 2026,
  doi: null,
  openAccessUrl: null,
  journalName: null,
};
const score = {
  version: "GSI-Paper-1.0",
  total: 62,
  summary: "This paper has strong metadata coverage.",
  methodologyNote: "This score uses submitted paper metadata.",
  fairnessNote: "This score is not a judgment of research quality.",
  components: [{ key: "metadata", label: "Metadata completeness", score: 20, weight: 25, explanation: "Four fields are present." }],
};

describe("GSI paper submission", () => {
  beforeEach(() => {
    window.scrollTo = vi.fn();
    mocks.calculate.mockReset();
    mocks.publish.mockReset();
    mocks.calculate.mockResolvedValue({ paper, score, impactEvidence: { verificationStatus: "not-provided" } });
    mocks.publish.mockResolvedValue({ publicRecordPath: "/gsi/papers/example-record" });
  });

  it("scores the paper before asking for explicit public-registry consent", async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><GsiPaperSubmissionPage /></MemoryRouter>);

    await user.type(screen.getByLabelText(/Paper title/), paper.title);
    await user.type(screen.getByLabelText(/Abstract/), paper.abstract);
    await user.type(screen.getByLabelText(/Research field/), paper.field);
    await user.type(screen.getByLabelText(/Authors/), "Ada Okafor, Musa Bello");
    await user.type(screen.getByLabelText(/Research country code/), "NG");
    await user.click(screen.getByRole("button", { name: /Review transparent score/i }));

    await waitFor(() => expect(mocks.calculate).toHaveBeenCalled());
    expect(await screen.findByText("Every point is traceable.")).toBeInTheDocument();
    expect(screen.getByText(/permission to add them to the public registry/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Publish paper record/i })).toBeDisabled();
  });
});
