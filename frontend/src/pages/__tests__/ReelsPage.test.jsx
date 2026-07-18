import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getPostByIdMock, getReelsFeedMock, likePostMock } = vi.hoisted(() => ({
  getPostByIdMock: vi.fn(),
  getReelsFeedMock: vi.fn(),
  likePostMock: vi.fn(),
}));

vi.mock("../../Navbar", () => ({
  default: () => <nav aria-label="Primary navigation" />,
}));

vi.mock("../../components/reels/ImmersiveReelsViewer", () => ({
  default: ({ activeReelId, error, loading, onLike, reels }) => {
    const activeReel = reels.find((entry) => entry?._id === activeReelId);
    return (
      <main
        data-testid="immersive-reels-viewer"
        data-active-reel={activeReelId}
        data-liked={activeReel?.likedByViewer ? "true" : "false"}
        data-likes={String(activeReel?.likesCount || 0)}
        data-loading={loading ? "true" : "false"}
      >
        {error || "Immersive reel"}
        <button type="button" onClick={() => onLike(activeReelId)}>Mock like reel</button>
      </main>
    );
  },
}));

vi.mock("../../api", () => ({
  createPostWithUploadProgress: vi.fn(),
  getPostById: getPostByIdMock,
  getReelsFeed: getReelsFeedMock,
  likePost: likePostMock,
  resolveImage: (value) => {
    if (!value) {
      return "";
    }
    if (typeof value === "string") {
      return value;
    }
    return value.playbackUrl || value.thumbnailUrl || value.url || "";
  },
}));

import ReelsPage from "../ReelsPage";

const selectedReel = {
  _id: "reel-selected",
  type: "reel",
  text: "Selected feed reel",
  likedByViewer: false,
  likesCount: 0,
  createdAt: "2026-07-18T12:00:00.000Z",
  video: {
    playbackUrl: "/uploads/reel-selected.mp4",
    thumbnailUrl: "/uploads/reel-selected.jpg",
  },
  user: {
    name: "Selected Creator",
    username: "selected_creator",
  },
};

const renderPage = (initialEntry) =>
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <ReelsPage user={{ _id: "viewer-1", username: "viewer" }} />
    </MemoryRouter>
  );

const renderPageInStrictMode = (initialEntry) =>
  render(
    <React.StrictMode>
      <MemoryRouter initialEntries={[initialEntry]}>
        <ReelsPage user={{ _id: "viewer-1", username: "viewer" }} />
      </MemoryRouter>
    </React.StrictMode>
  );

describe("ReelsPage entry modes", () => {
  beforeEach(() => {
    getPostByIdMock.mockReset();
    getReelsFeedMock.mockReset();
    likePostMock.mockReset();
    getPostByIdMock.mockResolvedValue(selectedReel);
    likePostMock.mockResolvedValue({ liked: true, likesCount: 1 });
  });

  it("keeps the normal reels dashboard for the plain Navbar route", async () => {
    getReelsFeedMock.mockResolvedValue([]);

    renderPage("/reels");

    expect(await screen.findByRole("navigation", { name: "Primary navigation" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Short videos with a stronger stage." })).toBeInTheDocument();
    expect(screen.queryByTestId("immersive-reels-viewer")).not.toBeInTheDocument();
    expect(getPostByIdMock).not.toHaveBeenCalled();
  });

  it("opens a feed-card query link in the immersive viewer", async () => {
    getReelsFeedMock.mockResolvedValue([selectedReel]);

    renderPage("/reels?reel=reel-selected");

    const viewer = await screen.findByTestId("immersive-reels-viewer");
    await waitFor(() => expect(viewer).toHaveAttribute("data-loading", "false"));
    expect(viewer).toHaveAttribute("data-active-reel", "reel-selected");
    expect(screen.queryByRole("navigation", { name: "Primary navigation" })).not.toBeInTheDocument();
    expect(getPostByIdMock).toHaveBeenCalledWith("reel-selected");
  });

  it("loads a directly linked older reel when it is not in the latest reel feed", async () => {
    getReelsFeedMock.mockResolvedValue([]);

    renderPage("/reels?reel=reel-selected");

    await waitFor(() => expect(getPostByIdMock).toHaveBeenCalledWith("reel-selected"));
    const viewer = screen.getByTestId("immersive-reels-viewer");
    await waitFor(() => expect(viewer).toHaveAttribute("data-loading", "false"));
    expect(viewer).toHaveAttribute("data-active-reel", "reel-selected");
  });

  it("does not make an older direct link wait for the latest feed request", async () => {
    getReelsFeedMock.mockReturnValue(new Promise(() => {}));
    getPostByIdMock.mockResolvedValue(selectedReel);

    renderPage("/reels?reel=reel-selected");

    const viewer = await screen.findByTestId("immersive-reels-viewer");
    await waitFor(() => expect(viewer).toHaveAttribute("data-loading", "false"));
    expect(viewer).toHaveAttribute("data-active-reel", "reel-selected");
  });

  it("deduplicates a pending exact-reel lookup during Strict Mode effect replays", async () => {
    getReelsFeedMock.mockReturnValue(new Promise(() => {}));
    getPostByIdMock.mockReturnValue(new Promise(() => {}));

    renderPageInStrictMode("/reels?reel=reel-selected");

    await waitFor(() => expect(getPostByIdMock).toHaveBeenCalledTimes(1));
  });

  it("preserves a confirmed like when the slower feed response arrives", async () => {
    let resolveFeed;
    getReelsFeedMock.mockReturnValue(
      new Promise((resolve) => {
        resolveFeed = resolve;
      })
    );

    renderPage("/reels?reel=reel-selected");

    const viewer = await screen.findByTestId("immersive-reels-viewer");
    await waitFor(() => expect(viewer).toHaveAttribute("data-loading", "false"));
    fireEvent.click(screen.getByRole("button", { name: "Mock like reel" }));
    await waitFor(() => {
      expect(viewer).toHaveAttribute("data-liked", "true");
      expect(viewer).toHaveAttribute("data-likes", "1");
    });

    await act(async () => {
      resolveFeed([{ ...selectedReel, likedByViewer: false, likesCount: 0 }]);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(viewer).toHaveAttribute("data-liked", "true");
      expect(viewer).toHaveAttribute("data-likes", "1");
    });
  });

  it("does not restore a cached playable reel after the feed marks it restricted", async () => {
    let resolveFeed;
    getReelsFeedMock.mockReturnValue(
      new Promise((resolve) => {
        resolveFeed = resolve;
      })
    );

    renderPage("/reels?reel=reel-selected");

    const viewer = await screen.findByTestId("immersive-reels-viewer");
    await waitFor(() => expect(viewer).toHaveAttribute("data-loading", "false"));

    await act(async () => {
      resolveFeed([
        {
          ...selectedReel,
          autoplayDisabled: true,
          moderationStatus: "RESTRICTED_BLURRED",
        },
      ]);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(viewer).toHaveTextContent("This reel is no longer available.");
      expect(viewer).toHaveAttribute("data-loading", "false");
    });
    expect(getPostByIdMock).toHaveBeenCalledTimes(1);
  });
});
