import { MemoryRouter } from "react-router-dom";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import OnboardingPage from "../Onboarding";
import { getUsers, updateMe, updateOnboarding } from "../../api";

const navigateMock = vi.fn();
const updateUserMock = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock("../../api", () => ({
  getUsers: vi.fn(),
  updateMe: vi.fn(),
  updateOnboarding: vi.fn(),
}));

vi.mock("../../context/AuthContext", () => ({
  useAuth: () => ({
    user: {
      _id: "user-1",
      username: "reader",
      bio: "",
      avatar: { url: "" },
      onboarding: { completed: false, steps: {} },
      interests: [],
    },
    updateUser: updateUserMock,
  }),
}));

describe("OnboardingPage", () => {
  beforeEach(() => {
    navigateMock.mockReset();
    updateUserMock.mockReset();
    vi.mocked(getUsers).mockResolvedValue([
      { _id: "user-2", name: "Ada Beats", username: "ada" },
    ]);
    vi.mocked(updateMe).mockResolvedValue({ success: true });
    vi.mocked(updateOnboarding).mockResolvedValue({
      onboarding: {
        completed: false,
        intent: "author",
        creatorLanes: ["bookPublishing"],
        steps: { intent: true, interests: true },
      },
      interests: ["books", "writing", "education", "creator tools"],
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("saves a user intent, seeds interests, and opens the matching next route", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <OnboardingPage />
      </MemoryRouter>
    );

    await user.click(screen.getByRole("button", { name: /i am an author/i }));
    await user.click(screen.getByRole("button", { name: /^continue$/i }));

    await waitFor(() => {
      expect(updateOnboarding).toHaveBeenCalledWith(
        expect.objectContaining({
          intent: "author",
          creatorLanes: ["bookPublishing"],
          interests: expect.arrayContaining(["books", "writing", "education", "creator tools"]),
          steps: expect.objectContaining({ intent: true, interests: true }),
        })
      );
    });

    await user.type(await screen.findByLabelText(/bio/i), "Author and reader building on Tengacion.");
    await user.click(screen.getByRole("button", { name: /^continue$/i }));

    expect(updateMe).toHaveBeenCalledWith({ bio: "Author and reader building on Tengacion." });

    await user.click(await screen.findByRole("button", { name: /^technology$/i }));
    await user.click(screen.getByRole("button", { name: /^continue$/i }));

    expect(await screen.findByRole("heading", { name: /ready to launch/i })).toBeInTheDocument();
    expect(screen.getByText("I am an author")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /finish and open start author setup/i }));

    await waitFor(() => {
      expect(updateOnboarding).toHaveBeenLastCalledWith(
        expect.objectContaining({
          completed: true,
          intent: "author",
          creatorLanes: ["bookPublishing"],
          steps: expect.objectContaining({
            intent: true,
            followSuggestions: true,
          }),
        })
      );
      expect(navigateMock).toHaveBeenCalledWith("/creator/register", { replace: true });
    });
  });
});
