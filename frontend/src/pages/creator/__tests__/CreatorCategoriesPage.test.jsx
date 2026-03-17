import React from "react";
import { MemoryRouter } from "react-router-dom";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import CreatorCategoriesPage from "../CreatorCategoriesPage";
import { updateCreatorWorkspaceProfile } from "../../../api";
import { useCreatorWorkspace } from "../../../components/creator/useCreatorWorkspace";

vi.mock("../../../api", () => ({
  updateCreatorWorkspaceProfile: vi.fn(),
}));

vi.mock("../../../components/creator/useCreatorWorkspace", () => ({
  useCreatorWorkspace: vi.fn(),
}));

vi.mock("react-hot-toast", () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("CreatorCategoriesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("syncs the saved creator profile into workspace state after enabling book publishing", async () => {
    const setCreatorProfile = vi.fn();
    const creatorProfile = {
      fullName: "Creator Example",
      displayName: "Creator Example",
      phoneNumber: "08000000000",
      accountNumber: "1234567890",
      country: "Nigeria",
      countryOfResidence: "Nigeria",
      tagline: "",
      bio: "",
      genres: [],
      socialHandles: {},
      musicProfile: {},
      booksProfile: {},
      podcastsProfile: {},
      creatorTypes: ["music", "podcast"],
      acceptedTerms: true,
      acceptedCopyrightDeclaration: true,
    };
    const updatedProfile = {
      ...creatorProfile,
      creatorTypes: ["music", "bookPublishing", "podcast"],
    };

    useCreatorWorkspace.mockReturnValue({
      creatorProfile,
      setCreatorProfile,
    });
    updateCreatorWorkspaceProfile.mockResolvedValue({
      success: true,
      creatorProfile: updatedProfile,
    });

    render(
      <MemoryRouter>
        <CreatorCategoriesPage />
      </MemoryRouter>
    );

    expect(screen.getByRole("link", { name: /music uploads/i })).toHaveAttribute("href", "/creator/music/upload");
    expect(screen.getByRole("link", { name: /podcast uploads/i })).toHaveAttribute("href", "/creator/podcasts/upload");

    await userEvent.click(screen.getByRole("checkbox", { name: /book publishing/i }));
    await userEvent.click(screen.getByRole("button", { name: /save category selection/i }));

    await waitFor(() => {
      expect(updateCreatorWorkspaceProfile).toHaveBeenCalledWith(
        expect.objectContaining({
          creatorTypes: ["music", "podcast", "bookPublishing"],
        })
      );
      expect(setCreatorProfile).toHaveBeenCalledWith(updatedProfile);
    });
  }, 15000);
});
