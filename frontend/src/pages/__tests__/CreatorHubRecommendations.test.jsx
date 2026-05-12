import React from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  getDiscoveryCreatorHubMock,
  getPublicCreatorProfileMock,
  trackDiscoveryEventsMock,
} = vi.hoisted(() => ({
  getDiscoveryCreatorHubMock: vi.fn(),
  getPublicCreatorProfileMock: vi.fn(),
  trackDiscoveryEventsMock: vi.fn(),
}));

vi.mock("react-hot-toast", () => ({
  default: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock("../../components/seo/SeoHead", () => ({
  default: () => null,
}));

vi.mock("../../components/creator/media/CreatorHero", () => ({
  default: () => <section data-testid="creator-hero" />,
}));

vi.mock("../../components/creator/media/ShareActions", () => ({
  default: () => null,
}));

vi.mock("../../hooks/useEntitlementSocket", () => ({
  default: vi.fn(),
}));

vi.mock("../../context/AuthContext", () => ({
  useAuth: () => ({
    user: {
      _id: "viewer-1",
      id: "viewer-1",
      username: "viewer",
    },
  }),
}));

vi.mock("../../api", () => ({
  createCheckout: vi.fn(),
  getDiscoveryCreatorHub: getDiscoveryCreatorHubMock,
  getDownloadUrl: vi.fn(),
  getPublicCreatorProfile: getPublicCreatorProfileMock,
  getStreamUrl: vi.fn(),
  initPayment: vi.fn(),
  resolveImage: (value) => value,
  toggleFollowCreator: vi.fn(),
  trackDiscoveryEvents: trackDiscoveryEventsMock,
}));

import CreatorHubPage from "../CreatorHubPage";

const creatorId = "507f1f77bcf86cd799439011";

const buildCreatorPayload = () => ({
  creator: {
    id: creatorId,
    displayName: "Creator Example",
    username: "creator-example",
    bio: "Premium music and books.",
    tagline: "A creator studio on Tengacion",
    avatarUrl: "",
    bannerUrl: "",
    links: [],
    genres: ["Afrobeats"],
    creatorTypes: ["music"],
    canonicalPath: `/creators/${creatorId}`,
    tabPaths: {
      home: `/creators/${creatorId}`,
      music: `/creators/${creatorId}/music`,
      albums: `/creators/${creatorId}/albums`,
      podcasts: `/creators/${creatorId}/podcasts`,
      books: `/creators/${creatorId}/books`,
    },
  },
  stats: {
    followersCount: 12,
    totalTracks: 1,
    totalAlbums: 0,
    totalEpisodes: 0,
    totalBooks: 0,
    totalVideos: 0,
    totalPlays: 20,
    totalSales: 1,
  },
  viewer: {
    isOwner: false,
    isFollowing: false,
  },
  subscription: {
    price: 2000,
    isSubscribed: false,
  },
  featured: null,
  latestReleases: [],
  music: {
    tracks: [
      {
        id: "track-1",
        itemType: "track",
        mediaType: "audio",
        title: "Recommended Track",
        subtitle: "Afrobeats",
        coverUrl: "",
        previewUrl: "https://cdn.test/track-preview.mp3",
        streamUrl: "https://cdn.test/track.mp3",
        route: "/tracks/track-1",
        price: 0,
        canPreview: true,
        canStream: true,
        canDownload: false,
        canBuy: false,
      },
    ],
    albums: [],
    videos: [],
  },
  podcasts: {
    series: {},
    episodes: [],
  },
  books: [],
  seo: {
    indexable: true,
  },
});

const renderCreatorHub = () =>
  render(
    <MemoryRouter initialEntries={[`/creators/${creatorId}`]}>
      <Routes>
        <Route path="/creators/:creatorId" element={<CreatorHubPage />} />
      </Routes>
    </MemoryRouter>
  );

describe("CreatorHubPage recommendations", () => {
  beforeEach(() => {
    getPublicCreatorProfileMock.mockReset();
    getDiscoveryCreatorHubMock.mockReset();
    trackDiscoveryEventsMock.mockReset();
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();

    getPublicCreatorProfileMock.mockResolvedValue(buildCreatorPayload());
    getDiscoveryCreatorHubMock.mockResolvedValue({
      requestId: "rec-hub-1",
      surface: "creator_hub",
      items: [
        {
          id: "track-1",
          entityType: "track",
          rank: 1,
          reason: "content_type_affinity",
          reasonLabel: "Because you like this format",
          creatorId,
          authorUserId: "creator-user-1",
        },
      ],
    });
    trackDiscoveryEventsMock.mockResolvedValue({ accepted: 1 });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders creator-hub recommendations from ranked discovery ids and tracks engagement", async () => {
    const user = userEvent.setup();

    renderCreatorHub();

    expect(await screen.findByRole("heading", { name: /recommended for you/i })).toBeInTheDocument();
    expect(screen.getByText("Because you like this format")).toBeInTheDocument();
    expect(getDiscoveryCreatorHubMock).toHaveBeenCalledWith({
      creatorId,
      limit: 12,
    });

    const previewButtons = screen.getAllByRole("button", { name: /^preview$/i });
    await user.click(previewButtons[0]);

    await waitFor(() => {
      expect(trackDiscoveryEventsMock).toHaveBeenCalledWith({
        requestId: "rec-hub-1",
        surface: "creator_hub",
        events: [
          expect.objectContaining({
            type: "recommendation_clicked",
            entityType: "track",
            entityId: "track-1",
            position: 1,
            metadata: expect.objectContaining({
              action: "preview",
              creatorId,
              reason: "content_type_affinity",
            }),
          }),
        ],
      });
    });
  });

  it("keeps the regular creator content when recommendation discovery is unavailable", async () => {
    getDiscoveryCreatorHubMock.mockRejectedValue(new Error("discovery unavailable"));

    renderCreatorHub();

    expect(await screen.findByRole("heading", { name: /top singles/i })).toBeInTheDocument();
    expect(screen.getByText("Recommended Track")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /recommended for you/i })).not.toBeInTheDocument();
  });
});
