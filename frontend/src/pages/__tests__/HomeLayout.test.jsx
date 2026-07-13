import React from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  getCreatorSummaryFeedMock,
  getDiscoveryHomeMock,
  getFeedMock,
  getProfileMock,
} = vi.hoisted(() => ({
  getCreatorSummaryFeedMock: vi.fn(),
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
  default: ({ post }) => <article>{post?.text}</article>,
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

vi.mock("../../components/creatorDiscovery/CreatorSummaryCard", () => ({
  default: () => null,
}));

vi.mock("../../Navbar", () => ({
  default: () => <div data-testid="home-navbar" />,
}));

vi.mock("../../Sidebar", () => ({
  default: () => <div data-testid="home-sidebar" />,
}));

vi.mock("../../Messenger", () => ({
  default: () => null,
}));

vi.mock("../../FriendRequests", () => ({
  default: () => <div data-testid="friend-requests" />,
}));

vi.mock("../../components/RightQuickNav", () => ({
  default: () => <div data-testid="quick-access" />,
}));

vi.mock("../../stories/StoriesBar", () => ({
  default: () => <div data-testid="stories-bar">Story cards</div>,
}));

vi.mock("../../api", () => ({
  createPost: vi.fn(),
  createPostWithUploadProgress: vi.fn(),
  getCreatorSummaryFeed: getCreatorSummaryFeedMock,
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
  name: "Viewer Person",
  username: "viewer",
  avatar: "",
};

const renderHome = () =>
  render(
    <MemoryRouter initialEntries={["/home"]}>
      <Routes>
        <Route path="/home" element={<Home user={viewer} />} />
        <Route path="/live/go" element={<h1>Live studio</h1>} />
      </Routes>
    </MemoryRouter>
  );

const waitForHomeReady = async () => {
  await screen.findByTestId("stories-bar");
  await screen.findByRole("heading", { name: /no posts yet/i });
};

describe("Home layout and composer shortcuts", () => {
  beforeEach(() => {
    getCreatorSummaryFeedMock.mockReset();
    getDiscoveryHomeMock.mockReset();
    getFeedMock.mockReset();
    getProfileMock.mockReset();

    getCreatorSummaryFeedMock.mockResolvedValue({ items: [] });
    getDiscoveryHomeMock.mockResolvedValue({
      requestId: "home-layout",
      surface: "home",
      items: [],
    });
    getFeedMock.mockResolvedValue([]);
    getProfileMock.mockResolvedValue(viewer);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders the modern home landmarks, welcome message, and stories section", async () => {
    renderHome();
    await waitForHomeReady();

    expect(screen.getByRole("link", { name: /skip to your feed/i })).toHaveAttribute(
      "href",
      "#home-feed"
    );
    expect(screen.getByRole("main")).toHaveAttribute("id", "home-feed");
    expect(
      screen.getByRole("heading", { level: 1, name: /welcome back, viewer/i })
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Stories" })).toBeInTheDocument();
    expect(screen.getByText(/fresh moments from your circle/i)).toBeInTheDocument();
    expect(screen.getByRole("complementary", { name: /home navigation/i })).toBeInTheDocument();
    expect(
      screen.getByRole("complementary", { name: /community shortcuts/i })
    ).toBeInTheDocument();
  });

  it("opens the post composer from the native prompt button", async () => {
    const user = userEvent.setup();
    renderHome();
    await waitForHomeReady();

    await user.click(screen.getByRole("button", { name: /what's on your mind/i }));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: /create post/i })).toBeInTheDocument();
  });

  it("routes the Live shortcut to the live studio", async () => {
    const user = userEvent.setup();
    renderHome();
    await waitForHomeReady();

    await user.click(screen.getByRole("button", { name: "Live" }));

    expect(await screen.findByRole("heading", { name: /live studio/i })).toBeInTheDocument();
  });

  it("opens the composer in reel mode from the Reel shortcut", async () => {
    const user = userEvent.setup();
    renderHome();
    await waitForHomeReady();

    await user.click(screen.getByRole("button", { name: "Reel" }));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: /create reel/i })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: /publish reel/i })).toBeDisabled();
  });
});
