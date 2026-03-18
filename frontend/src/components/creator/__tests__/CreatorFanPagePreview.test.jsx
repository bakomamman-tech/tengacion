import React from "react";
import { MemoryRouter } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import CreatorFanPagePreview from "../CreatorFanPagePreview";

describe("CreatorFanPagePreview", () => {
  it("renders the fan-facing preview sections and actions", () => {
    render(
      <MemoryRouter>
        <CreatorFanPagePreview
          creatorProfile={{
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
                tracks: [{ title: "Golden Echoes", artistName: "Creator Example", price: 500 }],
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
        />
      </MemoryRouter>
    );

    expect(screen.getByLabelText(/fan page view/i)).toBeInTheDocument();
    expect(screen.getAllByText(/creator example/i).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /follow/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /donate/i }).length).toBeGreaterThan(0);
    expect(screen.getByText(/unlock exclusive content/i)).toBeInTheDocument();
    expect(screen.getByText(/popular releases/i)).toBeInTheDocument();
    expect(screen.getByText(/featured episode/i)).toBeInTheDocument();
    expect(screen.getByText(/featured visual/i)).toBeInTheDocument();
    expect(screen.getByText(/books by creator example/i)).toBeInTheDocument();
  });
});
