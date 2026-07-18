import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import InFeedReelsCarousel from "../InFeedReelsCarousel";

vi.mock("../../../api", () => ({
  resolveImage: (value) => {
    if (!value) {
      return "";
    }
    if (typeof value === "string") {
      return value;
    }
    return (
      value.secureUrl ||
      value.secure_url ||
      value.url ||
      value.playbackUrl ||
      value.mediaUrl ||
      value.fileUrl ||
      value.legacyPath ||
      ""
    );
  },
}));

const reels = [
  {
    _id: "reel-1",
    type: "reel",
    text: "First reel",
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
    text: "Second reel",
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
];

const renderCarousel = (carouselReels = reels) =>
  render(
    <MemoryRouter>
      <InFeedReelsCarousel reels={carouselReels} />
    </MemoryRouter>
  );

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("InFeedReelsCarousel", () => {
  it("renders posted reels as links into the Tengacion reels viewer", () => {
    renderCarousel();

    expect(screen.getByRole("region", { name: "Tengacion reels" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /watch first reel by first creator/i })).toHaveAttribute(
      "href",
      "/reels?reel=reel-1"
    );
    expect(screen.getByRole("link", { name: /watch second reel by second creator/i })).toHaveAttribute(
      "href",
      "/reels?reel=reel-2"
    );
    expect(screen.getByRole("link", { name: "See all" })).toHaveAttribute("href", "/reels");
  });

  it("uses the controls at both ends to browse the horizontal reel track", async () => {
    renderCarousel();

    const track = screen.getByTestId("in-feed-reels-track");
    const scrollBy = vi.fn();
    let scrollLeft = 0;
    Object.defineProperties(track, {
      clientWidth: { configurable: true, get: () => 320 },
      scrollWidth: { configurable: true, get: () => 960 },
      scrollLeft: {
        configurable: true,
        get: () => scrollLeft,
        set: (value) => {
          scrollLeft = value;
        },
      },
      scrollBy: { configurable: true, value: scrollBy },
    });

    fireEvent(window, new Event("resize"));

    const previous = screen.getByRole("button", { name: "Show previous reels" });
    const next = screen.getByRole("button", { name: "Show next reels" });
    await waitFor(() => {
      expect(previous).toBeDisabled();
      expect(next).toBeEnabled();
    });

    fireEvent.click(next);
    expect(scrollBy).toHaveBeenLastCalledWith({ left: 260, behavior: "smooth" });

    scrollLeft = 640;
    fireEvent.scroll(track);
    await waitFor(() => {
      expect(previous).toBeEnabled();
      expect(next).toBeDisabled();
    });

    fireEvent.click(previous);
    expect(scrollBy).toHaveBeenLastCalledWith({ left: -260, behavior: "smooth" });
  });

  it("renders a video frame when the live API has no thumbnail and aliases the MP4 as image", () => {
    const videoUrl = "https://cdn.example.com/live-reel.mp4";
    const { container } = renderCarousel([
      {
        _id: "live-reel",
        type: "reel",
        text: "Live-shaped reel",
        image: videoUrl,
        media: [{ type: "video", url: videoUrl }],
        video: { playbackUrl: videoUrl, thumbnailUrl: "" },
        user: { name: "Live Creator", username: "live_creator" },
      },
    ]);

    const preview = container.querySelector(".in-feed-reel-preview");
    expect(preview?.tagName).toBe("VIDEO");
    expect(preview).toHaveAttribute("src", `${videoUrl}#t=0.1`);
    expect(container.querySelector(`img[src="${videoUrl}"]`)).not.toBeInTheDocument();

    const avatar = container.querySelector(".in-feed-reel-avatar");
    expect(avatar).toHaveAttribute("src", expect.stringMatching(/^data:image\/svg\+xml/));
  });

  it("recovers from a broken poster and avatar without leaving broken images", async () => {
    const { container } = renderCarousel([
      {
        _id: "broken-assets-reel",
        type: "reel",
        text: "Broken assets reel",
        video: {
          playbackUrl: "/uploads/broken-assets.mp4",
          thumbnailUrl: "/uploads/missing-poster.jpg",
        },
        user: {
          name: "Broken Assets Creator",
          username: "broken_assets",
          profilePic: "/uploads/missing-avatar.jpg",
        },
      },
    ]);

    fireEvent.error(container.querySelector(".in-feed-reel-preview"));
    await waitFor(() => {
      expect(container.querySelector("video.in-feed-reel-preview")).toHaveAttribute(
        "src",
        "/uploads/broken-assets.mp4#t=0.1"
      );
    });

    fireEvent.error(container.querySelector("video.in-feed-reel-preview"));
    await waitFor(() => {
      expect(container.querySelector("video.in-feed-reel-preview")).not.toBeInTheDocument();
      expect(container.querySelector(".in-feed-reel-preview-fallback")).toBeInTheDocument();
    });

    fireEvent.error(container.querySelector(".in-feed-reel-avatar"));
    await waitFor(() => {
      expect(container.querySelector(".in-feed-reel-avatar")).toHaveAttribute(
        "src",
        expect.stringMatching(/^data:image\/svg\+xml/)
      );
    });
  });

  it("waits until a posterless card is near the viewport before loading video metadata", async () => {
    let observerCallback;
    const observe = vi.fn();
    const disconnect = vi.fn();
    vi.stubGlobal(
      "IntersectionObserver",
      class MockIntersectionObserver {
        constructor(callback) {
          observerCallback = callback;
        }

        observe(node) {
          observe(node);
        }

        disconnect() {
          disconnect();
        }
      }
    );

    const { container } = renderCarousel([
      {
        _id: "lazy-preview-reel",
        type: "reel",
        text: "Lazy preview reel",
        video: { playbackUrl: "/uploads/lazy-preview.mp4", thumbnailUrl: "" },
        user: { name: "Lazy Preview Creator" },
      },
    ]);

    expect(observe).toHaveBeenCalledWith(
      container.querySelector(".in-feed-reel-preview-fallback")
    );
    expect(container.querySelector("video.in-feed-reel-preview")).not.toBeInTheDocument();

    act(() => {
      observerCallback([{ isIntersecting: true, intersectionRatio: 1 }]);
    });

    await waitFor(() => {
      expect(container.querySelector("video.in-feed-reel-preview")).toHaveAttribute(
        "src",
        "/uploads/lazy-preview.mp4#t=0.1"
      );
    });
    expect(disconnect).toHaveBeenCalled();
  });
});
