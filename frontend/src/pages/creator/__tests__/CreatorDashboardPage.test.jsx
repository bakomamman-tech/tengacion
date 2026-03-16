import React from "react";
import { MemoryRouter } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import CreatorDashboardPage from "../CreatorDashboardPage";
import { useCreatorWorkspace } from "../../../components/creator/useCreatorWorkspace";

vi.mock("../../../components/creator/useCreatorWorkspace", () => ({
  useCreatorWorkspace: vi.fn(),
}));

describe("CreatorDashboardPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("links each creator lane card to its dedicated studio route", () => {
    useCreatorWorkspace.mockReturnValue({
      creatorProfile: {
        displayName: "Creator Example",
        creatorTypes: ["music", "bookPublishing", "podcast"],
      },
      dashboard: {
        summary: {
          totalEarnings: 0,
          availableBalance: 0,
          pendingBalance: 0,
          withdrawn: 0,
        },
        categories: {
          music: { uploads: 2, drafts: 1, earnings: 0, underReview: 0 },
          bookPublishing: { uploads: 1, drafts: 0, earnings: 0, underReview: 0 },
          podcast: { uploads: 3, drafts: 1, earnings: 0, underReview: 1 },
        },
        verificationOverview: {},
        recentActivity: [],
      },
    });

    render(
      <MemoryRouter>
        <CreatorDashboardPage />
      </MemoryRouter>
    );

    expect(screen.getByRole("link", { name: /go to music dashboard/i })).toHaveAttribute(
      "href",
      "/creator/music"
    );
    expect(screen.getAllByRole("link", { name: /upload music/i })[0]).toHaveAttribute("href", "/creator/music/upload");
    expect(
      screen.getByRole("link", { name: /go to book publishing dashboard/i })
    ).toHaveAttribute("href", "/creator/books");
    expect(screen.getAllByRole("link", { name: /upload book/i })[0]).toHaveAttribute("href", "/creator/books/upload");
    expect(screen.getByRole("link", { name: /go to podcast dashboard/i })).toHaveAttribute(
      "href",
      "/creator/podcasts"
    );
    expect(screen.getAllByRole("link", { name: /upload podcasts/i })[0]).toHaveAttribute("href", "/creator/podcasts/upload");
  }, 15000);
});
