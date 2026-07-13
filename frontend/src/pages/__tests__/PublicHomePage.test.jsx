import { MemoryRouter } from "react-router-dom";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import PublicHomePage from "../PublicHomePage";
import { getCreatorDiscovery, getCreatorSummaryFeed, getPublicActivity } from "../../api";

vi.mock("../../api", () => ({
  getCreatorDiscovery: vi.fn(),
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

    vi.mocked(getCreatorDiscovery).mockResolvedValue({
      total: 2,
      items: [
        {
          id: "creator-1",
          creatorId: "creator-1",
          name: "Zainab Sounds",
          username: "zainab",
          avatar: "/avatars/zainab.jpg",
          category: "Music",
          categoryLabels: ["Music"],
          bio: "Soulful northern music.",
          followerCount: 120,
          contentCount: 6,
          creatorRoute: "/creator/zainab",
          trustBadges: ["Verified Creator"],
        },
        {
          id: "creator-2",
          creatorId: "creator-2",
          name: "Banner Studio",
          username: "banner-studio",
          banner: "/banners/banner-studio.jpg",
          category: "Business",
          followerCount: 4,
          contentCount: 2,
          creatorRoute: "/creator/banner-studio",
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

    expect(document.querySelector("main.public-home")).toHaveClass("public-home--nature-green");
    expect(screen.getByRole("heading", { name: /africa's social commerce/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Log in / Create account" })).toHaveAttribute(
      "href",
      "/login"
    );
    expect(screen.getAllByRole("link", { name: /join as creator/i })[0]).toHaveAttribute(
      "href",
      "/creator/register"
    );
    expect(screen.getAllByRole("link", { name: /explore marketplace/i })[0]).toHaveAttribute(
      "href",
      "/marketplace"
    );
    expect(screen.getAllByRole("link", { name: /sell on tengacion/i })[0]).toHaveAttribute(
      "href",
      "/marketplace/register"
    );
    expect(screen.getByRole("heading", { name: /choose a clear path/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /safety & reporting/i })).toHaveAttribute(
      "href",
      "/safety"
    );
    expect(screen.getByText("Tengacion Technologies Limited parent company")).toBeInTheDocument();
    expect(screen.getByText("CAC-registered company")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Leadership" })).toHaveAttribute(
      "href",
      "/leadership"
    );

    await waitFor(() => {
      expect(getCreatorSummaryFeed).toHaveBeenCalledWith({
        category: "all",
        mode: "mixed",
        page: 1,
        limit: 6,
      });
      expect(getCreatorDiscovery).toHaveBeenCalledWith({
        category: "all",
        sort: "popular",
        page: 1,
        limit: 4,
      });
      expect(getPublicActivity).toHaveBeenCalledWith({ limit: 6 });
    });

    expect(await screen.findByText("Zainab Sounds")).toBeInTheDocument();
    expect(document.querySelector(".public-home-creator__avatar--profile img")).toHaveAttribute(
      "src",
      "/avatars/zainab.jpg"
    );
    expect(document.querySelector(".public-home-creator__avatar--banner img")).toHaveAttribute(
      "src",
      "/banners/banner-studio.jpg"
    );
    expect(screen.getByText("Verified Creator")).toBeInTheDocument();
    expect(await screen.findByText("Firelight")).toBeInTheDocument();
    expect(screen.getByText("Pyrexx_Singz")).toBeInTheDocument();
    expect(screen.getByText("Market Days")).toBeInTheDocument();
    expect(screen.getByText("Ada Beats")).toBeInTheDocument();
    expect(screen.getByText("Studio update from the rehearsal room.")).toBeInTheDocument();
    expect(screen.getByText("Public releases")).toBeInTheDocument();
    expect(screen.getByText("20")).toBeInTheDocument();
  });
});
