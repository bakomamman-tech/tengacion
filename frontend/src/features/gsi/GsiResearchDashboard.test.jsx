import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
      counts: { totalPublicRecords: 5, journals: 1, papers: 1, journalWorks: 3 },
    });
  });

  it("renders browsable paper records and discovery filters", async () => {
    render(<MemoryRouter><GsiResearchDashboard /></MemoryRouter>);

    expect(screen.getByLabelText("Search research")).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: "Community health delivery in Northern Nigeria" })).toHaveAttribute("href", "/gsi/papers/paper-1");
    expect(screen.getByText("Public health")).toBeInTheDocument();
    expect(screen.getByText("Nigeria")).toBeInTheDocument();
    expect(screen.getByText("Total public entries")).toBeInTheDocument();
    expect(screen.getAllByText("Journal publications")).toHaveLength(2);
  });

  it("labels imported works as journal publications and links to their parent evidence", async () => {
    const user = userEvent.setup();
    mocks.list.mockResolvedValue({
      results: [{
        archiveId: "cid:work:W123",
        recordKind: "journal-work",
        parentArchiveId: "cid",
        openAlexWorkId: "W123",
        title: "Cervical cancer control and prevention in Malawi",
        subtitle: "Thandiwe Banda",
        journalName: "Pan African Medical Journal",
        field: "Oncology",
        countryCode: "MW",
        publicationYear: 2026,
        gsiScore: 90,
        scoreContext: "parent-journal",
        publicRecordPath: "/gsi/records/cid#publication-W123",
        sourceProvider: "OpenAlex",
      }],
      pagination: { page: 1, limit: 12, total: 1, pages: 1 },
      counts: { totalPublicRecords: 4, journals: 1, papers: 0, journalWorks: 3 },
    });

    render(<MemoryRouter><GsiResearchDashboard /></MemoryRouter>);

    expect(await screen.findByText("Journal publication")).toBeInTheDocument();
    expect(screen.getByText("Published in Pan African Medical Journal")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Cervical cancer control and prevention in Malawi" })).toHaveAttribute("href", "/gsi/records/cid#publication-W123");
    expect(screen.getByText("/100 journal")).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Record type"), "journal-work");
    await user.click(screen.getByRole("button", { name: "Search" }));
    expect(mocks.list).toHaveBeenLastCalledWith(expect.objectContaining({ type: "journal-work", page: 1 }));
  });
});
