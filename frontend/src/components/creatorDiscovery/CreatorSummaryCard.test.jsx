import { MemoryRouter } from "react-router-dom";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import CreatorSummaryCard from "./CreatorSummaryCard";

vi.mock("react-hot-toast", () => ({
  default: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock("../../api", () => ({
  createCheckout: vi.fn(),
  resolveImage: (value) => value,
  toggleFollowCreator: vi.fn(),
}));

vi.mock("../../context/CreatorPlayerContext", () => ({
  useCreatorPlayer: () => ({ openPreview: vi.fn() }),
}));

vi.mock("../creator/media/ShareActions", () => ({
  default: ({ className = "" }) => <button className={className}>Share</button>,
}));

describe("CreatorSummaryCard", () => {
  it("renders the complete artist name and compact metadata labels", () => {
    render(
      <MemoryRouter>
        <CreatorSummaryCard
          item={{
            id: "release-1",
            creatorId: "creator-1",
            creatorName: "Elisha Danasabe",
            creatorUsername: "elisha",
            creatorAvatar: "/elisha.jpg",
            creatorTypeLabels: ["Music", "Books", "Podcasts"],
            creatorRoute: "/creators/elisha",
            route: "/tracks/release-1",
            title: "Yahweh",
            summary: "Song of gratitude",
            summaryLabel: "Music",
            timestampLabel: "10 Jul 2026",
            price: 500,
            canPreview: true,
            canBuy: true,
          }}
        />
      </MemoryRouter>
    );

    expect(screen.getByText("Elisha Danasabe")).toHaveAttribute("title", "Elisha Danasabe");
    expect(screen.getByText("Music / Books / Podcasts")).toHaveAttribute(
      "title",
      "Music / Books / Podcasts"
    );

    const metadata = document.querySelector(".creator-summary-card__meta");
    expect(metadata.querySelectorAll("span")).toHaveLength(2);
    expect(within(metadata).getByText("10 Jul 2026")).toBeInTheDocument();
    expect(within(metadata).getByText(/500/)).toBeInTheDocument();
  });
});
