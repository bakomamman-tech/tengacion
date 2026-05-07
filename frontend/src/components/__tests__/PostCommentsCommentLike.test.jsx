import React from "react";
import { MemoryRouter } from "react-router-dom";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import PostComments from "../PostComments";

const apiMocks = vi.hoisted(() => ({
  createPostComment: vi.fn(),
  createReport: vi.fn(),
  getPostComments: vi.fn(),
  togglePostCommentLike: vi.fn(),
  updatePostComment: vi.fn(),
}));

const baseComment = {
  _id: "comment-1",
  author: {
    _id: "user-2",
    name: "Commenter User",
    username: "commenter_user",
    avatar: "",
  },
  text: "A helpful comment.",
  createdAt: "2026-04-10T10:00:00.000Z",
  updatedAt: "2026-04-10T10:00:00.000Z",
  parentCommentId: null,
  likes: [],
  likesCount: 0,
  likedByViewer: false,
  replies: [],
};

vi.mock("../../api", () => ({
  createPostComment: apiMocks.createPostComment,
  createReport: apiMocks.createReport,
  getPostComments: apiMocks.getPostComments,
  resolveImage: (value) => value,
  togglePostCommentLike: apiMocks.togglePostCommentLike,
  updatePostComment: apiMocks.updatePostComment,
}));

vi.mock("../../context/AuthContext", () => ({
  useAuth: () => ({
    user: {
      _id: "user-1",
      username: "owner_user",
      avatar: "",
    },
  }),
}));

vi.mock("../ui/useDialog", () => ({
  useDialog: () => ({
    prompt: vi.fn().mockResolvedValue("General"),
  }),
}));

describe("PostComments comment likes", () => {
  beforeEach(() => {
    Object.values(apiMocks).forEach((mock) => mock.mockReset());
    apiMocks.getPostComments.mockResolvedValue([baseComment]);
    apiMocks.togglePostCommentLike.mockResolvedValue({
      success: true,
      liked: true,
      likedByViewer: true,
      likesCount: 1,
      comment: {
        ...baseComment,
        likes: ["user-1"],
        likesCount: 1,
        likedByViewer: true,
      },
    });
  });

  it("toggles a comment like and shows the like count", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <PostComments
          postId="post-1"
          initialComments={[]}
          initialCount={1}
          panelId="comments-panel"
          postOwnerId="user-1"
          postOwnerName="Owner User"
          postOwnerUsername="owner_user"
        />
      </MemoryRouter>
    );

    const likeButton = await screen.findByRole("button", { name: /like comment/i });
    expect(likeButton).toHaveAttribute("aria-pressed", "false");

    await user.click(likeButton);

    await waitFor(() =>
      expect(apiMocks.togglePostCommentLike).toHaveBeenCalledWith("post-1", "comment-1")
    );
    expect(await screen.findByLabelText("1 like")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /unlike comment/i })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });
});
