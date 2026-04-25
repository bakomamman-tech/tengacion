import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  createPostMock,
  createPostWithUploadProgressMock,
  getUsersMock,
} = vi.hoisted(() => ({
  createPostMock: vi.fn(),
  createPostWithUploadProgressMock: vi.fn(),
  getUsersMock: vi.fn().mockResolvedValue([]),
}));

vi.mock("../../components/PostSkeleton", () => ({
  default: () => null,
}));

vi.mock("../../components/PostCard", () => ({
  default: () => null,
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
  createPost: createPostMock,
  createPostWithUploadProgress: createPostWithUploadProgressMock,
  getFeed: vi.fn(),
  getProfile: vi.fn(),
  getUsers: getUsersMock,
  muteUser: vi.fn(),
  resolveImage: (value) => value,
  toggleFollowCreator: vi.fn(),
  trackDiscoveryEvents: vi.fn(),
}));

import { PostComposerModal } from "../Home";

const buildImageFile = (name) =>
  new File([`image:${name}`], name, { type: "image/png" });

const buildVideoFile = (name) =>
  new File([`video:${name}`], name, { type: "video/mp4" });

const renderComposer = (props = {}) =>
  render(
    <PostComposerModal
      user={{ username: "tester", avatar: "" }}
      onClose={vi.fn()}
      onPosted={vi.fn()}
      {...props}
    />
  );

describe("PostComposerModal", () => {
  let objectUrlCounter = 0;

  beforeEach(() => {
    objectUrlCounter = 0;
    createPostMock.mockReset();
    createPostWithUploadProgressMock.mockReset();
    getUsersMock.mockClear();

    globalThis.URL.createObjectURL = vi.fn(
      () => `blob:composer-preview-${++objectUrlCounter}`
    );
    globalThis.URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders multiple selected previews with the media counter", async () => {
    const user = userEvent.setup();
    const { container } = renderComposer();
    const input = container.querySelector('input[type="file"]');

    expect(input).toBeTruthy();

    await user.upload(input, [
      buildImageFile("photo-one.png"),
      buildVideoFile("clip-one.mp4"),
    ]);

    expect(await screen.findByText("2/10 selected")).toBeInTheDocument();
    expect(screen.getByText("photo-one.png")).toBeInTheDocument();
    expect(screen.getByText("clip-one.mp4")).toBeInTheDocument();
    expect(container.querySelectorAll(".composer-preview-item")).toHaveLength(2);
  });

  it("removes a selected preview from the outgoing upload payload", async () => {
    const user = userEvent.setup();
    const onPosted = vi.fn();
    createPostWithUploadProgressMock.mockResolvedValue({
      _id: "post-1",
      text: "Hello world",
    });

    const { container } = renderComposer({ onPosted });
    const input = container.querySelector('input[type="file"]');

    await user.upload(input, [
      buildImageFile("keep-me.png"),
      buildImageFile("remove-me.png"),
    ]);

    const removeButtons = await screen.findAllByRole("button", { name: /remove/i });
    await user.click(removeButtons[1]);
    await user.click(screen.getByRole("button", { name: /^post$/i }));

    await waitFor(() => {
      expect(createPostWithUploadProgressMock).toHaveBeenCalledTimes(1);
    });

    const payload = createPostWithUploadProgressMock.mock.calls[0][0];
    expect(payload.files).toHaveLength(1);
    expect(payload.files[0].name).toBe("keep-me.png");
    expect(onPosted).toHaveBeenCalledWith(
      expect.objectContaining({ _id: "post-1" })
    );
  });

  it("shows an inline error when selection would exceed 10 files", async () => {
    const user = userEvent.setup();
    const { container } = renderComposer();
    const input = container.querySelector('input[type="file"]');
    const firstTenFiles = Array.from({ length: 10 }, (_, index) =>
      buildImageFile(`photo-${index + 1}.png`)
    );

    await user.upload(input, firstTenFiles);
    expect(await screen.findByText("10/10 selected")).toBeInTheDocument();

    await user.upload(input, buildImageFile("overflow.png"));

    expect(
      await screen.findByText(/attach up to 10 photos or videos/i)
    ).toBeInTheDocument();
    expect(screen.getByText("10/10 selected")).toBeInTheDocument();
  });

  it("disables the Post button while media submission is in progress", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    let resolveUpload;
    createPostWithUploadProgressMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveUpload = resolve;
        })
    );

    const { container } = renderComposer({ onClose });
    const input = container.querySelector('input[type="file"]');

    await user.upload(input, buildImageFile("pending.png"));

    const submitButton = screen.getByRole("button", { name: /^post$/i });
    await user.click(submitButton);

    expect(createPostWithUploadProgressMock).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: /posting/i })).toBeDisabled();

    resolveUpload({ _id: "post-2", text: "" });

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});
