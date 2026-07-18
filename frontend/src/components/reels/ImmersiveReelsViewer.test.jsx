import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ImmersiveReelsViewer from "./ImmersiveReelsViewer";

vi.mock("../../api", () => ({
  resolveImage: (value) => {
    if (!value) {
      return "";
    }
    if (typeof value === "string") {
      return value;
    }
    return value.secureUrl || value.url || value.playbackUrl || value.mediaUrl || "";
  },
}));

const reels = [
  {
    _id: "reel-1",
    type: "reel",
    text: "First reel",
    createdAt: "2026-07-18T12:00:00.000Z",
    video: {
      playbackUrl: "/uploads/reel-1.mp4",
      thumbnailUrl: "/uploads/reel-1.jpg",
    },
    user: {
      name: "First Creator",
      username: "first_creator",
      profilePic: "/uploads/first-creator.jpg",
    },
  },
  {
    _id: "reel-2",
    type: "reel",
    text: "A second reel with a caption",
    createdAt: "2026-07-18T13:00:00.000Z",
    likesCount: 12500,
    comments: [{ _id: "comment-1" }, { _id: "comment-2" }],
    likedByViewer: true,
    video: {
      playbackUrl: "/uploads/reel-2.mp4",
      thumbnailUrl: "/uploads/reel-2.jpg",
    },
    user: {
      name: "Second Creator",
      username: "second_creator",
      profilePic: "/uploads/second-creator.jpg",
    },
  },
  {
    _id: "reel-3",
    type: "reel",
    text: "Third reel",
    createdAt: "2026-07-18T14:00:00.000Z",
    video: {
      playbackUrl: "/uploads/reel-3.mp4",
      thumbnailUrl: "/uploads/reel-3.jpg",
    },
    user: {
      name: "Third Creator",
      username: "third_creator",
      profilePic: "/uploads/third-creator.jpg",
    },
  },
];

const createProps = (overrides = {}) => ({
  reels,
  activeReelId: "reel-2",
  onClose: vi.fn(),
  onSelectReel: vi.fn(),
  onToggleSound: vi.fn(),
  onLike: vi.fn(),
  onComment: vi.fn(),
  onShare: vi.fn(),
  onProfile: vi.fn(),
  ...overrides,
});

beforeEach(() => {
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
  document.body.style.overflow = "";
});

describe("ImmersiveReelsViewer", () => {
  it("renders the selected reel in a tall immersive video stage with its actions", () => {
    const { container, unmount } = render(<ImmersiveReelsViewer {...createProps()} />);

    expect(screen.getByRole("main", { name: "Immersive reel viewer" })).toBeInTheDocument();
    expect(
      screen.getByRole("region", {
        name: "Watching A second reel with a caption by Second Creator",
      })
    ).toBeInTheDocument();

    const video = container.querySelector("video.immersive-reels-video");
    expect(video).toHaveAttribute("src", "/uploads/reel-2.mp4");
    expect(video).toHaveAttribute("poster", "/uploads/reel-2.jpg");
    expect(video).toHaveAttribute("controls");
    expect(video).toHaveAttribute("playsinline");
    expect(container.querySelector(".immersive-reels-video-wrap")).toContainElement(video);

    expect(screen.getByRole("navigation", { name: "Reel actions" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Unlike reel" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByRole("button", { name: "View reel comments" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Share reel" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "View Second Creator's profile" })).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Reel queue progress" })).toHaveAttribute(
      "aria-valuenow",
      "2"
    );
    expect(document.body.style.overflow).toBe("hidden");

    unmount();
    expect(document.body.style.overflow).toBe("");
  });

  it("moves through the reel queue with the buttons and keyboard", () => {
    const onSelectReel = vi.fn();
    const { container } = render(
      <ImmersiveReelsViewer
        {...createProps({ onSelectReel })}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Previous reel" }));
    fireEvent.click(screen.getByRole("button", { name: "Next reel" }));
    expect(onSelectReel).toHaveBeenNthCalledWith(1, "reel-1");
    expect(onSelectReel).toHaveBeenNthCalledWith(2, "reel-3");

    onSelectReel.mockClear();
    fireEvent.keyDown(window, { key: "ArrowUp" });
    fireEvent.keyDown(window, { key: "ArrowDown" });
    expect(onSelectReel).toHaveBeenNthCalledWith(1, "reel-1");
    expect(onSelectReel).toHaveBeenNthCalledWith(2, "reel-3");

    fireEvent.keyDown(container.querySelector("video.immersive-reels-video"), {
      key: "ArrowDown",
    });
    expect(onSelectReel).toHaveBeenCalledTimes(2);
  });

  it("closes from both the visible close button and Escape", () => {
    const onClose = vi.fn();
    render(<ImmersiveReelsViewer {...createProps({ onClose })} />);

    fireEvent.click(screen.getByRole("button", { name: "Close reel viewer" }));
    fireEvent.keyDown(window, { key: "Escape" });

    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("wires sound, likes, comments, sharing, and profile controls to their callbacks", () => {
    const props = createProps();
    const { container, rerender } = render(<ImmersiveReelsViewer {...props} soundOn={false} />);
    const video = container.querySelector("video.immersive-reels-video");

    expect(video.muted).toBe(true);
    expect(screen.getByRole("button", { name: "Turn reel sound on" })).toHaveAttribute(
      "aria-pressed",
      "false"
    );

    fireEvent.click(screen.getByRole("button", { name: "Turn reel sound on" }));
    fireEvent.click(screen.getByRole("button", { name: "Unlike reel" }));
    fireEvent.click(screen.getByRole("button", { name: "View reel comments" }));
    fireEvent.click(screen.getByRole("button", { name: "Share reel" }));
    fireEvent.click(screen.getByRole("button", { name: "View Second Creator's profile" }));

    expect(props.onToggleSound).toHaveBeenCalledTimes(1);
    expect(props.onLike).toHaveBeenCalledWith("reel-2");
    expect(props.onComment).toHaveBeenCalledWith("reel-2");
    expect(props.onShare).toHaveBeenCalledWith("reel-2");
    expect(props.onProfile).toHaveBeenCalledWith("second_creator");

    rerender(<ImmersiveReelsViewer {...props} soundOn />);
    expect(screen.getByRole("button", { name: "Turn reel sound off" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(container.querySelector("video.immersive-reels-video").muted).toBe(false);
  });

  it("offers a visible retry when audible autoplay is blocked", async () => {
    HTMLMediaElement.prototype.play.mockRejectedValueOnce(new Error("Autoplay blocked"));
    const { container } = render(
      <ImmersiveReelsViewer {...createProps()} soundOn />
    );

    expect(await screen.findByRole("button", { name: "Play reel" })).toBeInTheDocument();
    HTMLMediaElement.prototype.play.mockResolvedValueOnce(undefined);
    fireEvent.click(screen.getByRole("button", { name: "Play reel" }));

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Play reel" })).not.toBeInTheDocument();
    });
    expect(container.querySelector("video.immersive-reels-video")).toBeInTheDocument();
  });

  it("removes broken controls and recovers when the same reel receives a corrected video URL", () => {
    const props = createProps();
    const { container, rerender } = render(<ImmersiveReelsViewer {...props} />);

    fireEvent.error(container.querySelector("video.immersive-reels-video"));
    expect(screen.getByText("Video unavailable")).toBeInTheDocument();
    expect(container.querySelector("video.immersive-reels-video")).not.toBeInTheDocument();

    const correctedReels = reels.map((reel) =>
      reel._id === "reel-2"
        ? {
            ...reel,
            video: {
              ...reel.video,
              playbackUrl: "/uploads/reel-2-corrected.mp4",
            },
          }
        : reel
    );
    rerender(<ImmersiveReelsViewer {...props} reels={correctedReels} />);

    expect(container.querySelector("video.immersive-reels-video")).toHaveAttribute(
      "src",
      "/uploads/reel-2-corrected.mp4"
    );
    expect(screen.queryByText("Video unavailable")).not.toBeInTheDocument();
  });
});
