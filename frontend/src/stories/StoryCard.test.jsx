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

  it("shows attached music with an accessible full title and creator", () => {
    render(
      <StoryCard
        story={{
          _id: "story-3",
          username: "Friend Three",
          mediaType: "image",
          mediaUrl: "/story-three.jpg",
          musicAttachment: {
            title: "Mama",
            creatorName: "Tengacion Artist",
            previewUrl: "/mama-preview.mp3",
          },
        }}
      />
    );

    const storyButton = screen.getByRole("button", {
      name: "View Friend Three story with music Mama by Tengacion Artist",
    });
    const music = storyButton.querySelector(".story-card__music");
    expect(music).toHaveClass("story-card__music");
    expect(music).toHaveAttribute("aria-hidden", "true");
    expect(music).toHaveAttribute("title", "Mama - Tengacion Artist");
    expect(music.querySelector(".story-card__music-title")).toHaveTextContent("Mama");
  });
});
