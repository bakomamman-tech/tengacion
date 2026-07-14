import React from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import PostCard from "../PostCard";

const apiRequestMock = vi.hoisted(() => vi.fn());

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
  apiRequest: apiRequestMock,
  createReport: vi.fn(),
  initPayment: vi.fn(),
  resolveImage: (value) => value,
}));

vi.mock("../share/postShareUtils", () => ({
  buildPostShareUrl: vi.fn(() => "https://tengacion.example/posts/post-1"),
  fallbackAvatar: vi.fn(() => "/avatar.png"),
  truncateText: (value) => value,
}));

describe("PostCard reactions", () => {
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
    globalThis.URL.createObjectURL = vi.fn(() => "blob:post-edit-preview");
    globalThis.URL.revokeObjectURL = vi.fn();
    apiRequestMock.mockReset();
  });

  afterEach(() => {
    delete globalThis.IntersectionObserver;
    delete globalThis.ResizeObserver;
    vi.restoreAllMocks();
  });

  const renderPostCard = (post, props = {}) =>
    render(
      <MemoryRouter initialEntries={["/home"]}>
        <Routes>
          <Route path="/home" element={<PostCard post={post} {...props} />} />
        </Routes>
      </MemoryRouter>
    );

  it("shows the persisted reaction and updates it when a new emoji is chosen", async () => {
    apiRequestMock.mockResolvedValueOnce({
      success: true,
      liked: true,
      likedByViewer: true,
      likesCount: 5,
      viewerReaction: "angry",
    });

    const user = userEvent.setup();

    renderPostCard({
      _id: "post-1",
      text: "A post with reactions.",
      createdAt: "2026-03-30T10:00:00.000Z",
      user: {
        name: "Admin User",
        username: "admin",
        profilePic: "",
      },
      comments: [],
      likesCount: 4,
      shareCount: 0,
      likedByViewer: true,
      viewerReaction: "love",
    });

    const likeButton = screen.getByRole("button", { name: /love/i });
    expect(likeButton).toHaveAttribute("aria-pressed", "true");

    await user.hover(likeButton);

    const angryButton = await screen.findByRole("button", { name: /^Angry$/i });
    await user.click(angryButton);

    await waitFor(() => expect(apiRequestMock).toHaveBeenCalledTimes(1));
    expect(apiRequestMock).toHaveBeenCalledWith(
      "/api/posts/post-1/like",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ reactionKey: "angry" }),
      })
    );

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /angry/i })).toHaveAttribute(
        "aria-pressed",
        "true"
      )
    );
  });

  it("submits replacement pictures from the edit post modal", async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    apiRequestMock.mockResolvedValueOnce({
      _id: "post-1",
      text: "Updated caption",
      media: [{ url: "https://cdn.test/replacement.jpg", type: "image" }],
      image: "https://cdn.test/replacement.jpg",
      isOwner: true,
    });

    renderPostCard(
      {
        _id: "post-1",
        text: "Original caption",
        image: "https://cdn.test/original.jpg",
        createdAt: "2026-03-30T10:00:00.000Z",
        isOwner: true,
        user: {
          _id: "user-1",
          name: "Admin User",
          username: "admin",
          profilePic: "",
        },
        comments: [],
        likesCount: 0,
        shareCount: 0,
        likedByViewer: false,
      },
      { onEdit }
    );

    await user.click(screen.getByTitle("More"));
    await user.click(screen.getByRole("button", { name: /^Edit post$/i }));

    const textarea = screen.getByRole("textbox");
    await user.clear(textarea);
    await user.type(textarea, "Updated caption");

    const replacement = new File(["replacement-image"], "replacement.png", {
      type: "image/png",
    });
    const fileInput = document.querySelector('input[type="file"]');
    await user.upload(fileInput, replacement);

    expect(screen.getByText(/replacement pictures/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => expect(apiRequestMock).toHaveBeenCalledTimes(1));
    expect(apiRequestMock).toHaveBeenCalledWith(
      "/api/posts/post-1",
      expect.objectContaining({
        method: "PUT",
        body: expect.any(FormData),
      })
    );

    const requestOptions = apiRequestMock.mock.calls[0][1];
    expect(requestOptions.body.get("text")).toBe("Updated caption");
    expect(requestOptions.body.getAll("media")).toHaveLength(1);
    expect(requestOptions.body.getAll("media")[0].name).toBe("replacement.png");
    await waitFor(() => expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({
      _id: "post-1",
      text: "Updated caption",
    })));
  });
});
