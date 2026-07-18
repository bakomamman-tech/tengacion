import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import StoriesBar from "./StoriesBar";

const apiMocks = vi.hoisted(() => ({
  getStories: vi.fn(),
}));

vi.mock("../api", () => ({
  getStories: apiMocks.getStories,
}));

vi.mock("./CreateStory", () => ({
  default: ({ onCreated }) => (
    <button type="button" onClick={onCreated}>
      Create story
    </button>
  ),
}));

vi.mock("./StoryCard", () => ({
  default: ({ story, onSeen }) => (
    <button type="button" onClick={() => onSeen?.([story._id])}>
      {story.username}
    </button>
  ),
}));

describe("StoriesBar", () => {
  beforeEach(() => {
    apiMocks.getStories.mockReset();
  });

  it("uses controlled stories without fetching or starting its own refresh", async () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined);
    const onStoriesSeen = vi.fn();

    render(
      <StoriesBar
        user={{ _id: "viewer-1" }}
        stories={[
          {
            _id: "story-1",
            userId: "friend-1",
            username: "Friend One",
            time: "2026-07-18T12:00:00.000Z",
            viewerSeen: false,
          },
        ]}
        loading={false}
        onRefresh={onRefresh}
        onStoriesSeen={onStoriesSeen}
      />
    );

    expect(apiMocks.getStories).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Friend One" }));
    expect(onStoriesSeen).toHaveBeenCalledWith(["story-1"]);

    fireEvent.click(screen.getByRole("button", { name: "Create story" }));
    await waitFor(() => expect(onRefresh).toHaveBeenCalledTimes(1));
    expect(apiMocks.getStories).not.toHaveBeenCalled();
  });

  it("retains standalone loading for callers that do not supply stories", async () => {
    apiMocks.getStories.mockResolvedValue([
      {
        _id: "story-2",
        userId: "friend-2",
        username: "Friend Two",
        time: "2026-07-18T12:00:00.000Z",
      },
    ]);

    render(<StoriesBar user={{ _id: "viewer-1" }} />);

    expect(await screen.findByRole("button", { name: "Friend Two" })).toBeInTheDocument();
    expect(apiMocks.getStories).toHaveBeenCalledTimes(1);
  });
});

