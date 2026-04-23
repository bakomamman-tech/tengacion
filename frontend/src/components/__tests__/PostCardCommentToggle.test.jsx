import React from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import PostCard from "../PostCard";

vi.mock("../share/PostShareModal", () => ({
  default: () => null,
}));

vi.mock("../media/VideoPlayer", () => ({
  default: () => null,
}));

vi.mock("../ui/useDialog", () => ({
  useDialog: () => ({
    confirm: vi.fn().mockResolvedValue(true),
    prompt: vi.fn().mockResolvedValue("General"),
  }),
}));

vi.mock("../../api", () => ({
  apiRequest: vi.fn(),
  createReport: vi.fn(),
  createPostComment: vi.fn(),
  initPayment: vi.fn(),
  getPostComments: vi.fn().mockResolvedValue([]),
  resolveImage: (value) => value,
  updatePostComment: vi.fn(),
}));

vi.mock("../share/postShareUtils", () => ({
  buildPostShareUrl: vi.fn(() => "https://tengacion.example/posts/post-1"),
  fallbackAvatar: vi.fn(() => "/avatar.png"),
  truncateText: (value) => value,
}));

describe("PostCard comment toggle", () => {
  beforeEach(() => {
    class MockIntersectionObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    }

    class MockResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    }

    globalThis.IntersectionObserver = MockIntersectionObserver;
    globalThis.ResizeObserver = MockResizeObserver;

    Object.defineProperty(HTMLElement.prototype, "clientHeight", {
      configurable: true,
      get() {
        if (this.classList?.contains("expandable-post-text__measure--collapsed")) {
          return 96;
        }
        if (this.classList?.contains("expandable-post-text__measure")) {
          return (this.textContent?.length || 0) > 180 ? 240 : 96;
        }
        return 0;
      },
    });

    Object.defineProperty(HTMLElement.prototype, "scrollHeight", {
      configurable: true,
      get() {
        if (this.classList?.contains("expandable-post-text__measure--collapsed")) {
          return 96;
        }
        if (this.classList?.contains("expandable-post-text__measure")) {
          return (this.textContent?.length || 0) > 180 ? 240 : 96;
        }
        return 0;
      },
    });

    Object.defineProperty(HTMLElement.prototype, "clientWidth", {
      configurable: true,
      get() {
        return 320;
      },
    });

    Object.defineProperty(HTMLElement.prototype, "scrollWidth", {
      configurable: true,
      get() {
        return 320;
      },
    });
  });

  afterEach(() => {
    delete globalThis.IntersectionObserver;
    delete globalThis.ResizeObserver;
    delete HTMLElement.prototype.clientHeight;
    delete HTMLElement.prototype.scrollHeight;
    delete HTMLElement.prototype.clientWidth;
    delete HTMLElement.prototype.scrollWidth;
    vi.restoreAllMocks();
  });

  const renderPostCard = ({ post, extraRoutes = [], ...postProps }) =>
    render(
      <MemoryRouter initialEntries={["/home"]}>
        <Routes>
          <Route path="/home" element={<PostCard post={post} {...postProps} />} />
          {extraRoutes}
        </Routes>
      </MemoryRouter>
    );

  it("opens the Facebook-style comment popup when Comment is clicked", async () => {
    const user = userEvent.setup();

    renderPostCard({
      post: {
        _id: "post-1",
        text: "A post that needs comments.",
        createdAt: "2026-03-30T10:00:00.000Z",
        user: {
          name: "Admin User",
          username: "admin",
          profilePic: "",
        },
        comments: [],
        likesCount: 12,
        shareCount: 2,
        likedByViewer: false,
      },
    });

    const commentButton = screen.getByRole("button", { name: /comment/i });
    expect(commentButton).toHaveAttribute("aria-expanded", "false");

    await user.click(commentButton);

    expect(commentButton).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("dialog", { name: /comments/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/comment as you/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/comment as you/i).tagName).toBe("TEXTAREA");
  });

  it("opens the author's profile when the name is clicked", async () => {
    const user = userEvent.setup();

    renderPostCard({
      post: {
        _id: "post-profile-link",
        text: "A post that links to the author profile.",
        createdAt: "2026-03-30T10:00:00.000Z",
        user: {
          name: "Admin User",
          username: "admin",
          profilePic: "",
        },
        comments: [],
        likesCount: 1,
        shareCount: 0,
        likedByViewer: false,
      },
      extraRoutes: [<Route key="profile" path="/profile/:username" element={<div>Profile destination</div>} />],
    });

    await user.click(screen.getByRole("link", { name: /open admin user's profile/i }));

    expect(await screen.findByText("Profile destination")).toBeInTheDocument();
  });

  it("does not show the recommendation reason chip in the feed header", () => {
    renderPostCard({
      post: {
        _id: "post-2",
        text: "A recommended post in the feed.",
        createdAt: "2026-03-30T10:00:00.000Z",
        user: {
          name: "Admin User",
          username: "admin",
          profilePic: "",
        },
        comments: [],
        likesCount: 4,
        shareCount: 0,
        likedByViewer: false,
      },
      discoveryMeta: {
        requestId: "req-1",
        entityId: "post-2",
        entityType: "post",
        reason: "friend_connection",
        reasonLabel: "From someone you know",
        authorUserId: "user-1",
      },
    });

    expect(screen.queryByText(/from someone you know/i)).not.toBeInTheDocument();
    expect(screen.getByText(/@admin/i)).toBeInTheDocument();
  });

  it("renders the full post text without a More toggle", () => {
    const longPostText = Array.from(
      { length: 12 },
      (_, index) => `Paragraph ${index + 1} with enough text to force an expanded preview.`
    ).join("\n");

    renderPostCard({
      post: {
        _id: "post-3",
        text: longPostText,
        createdAt: "2026-03-30T10:00:00.000Z",
        user: {
          name: "Admin User",
          username: "admin",
          profilePic: "",
        },
        comments: [],
        likesCount: 3,
        shareCount: 0,
        likedByViewer: false,
      },
    });

    expect(
      screen.getByText(/Paragraph 1 with enough text to force an expanded preview\./i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Paragraph 12 with enough text to force an expanded preview\./i)
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^More$/i })).not.toBeInTheDocument();
  });

  it("renders shared post preview text in full without a More toggle", () => {
    const sharedPostText = Array.from(
      { length: 10 },
      (_, index) => `Shared paragraph ${index + 1} that should stay fully visible in the feed.`
    ).join("\n");

    renderPostCard({
      post: {
        _id: "post-5",
        text: "",
        createdAt: "2026-03-30T10:00:00.000Z",
        user: {
          name: "Admin User",
          username: "admin",
          profilePic: "",
        },
        sharedPost: {
          originalAuthorName: "Original Creator",
          originalAuthorUsername: "origcreator",
          originalText: sharedPostText,
          previewMediaType: "text",
          previewImage: "",
        },
        comments: [],
        likesCount: 6,
        shareCount: 1,
        likedByViewer: false,
      },
    });

    expect(
      screen.getByText(/Shared paragraph 1 that should stay fully visible in the feed\./i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Shared paragraph 10 that should stay fully visible in the feed\./i)
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^More$/i })).not.toBeInTheDocument();
  });

  it("collapses long post text after 200 words and expands on More", async () => {
    const user = userEvent.setup();
    const longWordPostText = Array.from(
      { length: 220 },
      (_, index) => `Word${index + 1}`
    ).join(" ");

    renderPostCard({
      post: {
        _id: "post-6",
        text: longWordPostText,
        createdAt: "2026-03-30T10:00:00.000Z",
        user: {
          name: "Admin User",
          username: "admin",
          profilePic: "",
        },
        comments: [],
        likesCount: 2,
        shareCount: 0,
        likedByViewer: false,
      },
    });

    const moreButton = screen
      .getAllByRole("button", { name: /^More$/i })
      .find((button) => button.hasAttribute("aria-controls"));

    expect(moreButton).toBeDefined();
    expect(screen.queryByText(/Word220/i)).not.toBeInTheDocument();

    await user.click(moreButton);

    expect(await screen.findByText(/Word220/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Less$/i })).toBeInTheDocument();
  });

  it("keeps short post text expanded by default without rendering a text toggle", () => {
    renderPostCard({
      post: {
        _id: "post-4",
        text: "Short post copy.",
        createdAt: "2026-03-30T10:00:00.000Z",
        user: {
          name: "Admin User",
          username: "admin",
          profilePic: "",
        },
        comments: [],
        likesCount: 1,
        shareCount: 0,
        likedByViewer: false,
      },
    });

    const textToggle = screen
      .queryAllByRole("button", { name: /^More$/i })
      .find((button) => button.hasAttribute("aria-controls"));

    expect(textToggle).toBeUndefined();
  });

  it("attaches the caption shell directly to inline media posts", () => {
    const { container } = renderPostCard({
      post: {
        _id: "post-7",
        text: "Caption that should meet the photo cleanly.",
        image: "/uploads/post-7.jpg",
        createdAt: "2026-03-30T10:00:00.000Z",
        user: {
          name: "Admin User",
          username: "admin",
          profilePic: "",
        },
        comments: [],
        likesCount: 1,
        shareCount: 0,
        likedByViewer: false,
      },
    });

    expect(container.querySelector(".post-text-block")).toHaveClass(
      "post-text-block--attached-media"
    );
    expect(container.querySelector(".post-media")).toHaveClass(
      "post-media--attached-caption"
    );
  });
});
