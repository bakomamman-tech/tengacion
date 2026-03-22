import React from "react";
import { MemoryRouter } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import CreatorFanPageWorkspacePreview from "../CreatorFanPageWorkspacePreview";

describe("CreatorFanPageWorkspacePreview", () => {
  it("renders a playable audio dock for uploaded music", () => {
    render(
      <MemoryRouter>
        <CreatorFanPageWorkspacePreview
          creatorProfile={{
            _id: "creator-1",
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
                    _id: "track-1",
                    title: "Golden Echoes",
                    artistName: "Creator Example",
                    price: 500,
                    audioUrl: "https://cdn.example.com/golden-echoes.mp3",
                    previewUrl: "https://cdn.example.com/golden-echoes-preview.mp3",
                    durationSec: 185,
                    publishedStatus: "published",
                  },
                ],
                videos: [{ title: "Golden Echoes Live" }],
              },
              books: {
                items: [{ title: "The Quiet Fire", authorName: "Creator Example", price: 2500 }],
              },
              podcasts: {
                episodes: [{ title: "The Process", podcastSeries: "Creator Sessions" }],
              },
            },
          }}
          currentCategoryKey="music"
        />
      </MemoryRouter>
    );

    expect(
      screen.getByRole("button", { name: /play golden echoes/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("slider", { name: /seek within golden echoes/i })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /full track/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /preview sample/i })).toBeInTheDocument();
  }, 10000);
});
