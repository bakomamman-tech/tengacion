import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getStoryMusicCatalogMock } = vi.hoisted(() => ({
  getStoryMusicCatalogMock: vi.fn(),
}));

vi.mock("../../api", () => ({
  createStoryWithUploadProgress: vi.fn(),
  getStoryMusicCatalog: getStoryMusicCatalogMock,
  resolveImage: (value) => value,
}));

import CreateStory from "../CreateStory";

describe("CreateStory studio", () => {
  beforeEach(() => {
    getStoryMusicCatalogMock.mockReset();
    getStoryMusicCatalogMock.mockResolvedValue({
      page: 1,
      hasMore: false,
      items: [
        {
          id: "track-1",
          contentId: "track-1",
          itemType: "track",
          title: "Promote This Song",
          creatorId: "creator-1",
          creatorName: "Registered Artist",
          coverImage: "/song-cover.jpg",
          previewUrl: "/song-preview.mp3",
          previewLimitSec: 30,
          summaryLabel: "Song",
        },
      ],
    });
  });

  it("renders separate creation and preview panels and opens registered creator music", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <CreateStory
        user={{ name: "Ada Tengacion", username: "ada", avatar: "/ada.jpg" }}
        openSignal={1}
      />
    );

    expect(await screen.findByRole("heading", { name: /your story/i })).toBeInTheDocument();
    expect(container.querySelector(".story-create-sidebar")).toBeInTheDocument();
    expect(container.querySelector(".story-create-workspace")).toBeInTheDocument();
    expect(screen.getByText("Preview")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /add music/i }));

    await waitFor(() => {
      expect(getStoryMusicCatalogMock).toHaveBeenCalledWith({
        page: 1,
        limit: 30,
        search: "",
      });
    });
    expect(await screen.findByText("Promote This Song")).toBeInTheDocument();
    expect(screen.getByText("Registered Artist")).toBeInTheDocument();
    expect(screen.getByText("30 sec preview")).toBeInTheDocument();
  });
});
