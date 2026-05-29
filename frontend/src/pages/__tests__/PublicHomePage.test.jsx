import { MemoryRouter } from "react-router-dom";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import PublicHomePage from "../PublicHomePage";
import { getCreatorSummaryFeed, getPublicActivity } from "../../api";

vi.mock("../../api", () => ({
  getCreatorSummaryFeed: vi.fn(),
  getPublicActivity: vi.fn(),
  resolveImage: (value) => value,
}));

vi.mock("../../components/seo/SeoHead", () => ({
  default: () => null,
}));

vi.mock("../../lib/seo", () => ({
  buildBreadcrumbJsonLd: vi.fn(() => ({})),
  buildOrganizationJsonLd: vi.fn(() => ({})),
  buildWebSiteJsonLd: vi.fn(() => ({})),
}));

describe("PublicHomePage", () => {
  beforeEach(() => {
    vi.mocked(getCreatorSummaryFeed).mockResolvedValue({
      total: 20,
      items: [
        {
          id: "song-1",
          title: "Firelight",
          creatorName: "Pyrexx_Singz",
          summaryLabel: "Song",
          route: "/music/firelight",
          coverImage: "/covers/firelight.jpg",
          price: 1500,
        },
        {
          id: "book-1",
          title: "Market Days",
          creatorName: "Ada Writes",
          summaryLabel: "Book",
          creatorRoute: "/creators/ada-writes",
        },
      ],
    });

    vi.mocked(getPublicActivity).mockResolvedValue([
      {
        _id: "post-1",
        type: "video",
        text: "Studio update from the rehearsal room.",
        user: { _id: "user-1", name: "Ada Beats" },
        likesCount: 7,
        commentsCount: 2,
      },
    ]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("shows live public releases, activity, and conversion actions", async () => {
    render(
      <MemoryRouter>
        <PublicHomePage />
      </MemoryRouter>
    );

    expect(screen.getAllByRole("link", { name: /explore creators/i })[0]).toHaveAttribute(
      "href",
      "/creators"
    );
    expect(screen.getAllByRole("link", { name: /upload as creator/i })[0]).toHaveAttribute(
      "href",
      "/creator/register"
    );

    await waitFor(() => {
      expect(getCreatorSummaryFeed).toHaveBeenCalledWith({
        category: "all",
        mode: "mixed",
        page: 1,
        limit: 6,
      });
      expect(getPublicActivity).toHaveBeenCalledWith({ limit: 6 });
    });

    expect(await screen.findByText("Firelight")).toBeInTheDocument();
    expect(screen.getByText("Pyrexx_Singz")).toBeInTheDocument();
    expect(screen.getByText("Market Days")).toBeInTheDocument();
    expect(screen.getByText("Ada Beats")).toBeInTheDocument();
    expect(screen.getByText("Studio update from the rehearsal room.")).toBeInTheDocument();
    expect(screen.getByText("Public releases loaded")).toBeInTheDocument();
    expect(screen.getByText("20")).toBeInTheDocument();
  });
});
