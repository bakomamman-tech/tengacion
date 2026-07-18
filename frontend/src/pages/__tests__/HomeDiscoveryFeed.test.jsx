import React from "react";
import { MemoryRouter } from "react-router-dom";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  getDiscoveryHomeMock,
  getFeedMock,
  getFriendsHubMock,
  getProfileMock,
  getReelsFeedMock,
  getStoriesMock,
  sendFriendRequestMock,
  getTopUpPromoStatusMock,
  newsFeedCardsState,
} = vi.hoisted(() => ({
  getDiscoveryHomeMock: vi.fn(),
  getFeedMock: vi.fn(),
  getFriendsHubMock: vi.fn(),
  getProfileMock: vi.fn(),
  getReelsFeedMock: vi.fn(),
  getStoriesMock: vi.fn(),
  sendFriendRequestMock: vi.fn(),
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

vi.mock("../../components/feed/InFeedPeopleCarousel", () => ({
  default: ({ blockIndex }) => (
    <section aria-label="People you may know" data-block-index={blockIndex} />
  ),
}));

vi.mock("../../components/feed/InFeedStoriesCarousel", () => ({
  default: ({ blockIndex }) => <section aria-label="Stories" data-block-index={blockIndex} />,
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
  getFriendsHub: getFriendsHubMock,
  getProfile: getProfileMock,
  getReelsFeed: getReelsFeedMock,
  getStories: getStoriesMock,
  getTopUpPromoStatus: getTopUpPromoStatusMock,
  discoverTopUpPromoChest: vi.fn(),
  getUsers: vi.fn().mockResolvedValue([]),
  muteUser: vi.fn(),
  resolveImage: (value) => value,
  sendFriendRequest: sendFriendRequestMock,
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
    getFriendsHubMock.mockReset();
    getProfileMock.mockReset();
    getReelsFeedMock.mockReset();
    getStoriesMock.mockReset();
    sendFriendRequestMock.mockReset();
    getTopUpPromoStatusMock.mockReset();
    newsFeedCardsState.current = [];

    getProfileMock.mockResolvedValue(viewer);
    getFeedMock.mockResolvedValue([]);
    getFriendsHubMock.mockResolvedValue({ suggestions: [] });
    getReelsFeedMock.mockResolvedValue([]);
    getStoriesMock.mockResolvedValue([]);
    sendFriendRequestMock.mockResolvedValue({ sent: true });
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

  it("keeps People, Stories, and Reels on independent post cadences", async () => {
    newsFeedCardsState.current = [
      { id: "news-1", cardType: "story", title: "News does not change shelf timing" },
    ];
    getDiscoveryHomeMock.mockResolvedValue({
      requestId: "rec-home-shelves",
      surface: "home",
      items: Array.from({ length: 10 }, (_, index) => ({
        id: `cadence-post-${index + 1}`,
        entityType: "post",
        rank: index + 1,
        payload: {
          _id: `cadence-post-${index + 1}`,
          text: `Cadence post ${index + 1}`,
          user: {
            _id: `cadence-author-${index + 1}`,
            name: `Cadence Creator ${index + 1}`,
            username: `cadence_creator_${index + 1}`,
          },
        },
      })),
    });
    getFriendsHubMock.mockResolvedValue({
      suggestions: [
        {
          _id: "suggestion-1",
          name: "Suggested Person",
          username: "suggested_person",
          avatar: "/uploads/suggested-person.jpg",
          mutualFriendsCount: 2,
        },
      ],
    });
    getStoriesMock.mockResolvedValue([
      {
        _id: "story-1",
        userId: "story-author-1",
        username: "story_author",
        mediaUrl: "/uploads/story-1.jpg",
        mediaType: "image",
        time: "2026-07-18T11:00:00.000Z",
        viewerSeen: false,
      },
    ]);
    getReelsFeedMock.mockResolvedValue([
      {
        _id: "cadence-reel-1",
        type: "reel",
        text: "Cadence reel",
        video: {
          playbackUrl: "/uploads/cadence-reel-1.mp4",
          thumbnailUrl: "/uploads/cadence-reel-1.jpg",
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
    const peopleShelves = await screen.findAllByRole("region", { name: "People you may know" });
    const storyShelves = await screen.findAllByRole("region", { name: "Stories" });
    const reelShelves = await screen.findAllByRole("region", { name: "Tengacion reels" });

    expect(posts).toHaveLength(10);
    expect(peopleShelves).toHaveLength(5);
    expect(storyShelves).toHaveLength(3);
    expect(reelShelves).toHaveLength(2);
    expect(getFriendsHubMock).toHaveBeenCalledTimes(1);
    expect(getStoriesMock).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("news-story-card")).toHaveTextContent(
      "News does not change shelf timing"
    );

    const afterSix = posts[5].closest(".home-feed-pair");
    expect(afterSix?.nextElementSibling).toBe(peopleShelves[2]);
    expect(peopleShelves[2].nextElementSibling).toBe(storyShelves[1]);

    const afterTen = posts[9].closest(".home-feed-pair");
    expect(afterTen?.nextElementSibling).toBe(peopleShelves[4]);
    expect(peopleShelves[4].nextElementSibling).toBe(reelShelves[1]);
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
