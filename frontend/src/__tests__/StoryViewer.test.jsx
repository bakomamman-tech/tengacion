import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import StoryViewer from "../stories/StoryViewer";

const markStorySeenMock = vi.hoisted(() => vi.fn());
const reactToStoryMock = vi.hoisted(() => vi.fn());
const replyToStoryMock = vi.hoisted(() => vi.fn());

vi.mock("../api", () => ({
  markStorySeen: markStorySeenMock,
  reactToStory: reactToStoryMock,
  replyToStory: replyToStoryMock,
  resolveImage: (value) => value || "",
}));

const story = {
  _id: "story-1",
  username: "madaki",
  time: "2026-05-10T09:00:00.000Z",
  image: "https://cdn.test/story.jpg",
  mediaType: "image",
};

describe("StoryViewer", () => {
  let playMock;

  beforeEach(() => {
    vi.useFakeTimers();
    playMock = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
    vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
    markStorySeenMock.mockResolvedValue({ seen: true });
    reactToStoryMock.mockResolvedValue({ success: true });
    replyToStoryMock.mockResolvedValue({ success: true });
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    markStorySeenMock.mockReset();
    reactToStoryMock.mockReset();
    replyToStoryMock.mockReset();
    vi.restoreAllMocks();
  });

  it("keeps the story open while a reply is being written", async () => {
    const onClose = vi.fn();
    render(<StoryViewer story={story} onClose={onClose} />);

    const input = screen.getByPlaceholderText(/reply to story/i);
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "Nice one" } });

    act(() => {
      vi.advanceTimersByTime(7000);
    });

    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /^reply$/i }));
    expect(replyToStoryMock).toHaveBeenCalledWith("story-1", "Nice one");

    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      vi.advanceTimersByTime(5200);
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("shows a reaction burst when a quick emoji is clicked", async () => {
    const { container } = render(<StoryViewer story={story} onClose={vi.fn()} />);

    await act(async () => {
      fireEvent.click(screen.getAllByRole("button", { name: /react with/i })[0]);
      await Promise.resolve();
    });

    expect(reactToStoryMock).toHaveBeenCalledWith("story-1", expect.any(String));
    expect(container.querySelector(".story-viewer-reaction-burst")).toBeInTheDocument();
  });

  it("automatically plays an attached creator soundtrack when the story opens", async () => {
    render(
      <StoryViewer
        story={{
          ...story,
          musicAttachment: {
            itemId: "track-mama",
            title: "Mama",
            creatorName: "Tengacion Artist",
            previewUrl: "https://cdn.test/mama-preview.mp3",
            previewLimitSec: 30,
          },
        }}
        onClose={vi.fn()}
      />
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(playMock).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: /pause/i })).toBeInTheDocument();
    expect(
      screen.getByRole("group", { name: "Music: Mama by Tengacion Artist" })
    ).toBeInTheDocument();
    expect(screen.getByText("Mama")).toHaveAttribute("title", "Mama");
    expect(screen.getByText(/Tengacion Artist - 30s preview/i)).toBeInTheDocument();
  });

  it("keeps the close control outside the scrollable story content", () => {
    const onClose = vi.fn();
    render(<StoryViewer story={story} onClose={onClose} />);

    const closeButton = screen.getByRole("button", { name: "Close story" });
    const scrollableBody = document.querySelector(".story-viewer-body");
    expect(closeButton).toHaveClass("story-viewer-close");
    expect(closeButton).toHaveAttribute("title", "Close story");
    expect(closeButton.querySelector(".story-viewer-close__icon")).toBeInTheDocument();
    expect(scrollableBody).not.toContainElement(closeButton);

    fireEvent.click(closeButton);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
