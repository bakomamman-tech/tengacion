import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock("./gsiApi", () => ({ listGsiResearch: mocks.list }));

import GsiResearchDashboard from "./GsiResearchDashboard";

describe("GSI public research dashboard", () => {
  beforeEach(() => {
    mocks.list.mockReset();
    mocks.list.mockResolvedValue({
      results: [{
        archiveId: "paper-1",
        recordKind: "paper",
        title: "Community health delivery in Northern Nigeria",
        subtitle: "Ada Okafor, Musa Bello",
        abstract: "A public abstract for discovery.",
        field: "Public health",
        countryCode: "NG",
        publicationYear: 2026,
        gsiScore: 62,
        publicRecordPath: "/gsi/papers/paper-1",
        impactEvidenceStatus: "not-provided",
      }],
      pagination: { page: 1, limit: 12, total: 1, pages: 1 },
    });
  });

  it("renders browsable paper records and discovery filters", async () => {
    render(<MemoryRouter><GsiResearchDashboard /></MemoryRouter>);

    expect(screen.getByLabelText("Search research")).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: "Community health delivery in Northern Nigeria" })).toHaveAttribute("href", "/gsi/papers/paper-1");
    expect(screen.getByText("Public health")).toBeInTheDocument();
    expect(screen.getByText("Nigeria")).toBeInTheDocument();
  });
});
