import React from "react";
import { MemoryRouter } from "react-router-dom";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import CreatorSettingsPage from "../CreatorSettingsPage";
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

describe("CreatorSettingsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("persists book publishing from the settings form with canonical creator lane keys", async () => {
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
      creatorTypes: ["music"],
      acceptedTerms: true,
      acceptedCopyrightDeclaration: true,
    };
    const updatedProfile = {
      ...creatorProfile,
      creatorTypes: ["music", "bookPublishing"],
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
        <CreatorSettingsPage />
      </MemoryRouter>
    );

    await userEvent.click(screen.getByRole("checkbox", { name: /book publishing/i }));
    await userEvent.click(screen.getByRole("button", { name: /save creator profile/i }));

    await waitFor(() => {
      expect(updateCreatorWorkspaceProfile).toHaveBeenCalledWith(
        expect.objectContaining({
          creatorTypes: ["music", "bookPublishing"],
        })
      );
      expect(setCreatorProfile).toHaveBeenCalledWith(updatedProfile);
    });
  });
});
