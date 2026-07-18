import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import InFeedReelsCarousel from "../InFeedReelsCarousel";

vi.mock("../../../api", () => ({
  resolveImage: (value) => value,
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

const renderCarousel = () =>
  render(
    <MemoryRouter>
      <InFeedReelsCarousel reels={reels} />
    </MemoryRouter>
  );

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
});
