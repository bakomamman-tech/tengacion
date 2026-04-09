import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
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

  it("opens the Facebook-style comment popup when Comment is clicked", async () => {
    const user = userEvent.setup();

    render(
      <PostCard
        post={{
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
        }}
      />
    );

    const commentButton = screen.getByRole("button", { name: /comment/i });
    expect(commentButton).toHaveAttribute("aria-expanded", "false");

    await user.click(commentButton);

    expect(commentButton).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("dialog", { name: /comments/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/comment as you/i)).toBeInTheDocument();
  });

  it("does not show the recommendation reason chip in the feed header", () => {
    render(
      <PostCard
        post={{
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
        }}
        discoveryMeta={{
          requestId: "req-1",
          entityId: "post-2",
          entityType: "post",
          reason: "friend_connection",
          reasonLabel: "From someone you know",
          authorUserId: "user-1",
        }}
      />
    );

    expect(screen.queryByText(/from someone you know/i)).not.toBeInTheDocument();
    expect(screen.getByText(/@admin/i)).toBeInTheDocument();
  });

  it("shows a text More toggle only when post text overflows and swaps to Less after expanding", async () => {
    const user = userEvent.setup();
    const longPostText = Array.from({ length: 12 }, (_, index) => `Paragraph ${index + 1} with enough text to force an expanded preview.`).join("\n");

    render(
      <PostCard
        post={{
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
        }}
      />
    );

    let textToggle;
    await waitFor(() => {
      textToggle = screen
        .queryAllByRole("button", { name: /^More$/i })
        .find((button) => button.hasAttribute("aria-controls"));

      expect(textToggle).toBeDefined();
    });

    expect(textToggle).toHaveAttribute("aria-expanded", "false");

    await user.click(textToggle);

    expect(screen.getByRole("button", { name: /^Less$/i })).toHaveAttribute("aria-expanded", "true");
  });

  it("keeps short post text expanded by default without rendering a text toggle", () => {
    render(
      <PostCard
        post={{
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
        }}
      />
    );

    const textToggle = screen
      .queryAllByRole("button", { name: /^More$/i })
      .find((button) => button.hasAttribute("aria-controls"));

    expect(textToggle).toBeUndefined();
  });
});
