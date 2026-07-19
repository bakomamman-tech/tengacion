import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getStoryMusicCatalogMock } = vi.hoisted(() => ({
  getStoryMusicCatalogMock: vi.fn(),
}));

vi.mock("../../api", () => ({
  getStoryMusicCatalog: getStoryMusicCatalogMock,
  resolveImage: (value) => value,
}));

import StoryMusicPicker from "../StoryMusicPicker";

const makeSong = (id, title) => ({
  id,
  contentId: id,
  itemType: "track",
  title,
  creatorId: "creator-1",
  creatorName: "Registered Artist",
  coverImage: `/covers/${id}.jpg`,
  previewUrl: `/previews/${id}.mp3`,
  previewLimitSec: 30,
  summaryLabel: "Song",
});

describe("StoryMusicPicker", () => {
  beforeEach(() => {
    getStoryMusicCatalogMock.mockReset();
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
    vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("automatically loads every catalog page", async () => {
    getStoryMusicCatalogMock.mockImplementation(({ page }) => {
      if (page === 1) {
        return Promise.resolve({
          page: 1,
          limit: 30,
          total: 2,
          hasMore: true,
          items: [makeSong("track-1", "First Song")],
        });
      }
      return Promise.resolve({
        page: 2,
        limit: 30,
        total: 2,
        hasMore: false,
        items: [makeSong("track-2", "Last Song")],
      });
    });

    render(<StoryMusicPicker onClose={vi.fn()} onSelect={vi.fn()} />);

    expect(await screen.findByText("First Song")).toBeInTheDocument();
    expect(await screen.findByText("Last Song")).toBeInTheDocument();
    await waitFor(() => {
      expect(getStoryMusicCatalogMock).toHaveBeenCalledTimes(2);
    });
    expect(getStoryMusicCatalogMock).toHaveBeenNthCalledWith(2, {
      page: 2,
      limit: 30,
      search: "",
    });
    expect(screen.getByText("2 available songs")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /load remaining songs/i }))
      .not.toBeInTheDocument();
  });

  it("keeps loaded songs visible and allows a failed remaining page to be retried", async () => {
    getStoryMusicCatalogMock
      .mockResolvedValueOnce({
        page: 1,
        limit: 30,
        total: 2,
        hasMore: true,
        items: [makeSong("track-1", "Loaded Song")],
      })
      .mockRejectedValueOnce(new Error("Temporary catalog error"))
      .mockResolvedValueOnce({
        page: 2,
        limit: 30,
        total: 2,
        hasMore: false,
        items: [makeSong("track-2", "Recovered Song")],
      });

    const user = userEvent.setup();
    render(<StoryMusicPicker onClose={vi.fn()} onSelect={vi.fn()} />);

    expect(await screen.findByText("Loaded Song")).toBeInTheDocument();
    expect(await screen.findByRole("alert")).toHaveTextContent("Temporary catalog error");
    await user.click(
      screen.getByRole("button", { name: /retry loading remaining songs/i })
    );

    expect(await screen.findByText("Recovered Song")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
  });

  it("previews a song from the creator's chosen start time", async () => {
    getStoryMusicCatalogMock.mockResolvedValue({
      page: 1,
      limit: 30,
      total: 1,
      hasMore: false,
      items: [{ ...makeSong("track-1", "Start Here"), previewStartSec: 12 }],
    });

    const user = userEvent.setup();
    const { container } = render(
      <StoryMusicPicker onClose={vi.fn()} onSelect={vi.fn()} />
    );

    await user.click(await screen.findByRole("button", { name: "Preview" }));

    await waitFor(() => {
      expect(container.querySelector("audio").currentTime).toBe(12);
    });
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalled();
  });
});
