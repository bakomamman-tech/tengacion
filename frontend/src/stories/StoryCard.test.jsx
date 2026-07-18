import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import StoryCard from "./StoryCard";

vi.mock("../api", () => ({
  resolveImage: (value) => value,
}));

vi.mock("./StoryViewer", () => ({
  default: () => <div role="dialog">Story viewer</div>,
}));

describe("StoryCard", () => {
  it("uses a video's thumbnail and opens from the keyboard", () => {
    render(
      <StoryCard
        story={{
          _id: "story-1",
          username: "Friend One",
          mediaType: "video",
          mediaUrl: "/story.mp4",
          thumbnailUrl: "/story.jpg",
        }}
      />
    );

    const trigger = screen.getByRole("button", { name: "View Friend One story" });
    expect(trigger.querySelector("video")).not.toBeInTheDocument();
    expect(trigger.querySelector("img[src='/story.jpg']")).toBeInTheDocument();

    fireEvent.keyDown(trigger, { key: "Enter" });
    expect(screen.getByRole("dialog", { name: "" })).toBeInTheDocument();
  });

  it("can avoid preloading repeated in-feed video stories", () => {
    render(
      <StoryCard
        story={{
          _id: "story-2",
          username: "Friend Two",
          mediaType: "video",
          mediaUrl: "/story-two.mp4",
        }}
        videoPreload="none"
      />
    );

    expect(screen.getByRole("button", { name: "View Friend Two story" }).querySelector("video"))
      .toHaveAttribute("preload", "none");
  });
});
