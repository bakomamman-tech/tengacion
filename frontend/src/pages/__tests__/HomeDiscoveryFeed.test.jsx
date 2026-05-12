import React from "react";
import { MemoryRouter } from "react-router-dom";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  getDiscoveryHomeMock,
  getFeedMock,
  getProfileMock,
} = vi.hoisted(() => ({
  getDiscoveryHomeMock: vi.fn(),
  getFeedMock: vi.fn(),
  getProfileMock: vi.fn(),
}));

vi.mock("react-hot-toast", () => ({
  default: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock("../../components/PostSkeleton", () => ({
  default: () => <div data-testid="post-skeleton" />,
}));

vi.mock("../../components/PostCard", () => ({
  default: ({ post, discoveryMeta }) => (
    <article data-testid="post-card" data-request-id={discoveryMeta?.requestId || ""}>
      <h2>{post?.text}</h2>
      {discoveryMeta?.reasonLabel ? <span>{discoveryMeta.reasonLabel}</span> : null}
    </article>
  ),
}));

vi.mock("../../features/news/components/NewsClusterCard", () => ({
  default: () => null,
}));

vi.mock("../../features/news/components/NewsDetailDrawer", () => ({
  default: () => null,
}));

vi.mock("../../features/news/components/NewsStoryCard", () => ({
  default: () => null,
}));

vi.mock("../../features/news/hooks/useNewsFeed", () => ({
  useNewsFeed: () => ({ cards: [] }),
}));

vi.mock("../../features/news/hooks/useNewsPreferences", () => ({
  useNewsPreferences: () => ({
    hideItem: vi.fn(),
    followSource: vi.fn(),
    reportIssue: vi.fn(),
    track: vi.fn(),
  }),
}));

vi.mock("../../components/creatorDiscovery/CreatorSummaryFeed", () => ({
  default: () => null,
}));

vi.mock("../../Navbar", () => ({
  default: () => null,
}));

vi.mock("../../Sidebar", () => ({
  default: () => null,
}));

vi.mock("../../Messenger", () => ({
  default: () => null,
}));

vi.mock("../../FriendRequests", () => ({
  default: () => null,
}));

vi.mock("../../components/RightQuickNav", () => ({
  default: () => null,
}));

vi.mock("../../stories/StoriesBar", () => ({
  default: () => null,
}));

vi.mock("../../socket", () => ({
  connectSocket: vi.fn(),
}));

vi.mock("../../api", () => ({
  createPost: vi.fn(),
  createPostWithUploadProgress: vi.fn(),
  getDiscoveryHome: getDiscoveryHomeMock,
  getFeed: getFeedMock,
  getProfile: getProfileMock,
  getUsers: vi.fn().mockResolvedValue([]),
  muteUser: vi.fn(),
  resolveImage: (value) => value,
  toggleFollowCreator: vi.fn(),
  trackDiscoveryEvents: vi.fn(),
}));

import Home from "../Home";

const viewer = {
  _id: "viewer-1",
  name: "Viewer",
  username: "viewer",
  avatar: "",
};

const renderHome = () =>
  render(
    <MemoryRouter initialEntries={["/home"]}>
      <Home user={viewer} />
    </MemoryRouter>
  );

describe("Home discovery feed", () => {
  beforeEach(() => {
    getDiscoveryHomeMock.mockReset();
    getFeedMock.mockReset();
    getProfileMock.mockReset();

    getProfileMock.mockResolvedValue(viewer);
    getFeedMock.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("loads the personalized discovery feed and keeps recommendation metadata on posts", async () => {
    getDiscoveryHomeMock.mockResolvedValue({
      requestId: "rec-home-1",
      surface: "home",
      items: [
        {
          id: "post-1",
          entityType: "post",
          rank: 1,
          reason: "fresh_content",
          reasonLabel: "New and relevant right now",
          creatorId: "creator-1",
          authorUserId: "author-1",
          viewerFollowsCreator: false,
          payload: {
            _id: "post-1",
            text: "Discovery first",
            user: {
              _id: "author-1",
              name: "Creator One",
              username: "creator_one",
            },
          },
        },
      ],
    });

    renderHome();

    expect(await screen.findByText("Discovery first")).toBeInTheDocument();
    expect(screen.getByTestId("post-card")).toHaveAttribute("data-request-id", "rec-home-1");
    expect(screen.getByText("New and relevant right now")).toBeInTheDocument();
    expect(getDiscoveryHomeMock).toHaveBeenCalledWith({ limit: 40 });
    expect(getFeedMock).not.toHaveBeenCalled();
  });

  it("falls back to the legacy feed when discovery is unavailable", async () => {
    getDiscoveryHomeMock.mockRejectedValue(new Error("discovery unavailable"));
    getFeedMock.mockResolvedValue([
      {
        _id: "legacy-post-1",
        text: "Legacy feed still loads",
        user: {
          _id: "author-2",
          name: "Creator Two",
          username: "creator_two",
        },
      },
    ]);

    renderHome();

    expect(await screen.findByText("Legacy feed still loads")).toBeInTheDocument();
    expect(screen.getByTestId("post-card")).toHaveAttribute("data-request-id", "");

    await waitFor(() => {
      expect(getFeedMock).toHaveBeenCalledTimes(1);
    });
  });
});
