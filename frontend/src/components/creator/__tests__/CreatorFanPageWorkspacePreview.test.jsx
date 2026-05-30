import React from "react";
import { MemoryRouter } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import CreatorFanPageWorkspacePreview from "../CreatorFanPageWorkspacePreview";

const musicCreatorProfile = {
  _id: "creator-1",
  displayName: "Creator Example",
  creatorTypes: ["music", "bookPublishing", "podcast"],
  user: {
    followersCount: 2048,
  },
};

const musicDashboard = {
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
};

const bookDashboard = {
  categories: {
    bookPublishing: { uploads: 1 },
  },
  content: {
    books: {
      items: [
        {
          _id: "book-1",
          title: "The Rustle of Death",
          authorName: "Stephen Daniel Kurah",
          genre: "African Prose Fiction",
          pageCount: 170,
          price: 2000,
          publishedStatus: "published",
          description: "A haunting African prose fiction release for readers.",
          coverImageUrl: "https://cdn.example.com/rustle-of-death.jpg",
        },
      ],
    },
  },
};

const bookCreatorProfile = {
  _id: "creator-1",
  displayName: "Pyrexx_Singz",
  creatorTypes: ["bookPublishing"],
  user: {
    _id: "creator-user-1",
    followersCount: 24,
  },
};

describe("CreatorFanPageWorkspacePreview", () => {
  it("renders a playable audio dock for uploaded music", () => {
    render(
      <MemoryRouter>
        <CreatorFanPageWorkspacePreview
          creatorProfile={musicCreatorProfile}
          dashboard={musicDashboard}
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

  it("renders books as a reader panel instead of an audio player", () => {
    render(
      <MemoryRouter>
        <CreatorFanPageWorkspacePreview
          creatorProfile={bookCreatorProfile}
          dashboard={bookDashboard}
          currentCategoryKey="bookPublishing"
        />
      </MemoryRouter>
    );

    expect(screen.getByLabelText(/book reader preview/i)).toBeInTheDocument();
    expect(screen.getAllByText(/the rustle of death/i).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /read preview/i }).length).toBeGreaterThan(1);
    expect(screen.getAllByRole("button", { name: /open book/i }).length).toBeGreaterThan(1);
    expect(screen.getByRole("button", { name: /selected the rustle of death/i })).toBeInTheDocument();
    expect(screen.queryByRole("slider", { name: /seek within/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /play the rustle of death/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/books open in reader mode/i)).not.toBeInTheDocument();
  });
});
