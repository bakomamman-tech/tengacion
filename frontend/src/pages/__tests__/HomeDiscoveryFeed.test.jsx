import React from "react";
import { MemoryRouter } from "react-router-dom";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  getDiscoveryHomeMock,
  getFeedMock,
  getProfileMock,
  getReelsFeedMock,
  getTopUpPromoStatusMock,
  newsFeedCardsState,
} = vi.hoisted(() => ({
  getDiscoveryHomeMock: vi.fn(),
  getFeedMock: vi.fn(),
  getProfileMock: vi.fn(),
  getReelsFeedMock: vi.fn(),
  getTopUpPromoStatusMock: vi.fn(),
  newsFeedCardsState: { current: [] },
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
  default: ({ card }) => <aside data-testid="news-cluster-card">{card?.title}</aside>,
}));

vi.mock("../../features/news/components/NewsDetailDrawer", () => ({
  default: () => null,
}));

vi.mock("../../features/news/components/NewsStoryCard", () => ({
  default: ({ card }) => <aside data-testid="news-story-card">{card?.title}</aside>,
}));

vi.mock("../../features/news/hooks/useNewsFeed", () => ({
  useNewsFeed: () => ({ cards: newsFeedCardsState.current }),
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

vi.mock("../../components/creatorDiscovery/CreatorSummaryCard", () => ({
  default: ({ item }) => <aside data-testid="creator-release">{item?.title}</aside>,
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
  getCreatorSummaryFeed: vi.fn().mockResolvedValue({ items: [] }),
  getFeed: getFeedMock,
  getProfile: getProfileMock,
  getReelsFeed: getReelsFeedMock,
  getTopUpPromoStatus: getTopUpPromoStatusMock,
  discoverTopUpPromoChest: vi.fn(),
  getUsers: vi.fn().mockResolvedValue([]),
  muteUser: vi.fn(),
  resolveImage: (value) => value,
  toggleFollowCreator: vi.fn(),
  trackDiscoveryEvents: vi.fn(),
}));

import Home from "../Home";
import { buildAlphabeticalCreatorRotation } from "../homeCreatorRotation";

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
    getReelsFeedMock.mockReset();
    getTopUpPromoStatusMock.mockReset();
    newsFeedCardsState.current = [];

    getProfileMock.mockResolvedValue(viewer);
    getFeedMock.mockResolvedValue([]);
    getReelsFeedMock.mockResolvedValue([]);
    getTopUpPromoStatusMock.mockResolvedValue({
      visibility: { visible: false, reason: "test" },
      hasPlayed: false,
      play: null,
    });
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
    expect(getReelsFeedMock).toHaveBeenCalledWith({ limit: 24 });
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

  it("places a horizontal reels carousel after every five feed posts", async () => {
    newsFeedCardsState.current = [
      { id: "news-1", cardType: "story", title: "An injected news card" },
    ];
    getDiscoveryHomeMock.mockResolvedValue({
      requestId: "rec-home-reels",
      surface: "home",
      items: Array.from({ length: 10 }, (_, index) => ({
        id: `post-${index + 1}`,
        entityType: "post",
        rank: index + 1,
        payload: {
          _id: `post-${index + 1}`,
          text: `Feed post ${index + 1}`,
          user: {
            _id: `author-${index + 1}`,
            name: `Creator ${index + 1}`,
            username: `creator_${index + 1}`,
          },
        },
      })),
    });
    getReelsFeedMock.mockResolvedValue([
      {
        _id: "reel-1",
        type: "reel",
        text: "A posted Tengacion reel",
        createdAt: "2026-07-18T10:00:00.000Z",
        video: {
          playbackUrl: "/uploads/reel-1.mp4",
          thumbnailUrl: "/uploads/reel-1.jpg",
        },
        user: {
          _id: "reel-author-1",
          name: "Reel Creator",
          username: "reel_creator",
        },
      },
    ]);

    renderHome();

    const posts = await screen.findAllByTestId("post-card");
    const reelCarousels = await screen.findAllByRole("region", { name: "Tengacion reels" });

    expect(posts).toHaveLength(10);
    expect(screen.getByTestId("news-story-card")).toHaveTextContent("An injected news card");
    expect(reelCarousels).toHaveLength(2);
    expect(reelCarousels[0].previousElementSibling).toContainElement(posts[4]);
    expect(reelCarousels[1].previousElementSibling).toContainElement(posts[9]);
    expect(screen.getAllByRole("link", { name: /watch a posted tengacion reel/i })).toHaveLength(2);
  });

  it("cycles every creator release alphabetically before repeating", () => {
    const rotation = buildAlphabeticalCreatorRotation([
      { id: "y", creatorId: "pyrexx", creatorName: "Pyrexx_Singz", title: "Yarinya (My Girl)" },
      { id: "z", creatorId: "zara", creatorName: "Zara", title: "Z Song" },
      { id: "m", creatorId: "pyrexx", creatorName: "Pyrexx_Singz", title: "Mama" },
      { id: "a", creatorId: "ada", creatorName: "Ada", title: "Ada Song" },
      { id: "h", creatorId: "pyrexx", creatorName: "Pyrexx_Singz", title: "Hold Me And Pray" },
    ]);

    expect(rotation.map((item) => item.title)).toEqual([
      "Ada Song",
      "Hold Me And Pray",
      "Z Song",
      "Mama",
      "Yarinya (My Girl)",
    ]);
  });
});
