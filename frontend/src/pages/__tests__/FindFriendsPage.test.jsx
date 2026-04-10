import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import FindFriendsPage from "../FindFriendsPage";
import { getFriendDirectory, sendFriendRequest } from "../../api";

const navigateMock = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock("../../api", () => ({
  cancelFriendRequest: vi.fn(),
  getFriendDirectory: vi.fn(),
  resolveImage: (value) => value,
  sendFriendRequest: vi.fn(),
}));

vi.mock("../../Navbar", () => ({
  default: () => <div data-testid="navbar" />,
}));

vi.mock("../../Sidebar", () => ({
  default: () => <div data-testid="sidebar" />,
}));

vi.mock("../../Messenger", () => ({
  default: () => <div data-testid="messenger" />,
}));

vi.mock("react-hot-toast", () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("FindFriendsPage", () => {
  beforeEach(() => {
    navigateMock.mockReset();
    vi.clearAllMocks();
    vi.mocked(getFriendDirectory).mockResolvedValue({
      total: 1,
      hasMore: false,
      items: [
        {
          _id: "user-2",
          name: "Jane Doe",
          username: "jane.doe",
          avatar: "",
          mutualFriendsCount: 3,
          relationship: {
            status: "none",
            canRequest: true,
            canCancelRequest: false,
            isFriend: false,
            hasSentRequest: false,
            hasIncomingRequest: false,
          },
        },
      ],
    });
    vi.mocked(sendFriendRequest).mockResolvedValue({ sent: true });
  });

  it("loads Tengacion accounts and sends a friend request from the directory", async () => {
    render(
      <MemoryRouter initialEntries={["/find-friends"]}>
        <FindFriendsPage user={{ _id: "user-1", username: "tester", name: "Tester" }} />
      </MemoryRouter>
    );

    expect(await screen.findByRole("heading", { name: "Find Friends" })).toBeInTheDocument();
    expect(await screen.findByText("Jane Doe")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /add friend/i }));

    await waitFor(() => {
      expect(sendFriendRequest).toHaveBeenCalledWith("user-2");
    });

    expect(screen.getByRole("button", { name: /cancel request/i })).toBeInTheDocument();
  });
});
