import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import CreatorHero from "../CreatorHero";

describe("CreatorHero", () => {
  it("shows stream buttons for saved Spotify and YouTube links", () => {
    render(
      <CreatorHero
        creator={{
          id: "creator-1",
          displayName: "Creator Example",
          tagline: "A public creator hub",
          avatarUrl: "",
          bannerUrl: "",
          links: [
            {
              label: "Spotify",
              url: "https://open.spotify.com/artist/creator-example",
            },
            {
              label: "YouTube",
              url: "https://www.youtube.com/@creator-example",
            },
          ],
        }}
        stats={{
          followersCount: 1200,
          totalPlays: 3400,
          totalSales: 18,
        }}
        isFollowing={false}
        onFollow={() => {}}
        onSubscribe={() => {}}
        onOpenStudio={() => {}}
        subscriptionLabel="Subscribe for NGN 2,000/month"
      />
    );

    expect(screen.getByRole("button", { name: /follow creator/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /subscribe for ngn 2,000\/month/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /stream on spotify/i })).toHaveAttribute(
      "href",
      "https://open.spotify.com/artist/creator-example"
    );
    expect(screen.getByRole("link", { name: /stream on youtube/i })).toHaveAttribute(
      "href",
      "https://www.youtube.com/@creator-example"
    );
  });
});
