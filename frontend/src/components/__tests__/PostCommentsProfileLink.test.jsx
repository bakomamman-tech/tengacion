import React from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import PostComments from "../PostComments";

vi.mock("../../api", () => ({
  createPostComment: vi.fn(),
  createReport: vi.fn(),
  getPostComments: vi.fn().mockResolvedValue([
    {
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
      replies: [],
    },
  ]),
  resolveImage: (value) => value,
  updatePostComment: vi.fn(),
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

describe("PostComments profile links", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("opens the commenter profile when the name is clicked", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/home"]}>
        <Routes>
          <Route
            path="/home"
            element={
              <PostComments
                postId="post-1"
                initialComments={[]}
                initialCount={1}
                panelId="comments-panel"
                postOwnerId="user-1"
                postOwnerName="Owner User"
                postOwnerUsername="owner_user"
              />
            }
          />
          <Route path="/profile/:username" element={<div>Profile destination</div>} />
        </Routes>
      </MemoryRouter>
    );

    await user.click(
      await screen.findByRole("link", { name: /open commenter user's profile/i })
    );

    expect(await screen.findByText("Profile destination")).toBeInTheDocument();
  });
});
