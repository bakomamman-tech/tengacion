import React from "react";
import { MemoryRouter } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import CreatorRegisterPage from "../CreatorRegisterPage";
import { getCreatorAccess, getCreatorWorkspaceProfile } from "../../../api";

vi.mock("../../../api", async () => {
  const actual = await vi.importActual("../../../api");
  return {
    ...actual,
    getCreatorAccess: vi.fn(),
    getCreatorWorkspaceProfile: vi.fn(),
    registerCreatorProfile: vi.fn(),
    resolveImage: vi.fn(() => ""),
    uploadAvatar: vi.fn(),
  };
});

vi.mock("../../../context/AuthContext", () => ({
  useAuth: () => ({
    updateUser: vi.fn(),
  }),
}));

describe("CreatorRegisterPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCreatorAccess.mockResolvedValue({
      isCreatorRegistered: false,
      onboardingCompleted: false,
    });
    getCreatorWorkspaceProfile.mockRejectedValue(new Error("Creator profile not found"));
  });

  it("opens creator registration for an admin account without a creator profile", async () => {
    render(
      <MemoryRouter initialEntries={["/creator/register"]}>
        <CreatorRegisterPage
          user={{
            name: "Admin User",
            role: "admin",
            phone: "08000000000",
            country: "Nigeria",
          }}
        />
      </MemoryRouter>
    );

    expect(await screen.findByRole("heading", { name: /creator identity/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /register as a creator/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/full name/i)).toHaveValue("Admin User");
  });
});
