import React from "react";
import { MemoryRouter } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import CreatorFanPagePreview from "../CreatorFanPagePreview";

describe("CreatorFanPagePreview", () => {
  beforeEach(() => {
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the fan-facing preview sections and actions", () => {
    render(
      <MemoryRouter>
        <CreatorFanPagePreview
          creatorProfile={{
            _id: "507f1f77bcf86cd799439011",
            displayName: "Creator Example",
            creatorTypes: ["music", "bookPublishing", "podcast"],
            links: [
              {
                label: "spotify",
                url: "https://open.spotify.com/artist/creator-example",
              },
              {
                label: "youtube",
                url: "https://www.youtube.com/@creator-example",
              },
            ],
            user: {
              followersCount: 2048,
            },
          }}
          dashboard={{
            categories: {
              music: { uploads: 3 },
              bookPublishing: { uploads: 2 },
              podcast: { uploads: 1 },
            },
            content: {
              music: {
                tracks: [
                  {
                    title: "Golden Echoes",
                    artistName: "Creator Example",
                    price: 500,
                    audioUrl: "https://cdn.example.com/golden-echoes.mp3",
                    previewUrl: "https://cdn.example.com/golden-echoes-preview.mp3",
                    durationSec: 185,
                    publishedStatus: "published",
                  },
                ],
                videos: [
                  {
                    _id: "video-1",
                    title: "Golden Echoes Live",
                    description: "A cinematic live performance film.",
                    coverImageUrl: "https://cdn.example.com/golden-echoes-live.jpg",
                    videoUrl: "https://cdn.example.com/golden-echoes-live.mp4",
                    previewClipUrl: "https://cdn.example.com/golden-echoes-live-preview.mp4",
                    durationSec: 214,
                    publishedStatus: "published",
                  },
                ],
              },
              books: {
                items: [{ title: "The Quiet Fire", authorName: "Creator Example", price: 2500 }],
              },
              podcasts: {
                episodes: [{ title: "The Process", podcastSeries: "Creator Sessions" }],
              },
            },
          }}
        />
      </MemoryRouter>
    );

    expect(screen.getByLabelText(/fan page view/i)).toBeInTheDocument();
    expect(screen.getAllByText(/creator example/i).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /follow/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /donate/i }).length).toBeGreaterThan(0);
    expect(screen.getByText(/unlock exclusive content/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /stream on spotify/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /stream on youtube/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /subscribe for .*2,000\/month/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/popular releases/i)).toBeInTheDocument();
    expect(screen.getByText(/featured episode/i)).toBeInTheDocument();
    expect(screen.getByText(/featured visual/i)).toBeInTheDocument();
    expect(screen.getByText(/books by creator example/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /play golden echoes/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("slider", { name: /seek within golden echoes/i })
    ).toBeInTheDocument();
  }, 10000);

  it("opens a dedicated functional video player from the videos tab", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <CreatorFanPagePreview
          creatorProfile={{
            _id: "507f1f77bcf86cd799439011",
            displayName: "Creator Example",
            creatorTypes: ["music", "bookPublishing", "podcast"],
            user: {
              followersCount: 2048,
            },
          }}
          dashboard={{
            categories: {
              music: { uploads: 3 },
              bookPublishing: { uploads: 2 },
              podcast: { uploads: 1 },
            },
            content: {
              music: {
                tracks: [
                  {
                    title: "Golden Echoes",
                    artistName: "Creator Example",
                    price: 500,
                    audioUrl: "https://cdn.example.com/golden-echoes.mp3",
                    previewUrl: "https://cdn.example.com/golden-echoes-preview.mp3",
                    durationSec: 185,
                    publishedStatus: "published",
                  },
                ],
                videos: [
                  {
                    _id: "video-1",
                    title: "Golden Echoes Live",
                    description: "A cinematic live performance film.",
                    coverImageUrl: "https://cdn.example.com/golden-echoes-live.jpg",
                    videoUrl: "https://cdn.example.com/golden-echoes-live.mp4",
                    previewClipUrl: "https://cdn.example.com/golden-echoes-live-preview.mp4",
                    durationSec: 214,
                    publishedStatus: "published",
                  },
                  {
                    _id: "video-2",
                    title: "Golden Echoes Rooftop",
                    description: "A stripped-down rooftop session.",
                    coverImageUrl: "https://cdn.example.com/golden-echoes-rooftop.jpg",
                    videoUrl: "https://cdn.example.com/golden-echoes-rooftop.mp4",
                    durationSec: 198,
                    publishedStatus: "draft",
                  },
                ],
              },
              books: {
                items: [{ title: "The Quiet Fire", authorName: "Creator Example", price: 2500 }],
              },
              podcasts: {
                episodes: [{ title: "The Process", podcastSeries: "Creator Sessions" }],
              },
            },
          }}
        />
      </MemoryRouter>
    );

    await user.click(screen.getByRole("tab", { name: /videos/i }));

    expect(screen.getByRole("heading", { name: /video library/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /select golden echoes rooftop/i }));

    expect(screen.getByLabelText(/video preview player/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /play golden echoes rooftop/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("slider", { name: /seek within golden echoes rooftop/i })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /fullscreen/i })).toBeInTheDocument();
  }, 10000);
});
