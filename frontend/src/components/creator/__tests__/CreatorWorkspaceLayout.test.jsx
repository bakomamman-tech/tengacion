import React from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import CreatorWorkspaceLayout from "../CreatorWorkspaceLayout";
import {
  getCreatorDashboardSummary,
  getCreatorPrivateContent,
  getCreatorWorkspaceProfile,
} from "../../../api";

vi.mock("../../../api", () => ({
  getCreatorDashboardSummary: vi.fn(),
  getCreatorPrivateContent: vi.fn(),
  getCreatorWorkspaceProfile: vi.fn(),
  resolveImage: vi.fn((value) => value || ""),
}));

describe("CreatorWorkspaceLayout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("groups creator lane tabs beneath the content categories parent link", async () => {
    getCreatorWorkspaceProfile.mockResolvedValue({
      displayName: "Creator Example",
      status: "active",
      creatorTypes: ["music", "bookPublishing", "podcast"],
    });
    getCreatorDashboardSummary.mockResolvedValue({
      summary: { availableBalance: 0 },
      content: {},
    });
    getCreatorPrivateContent.mockResolvedValue({ content: {} });

    render(
      <MemoryRouter initialEntries={["/creator/music/upload"]}>
        <Routes>
          <Route path="/creator" element={<CreatorWorkspaceLayout />}>
            <Route path="dashboard" element={<div>Dashboard page</div>} />
            <Route path="categories" element={<div>Categories page</div>} />
            <Route path="music/upload" element={<div>Music uploads page</div>} />
            <Route path="books/upload" element={<div>Books uploads page</div>} />
            <Route path="podcasts/upload" element={<div>Podcasts uploads page</div>} />
            <Route path="settings" element={<div>Settings page</div>} />
            <Route path="earnings" element={<div>Earnings page</div>} />
            <Route path="payouts" element={<div>Payouts page</div>} />
            <Route path="verification" element={<div>Verification page</div>} />
            <Route path="support" element={<div>Support page</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    await screen.findByText("Music uploads page");

    const quickNav = screen.getByRole("navigation", { name: /creator workspace quick navigation/i });
    expect(within(quickNav).getByRole("link", { name: /content categories/i })).toHaveClass("active");

    const categoryGroup = within(quickNav).getByRole("group", { name: /content categories/i });
    expect(within(categoryGroup).getByRole("link", { name: /music uploads/i })).toHaveAttribute(
      "href",
      "/creator/music/upload"
    );
    expect(within(categoryGroup).getByRole("link", { name: /book publishing uploads/i })).toHaveAttribute(
      "href",
      "/creator/books/upload"
    );
    expect(within(categoryGroup).getByRole("link", { name: /podcast uploads/i })).toHaveAttribute(
      "href",
      "/creator/podcasts/upload"
    );
  });

  it("renders the creator profile image in the sidebar brand area", async () => {
    getCreatorWorkspaceProfile.mockResolvedValue({
      displayName: "Creator Example",
      status: "active",
      creatorTypes: ["music"],
      user: {
        avatar: "/uploads/creator-profile.png",
      },
    });
    getCreatorDashboardSummary.mockResolvedValue({
      summary: { availableBalance: 0 },
      content: {},
    });
    getCreatorPrivateContent.mockResolvedValue({ content: {} });

    render(
      <MemoryRouter initialEntries={["/creator/dashboard"]}>
        <Routes>
          <Route path="/creator" element={<CreatorWorkspaceLayout />}>
            <Route path="dashboard" element={<div>Dashboard page</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    await screen.findByText("Dashboard page");
    expect(screen.getByAltText("Creator Example")).toHaveAttribute("src", "/uploads/creator-profile.png");
  });

  it("shows a dedicated fan page view button on the dashboard header", async () => {
    getCreatorWorkspaceProfile.mockResolvedValue({
      displayName: "Creator Example",
      status: "active",
      creatorTypes: ["music", "bookPublishing", "podcast"],
    });
    getCreatorDashboardSummary.mockResolvedValue({
      summary: { availableBalance: 0 },
      content: {},
    });
    getCreatorPrivateContent.mockResolvedValue({ content: {} });

    render(
      <MemoryRouter initialEntries={["/creator/dashboard"]}>
        <Routes>
          <Route path="/creator" element={<CreatorWorkspaceLayout />}>
            <Route path="dashboard" element={<div>Dashboard page</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    await screen.findByText("Dashboard page");
    expect(screen.getByRole("link", { name: /fan page view/i })).toHaveAttribute(
      "href",
      "/creator/fan-page-view"
    );
  });
});
