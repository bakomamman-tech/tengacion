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
      <MemoryRouter initialEntries={["/creator/music"]}>
        <Routes>
          <Route path="/creator" element={<CreatorWorkspaceLayout />}>
            <Route path="dashboard" element={<div>Dashboard page</div>} />
            <Route path="categories" element={<div>Categories page</div>} />
            <Route path="music" element={<div>Music page</div>} />
            <Route path="books" element={<div>Books page</div>} />
            <Route path="podcasts" element={<div>Podcasts page</div>} />
            <Route path="settings" element={<div>Settings page</div>} />
            <Route path="earnings" element={<div>Earnings page</div>} />
            <Route path="payouts" element={<div>Payouts page</div>} />
            <Route path="verification" element={<div>Verification page</div>} />
            <Route path="support" element={<div>Support page</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    await screen.findByText("Music page");

    const quickNav = screen.getByRole("navigation", { name: /creator workspace quick navigation/i });
    expect(within(quickNav).getByRole("link", { name: /content categories/i })).toHaveClass("active");

    const categoryGroup = within(quickNav).getByRole("group", { name: /content categories/i });
    expect(within(categoryGroup).getByRole("link", { name: /music/i })).toHaveAttribute("href", "/creator/music");
    expect(within(categoryGroup).getByRole("link", { name: /book publishing/i })).toHaveAttribute("href", "/creator/books");
    expect(within(categoryGroup).getByRole("link", { name: /podcast/i })).toHaveAttribute("href", "/creator/podcasts");
  });
});
