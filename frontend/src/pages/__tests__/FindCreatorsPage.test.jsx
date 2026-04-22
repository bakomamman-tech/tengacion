import React from "react";
import { MemoryRouter } from "react-router-dom";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import FindCreatorsPage from "../FindCreatorsPage";
import { getCreatorDiscovery } from "../../api";

const navigateMock = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock("../../api", () => ({
  getCreatorDiscovery: vi.fn(),
  resolveImage: (value) => value,
  toggleFollowCreator: vi.fn(),
}));

vi.mock("../../components/creator/media/ShareActions", () => ({
  default: () => null,
}));

describe("FindCreatorsPage", () => {
  beforeEach(() => {
    navigateMock.mockReset();
    vi.mocked(getCreatorDiscovery).mockResolvedValue({
      total: 1,
      hasMore: false,
      items: [
        {
          creatorId: "creator-1",
          id: "creator-1",
          name: "Jordan Bangoji",
          username: "jordan.bangoji",
          avatar: "",
          banner: "",
          category: "Music Creators",
          categoryLabels: ["Music"],
          bio: "Premium music and live sessions.",
          followerCount: 42,
          contentCount: 12,
          subscriptionPrice: 2500,
          creatorRoute: "/creator/jordan.bangoji",
          subscribeRoute: "/creators/creator-1/subscribe",
          following: false,
          subscribed: false,
          canSubscribe: true,
        },
      ],
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("searches creators by @handle and opens the real creator page", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/find-creators"]}>
        <FindCreatorsPage />
      </MemoryRouter>
    );

    expect(await screen.findByRole("heading", { name: "Jordan Bangoji" })).toBeInTheDocument();

    const input = screen.getByLabelText(/search creators/i);
    await user.type(input, "@jordan");

    await waitFor(() => {
      expect(getCreatorDiscovery).toHaveBeenLastCalledWith(
        expect.objectContaining({ search: "@jordan" })
      );
    });

    expect(screen.getByRole("link", { name: /visit page/i })).toHaveAttribute("href", "/creator/jordan.bangoji");
  });
});
