import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getRecord: vi.fn() }));
vi.mock("./gsiApi", () => ({ getGsiRecord: mocks.getRecord }));

import GsiPublicRecordPage from "./GsiPublicRecordPage";

const recordId = "bafkreieomt2dt7l5zfgzycjpebgzsggyh565wbdm7l2mllws4wpfo7edca";
const publications = Array.from({ length: 25 }, (_, index) => ({
  id: `W${index + 1}`,
  title: `Retained publication ${index + 1}`,
  publicationYear: 2026,
  doi: `https://doi.org/10.1000/${index + 1}`,
  authors: [{ displayName: `Author ${index + 1}` }],
}));

const payload = {
  contentHash: "sha256:example",
  permanentUrl: `https://ipfs.io/ipfs/${recordId}`,
  record: {
    createdAt: "2026-08-15T00:00:00.000Z",
    journal: {
      displayName: "Pan African Medical Journal",
      publisher: "African Field Epidemiology Network",
      countryCode: "UG",
      issnL: "1937-8688",
      openAlexId: "S2755481371",
      worksCount: 10706,
    },
    provenance: {
      totalWorks: 10701,
      reviewedWorks: 100,
      scoredPublications: 98,
      archivedPublications: 25,
    },
    publicationHistory: [
      { year: 2026, worksCount: 900 },
      { year: 2025, worksCount: 840 },
    ],
    gsiScore: {
      total: 90,
      sampleSize: 98,
      components: [],
      fairnessNote: "No prestige ranking.",
      context: { scoredPublications: 98 },
    },
    impactEvidence: { verificationStatus: "not-provided" },
    publications,
  },
};

describe("GSI permanent journal record", () => {
  beforeEach(() => {
    mocks.getRecord.mockReset();
    mocks.getRecord.mockResolvedValue(payload);
    window.history.replaceState({}, "", "/");
  });

  it("distinguishes evidence totals and can reveal every retained publication", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={[`/gsi/records/${recordId}`]}>
        <Routes><Route path="/gsi/records/:recordId" element={<GsiPublicRecordPage />} /></Routes>
      </MemoryRouter>
    );

    expect(await screen.findByRole("heading", { name: "Pan African Medical Journal" })).toBeInTheDocument();
    expect(screen.getAllByText("10,706")).toHaveLength(2);
    expect(screen.getByText("100")).toBeInTheDocument();
    expect(screen.getByText("98")).toBeInTheDocument();
    expect(screen.getByText("25")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Continuity evidence by year" })).toBeInTheDocument();
    expect(screen.queryByText("Retained publication 25")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /View all 25 retained publications/i }));
    expect(screen.getByText("Retained publication 25")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Show first 20 publications/i })).toBeInTheDocument();
  });

  it("reveals and anchors a retained publication selected from Browse Research", async () => {
    window.history.replaceState({}, "", "/#publication-W25");
    window.requestAnimationFrame = vi.fn((callback) => callback());
    window.HTMLElement.prototype.scrollIntoView = vi.fn();

    render(
      <MemoryRouter initialEntries={[`/gsi/records/${recordId}#publication-W25`]}>
        <Routes><Route path="/gsi/records/:recordId" element={<GsiPublicRecordPage />} /></Routes>
      </MemoryRouter>
    );

    const selected = await screen.findByText("Retained publication 25");
    expect(selected.closest("article")).toHaveAttribute("id", "publication-W25");
    expect(window.HTMLElement.prototype.scrollIntoView).toHaveBeenCalled();
  });
});
