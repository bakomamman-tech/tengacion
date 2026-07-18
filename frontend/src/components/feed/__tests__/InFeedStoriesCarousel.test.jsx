import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import InFeedStoriesCarousel from "../InFeedStoriesCarousel";

vi.mock("../../../stories/StoryCard", () => ({
  default: ({ story, onSeen, videoPreload }) => (
    <button
      type="button"
      data-video-preload={videoPreload}
      onClick={() => onSeen?.([story._id])}
    >
      {story.username}
    </button>
  ),
}));

const makeGroups = (count) =>
  Array.from({ length: count }, (_, index) => ({
    ownerId: `owner-${index}`,
    latestStory: { _id: `story-${index}`, username: `Owner ${index}` },
    stories: [{ _id: `story-${index}`, username: `Owner ${index}` }],
    hasUnseen: index % 2 === 0,
    isOwner: false,
  }));

describe("InFeedStoriesCarousel", () => {
  it("renders nothing without story groups", () => {
    const { container } = render(<InFeedStoriesCarousel groups={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("rotates a maximum of 12 owners per feed block and forwards seen events", () => {
    const onSeen = vi.fn();
    render(<InFeedStoriesCarousel groups={makeGroups(25)} blockIndex={1} onSeen={onSeen} />);

    expect(screen.getByRole("region", { name: "Stories" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Stories" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Owner \d+/ })).toHaveLength(12);
    expect(screen.getByRole("button", { name: "Owner 12" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Owner 23" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Owner 0" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Owner 12" })).toHaveAttribute(
      "data-video-preload",
      "none"
    );

    fireEvent.click(screen.getByRole("button", { name: "Owner 12" }));
    expect(onSeen).toHaveBeenCalledWith(["story-12"]);
  });

  it("keeps controls at both ends and supports button and keyboard scrolling", async () => {
    render(<InFeedStoriesCarousel groups={makeGroups(3)} />);

    const track = screen.getByTestId("in-feed-stories-track");
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

    const previous = screen.getByRole("button", { name: "Show previous stories" });
    const next = screen.getByRole("button", { name: "Show next stories" });
    await waitFor(() => {
      expect(previous).toBeDisabled();
      expect(next).toBeEnabled();
    });

    fireEvent.click(next);
    expect(scrollBy).toHaveBeenLastCalledWith({ left: 260, behavior: "smooth" });

    fireEvent.keyDown(track, { key: "ArrowRight" });
    expect(scrollBy).toHaveBeenCalledTimes(2);

    scrollLeft = 640;
    fireEvent.scroll(track);
    await waitFor(() => {
      expect(previous).toBeEnabled();
      expect(next).toBeDisabled();
    });
  });
});
