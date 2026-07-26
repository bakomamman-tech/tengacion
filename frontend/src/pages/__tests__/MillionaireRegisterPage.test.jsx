import { MemoryRouter } from "react-router-dom";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import MillionaireRegisterPage from "../MillionaireRegisterPage";
import { getMillionaireStatus } from "../../api";
import { useAuth } from "../../context/AuthContext";

vi.mock("../../api", () => ({
  getMillionaireStatus: vi.fn(),
  register: vi.fn(),
  registerMillionaireParticipant: vi.fn(),
  uploadAvatar: vi.fn(),
  uploadCover: vi.fn(),
}));

vi.mock("../../context/AuthContext", () => ({
  useAuth: vi.fn(),
}));

vi.mock("../../components/PublicNav", () => ({
  default: () => <nav>Public navigation</nav>,
}));

vi.mock("../../components/seo/SeoHead", () => ({
  default: () => null,
}));

describe("MillionaireRegisterPage", () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      login: vi.fn(),
      updateUser: vi.fn(),
    });
    vi.mocked(getMillionaireStatus).mockReset();
  });

  it("shows the flyer, account fields, both photo uploads and game limits for a new participant", () => {
    render(
      <MemoryRouter>
        <MillionaireRegisterPage />
      </MemoryRouter>
    );

    expect(
      screen.getByRole("heading", { name: /your mind is the real jackpot/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "Tengacion Millionaire quiz challenge flyer" })
    ).toHaveAttribute(
      "src",
      "/assets/campaigns/tengacion-millionaire-2026-768.jpg"
    );
    expect(
      screen
        .getByRole("img", { name: "Tengacion Millionaire quiz challenge flyer" })
        .parentElement?.querySelector('source[type="image/webp"]')
    ).toHaveAttribute(
      "srcset",
      expect.stringContaining("tengacion-millionaire-2026-480.webp 480w")
    );
    expect(screen.getByText(/3 stages/i)).toBeInTheDocument();
    expect(screen.getByText(/5 questions each/i)).toBeInTheDocument();
    expect(screen.getByText(/₦100–₦400 standard/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Tengacion username/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Profile picture/i)).toHaveAttribute("type", "file");
    expect(screen.getByLabelText(/Cover photo/i)).toHaveAttribute("type", "file");
    expect(
      screen.getByRole("button", { name: /create account & register for the game/i })
    ).toBeInTheDocument();
  });

  it("tells an existing Tengacion member not to create another account", async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: {
        _id: "user-1",
        name: "Ada",
        username: "ada",
        email: "ada@example.com",
      },
      login: vi.fn(),
      updateUser: vi.fn(),
    });
    vi.mocked(getMillionaireStatus).mockResolvedValue({
      registration: { registered: false },
      eligibility: {
        eligible: false,
        profileDetailsComplete: true,
        profilePhotoComplete: true,
        coverPhotoComplete: true,
        requirements: [],
      },
    });

    render(
      <MemoryRouter>
        <MillionaireRegisterPage />
      </MemoryRouter>
    );

    await waitFor(() => expect(getMillionaireStatus).toHaveBeenCalled());
    expect(
      screen.getByRole("heading", { name: /already registered on tengacion/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/will not ask/i)).toBeInTheDocument();
    expect(screen.getByText(/accept only the game rules and prize terms/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Tengacion username/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Profile picture/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Cover photo/i)).not.toBeInTheDocument();
  });
});
