import React from "react";
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

    globalThis.IntersectionObserver = MockIntersectionObserver;
  });

  afterEach(() => {
    delete globalThis.IntersectionObserver;
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
});
