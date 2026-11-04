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

  it("removes a broken image cover while keeping the story accessible", () => {
    render(
      <StoryCard
        story={{
          _id: "broken-image-story",
          username: "Friend Four",
          avatar: "/friend-avatar.jpg",
          mediaType: "image",
          mediaUrl: "/missing-cover.jpg",
        }}
      />
    );

    const trigger = screen.getByRole("button", { name: "View Friend Four story" });
    const cover = trigger.querySelector("img[src='/missing-cover.jpg']");
    expect(cover).toBeInTheDocument();

    fireEvent.error(cover);
    expect(trigger.querySelector("img[src='/missing-cover.jpg']")).not.toBeInTheDocument();
    expect(trigger.querySelector("img[src='/friend-avatar.jpg']")).toBeInTheDocument();
    expect(trigger).toHaveTextContent("Friend Four");

    fireEvent.click(trigger);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("hides failed video covers but can render a different cover later", () => {
    const oldStory = {
      _id: "broken-video-story",
      username: "Friend Five",
      mediaType: "video",
      mediaUrl: "/missing-video.mp4",
    };
    const { rerender } = render(<StoryCard story={oldStory} videoPreload="none" />);
    const trigger = screen.getByRole("button", { name: "View Friend Five story" });
    const video = trigger.querySelector("video");
    expect(video).toBeInTheDocument();

    fireEvent.error(video);
    expect(trigger.querySelector("video")).not.toBeInTheDocument();

    rerender(
      <StoryCard
        story={{ ...oldStory, mediaUrl: "/updated-video.mp4", thumbnailUrl: "/updated-cover.jpg" }}
      />
    );
    expect(trigger.querySelector("img[src='/updated-cover.jpg']")).toBeInTheDocument();
  });
});
