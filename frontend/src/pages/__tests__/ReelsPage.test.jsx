import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

import ReelsPage from "../ReelsPage";
import { getFeed } from "../../api";

const navigateMock = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock("../../api", () => ({
  createPostWithUploadProgress: vi.fn(),
  getFeed: vi.fn(),
  likePost: vi.fn(),
  resolveImage: (value) => value,
}));

vi.mock("../../Navbar", () => ({
  default: () => <div data-testid="navbar" />,
}));

vi.mock("../../components/posts/ExpandablePostText", () => ({
  default: ({ text }) => <p>{text}</p>,
}));

vi.mock("react-hot-toast", () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("ReelsPage", () => {
  beforeEach(() => {
    navigateMock.mockReset();
    vi.clearAllMocks();

    class MockIntersectionObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    }

    globalThis.IntersectionObserver = MockIntersectionObserver;
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});

    vi.mocked(getFeed).mockResolvedValue([
      {
        _id: "gallery-post",
        type: "image",
        text: "Gallery with a video first",
        createdAt: "2026-04-23T07:00:00.000Z",
        commentsCount: 1,
        likesCount: 3,
        user: {
          name: "Gallery Author",
          username: "gallery_author",
          profilePic: "",
        },
        media: [
          { url: "https://cdn.test/media/gallery-video.mp4", type: "video" },
          { url: "https://cdn.test/media/gallery-photo.jpg", type: "image" },
        ],
      },
      {
        _id: "native-reel",
        type: "reel",
        text: "Native reel caption",
        createdAt: "2026-04-23T08:00:00.000Z",
        commentsCount: 2,
        likesCount: 8,
        user: {
          name: "Reel Author",
          username: "reel_author",
          profilePic: "",
        },
        media: [
          { url: "https://cdn.test/media/reel-video.mp4", type: "video" },
        ],
      },
    ]);
  });

  afterEach(() => {
    delete globalThis.IntersectionObserver;
    vi.restoreAllMocks();
  });

  it("keeps mixed media gallery posts out of the reels stream", async () => {
    render(
      <MemoryRouter initialEntries={["/reels"]}>
        <ReelsPage user={{ _id: "viewer-1", username: "viewer", name: "Viewer" }} />
      </MemoryRouter>
    );

    expect(await screen.findByRole("heading", { name: "Discover what creators are posting now" })).toBeInTheDocument();

    await waitFor(() => {
      expect(getFeed).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByText("Native reel caption")).toBeInTheDocument();
    expect(screen.queryByText("Gallery with a video first")).not.toBeInTheDocument();
  });
});
