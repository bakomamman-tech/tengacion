import React from "react";
import { MemoryRouter } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import CreatorFanPageViewPage from "../CreatorFanPageViewPage";
import { loadCreatorWorkspaceBundle } from "../../../components/creator/creatorWorkspaceData";

vi.mock("../../../components/creator/creatorWorkspaceData", () => ({
  loadCreatorWorkspaceBundle: vi.fn(),
}));

describe("CreatorFanPageViewPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads the dedicated full-page fan preview", async () => {
    loadCreatorWorkspaceBundle.mockResolvedValue({
      creatorProfile: {
        displayName: "Creator Example",
        creatorTypes: ["music", "bookPublishing", "podcast"],
        user: {
          followersCount: 2048,
        },
      },
      dashboard: {
        categories: {
          music: { uploads: 3 },
          bookPublishing: { uploads: 2 },
          podcast: { uploads: 1 },
        },
        content: {
          music: {
            tracks: [{ title: "Golden Echoes", artistName: "Creator Example", price: 500 }],
            videos: [{ title: "Golden Echoes Live" }],
          },
          books: {
            items: [{ title: "The Quiet Fire", authorName: "Creator Example", price: 2500 }],
          },
          podcasts: {
            episodes: [{ title: "The Process", podcastSeries: "Creator Sessions" }],
          },
        },
      },
    });

    render(
      <MemoryRouter>
        <CreatorFanPageViewPage />
      </MemoryRouter>
    );

    expect(
      await screen.findByRole("heading", { name: /creator example/i, level: 1 })
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /back to dashboard/i })).toHaveAttribute(
      "href",
      "/creator/dashboard"
    );
    expect(screen.getByText(/popular releases/i)).toBeInTheDocument();
    expect(screen.getByText(/listen on youtube \/ spotify/i)).toBeInTheDocument();
  });
});
