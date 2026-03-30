import React from "react";
import { MemoryRouter } from "react-router-dom";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import Navbar from "../Navbar";
import { searchGlobal } from "../api";

const navigateMock = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateMock,
    useLocation: () => ({ pathname: "/home", search: "" }),
  };
});

vi.mock("../api", () => ({
  resolveImage: (value) => value,
  searchGlobal: vi.fn(),
}));

vi.mock("../components/CreateMenuDropdown", () => ({
  default: () => null,
}));

vi.mock("../components/MessengerInboxDropdown", () => ({
  default: () => null,
}));

vi.mock("../components/NotificationsDropdown", () => ({
  default: () => null,
}));

vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({
    logout: vi.fn(),
  }),
}));

vi.mock("../context/NotificationsContext", () => ({
  useNotifications: () => ({
    notifications: [],
    unreadCount: 0,
    loading: false,
    error: null,
    fetchNotifications: vi.fn(),
    markAllRead: vi.fn(),
    markOneRead: vi.fn(),
  }),
}));

vi.mock("../context/ThemeContext", () => ({
  useTheme: () => ({
    theme: "light",
    setTheme: vi.fn(),
  }),
}));

vi.mock("../notificationUtils", () => ({
  getNotificationTarget: vi.fn(),
}));

vi.mock("../Icon", () => ({
  Icon: () => null,
}));

describe("Navbar search", () => {
  beforeEach(() => {
    navigateMock.mockReset();
    vi.mocked(searchGlobal).mockResolvedValue({
      data: [
        {
          _id: "user-1",
          name: "Jordan Bangoji",
          username: "jordan.bangoji",
          avatar: "",
        },
      ],
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("finds registered accounts by @handle and opens the profile", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/home"]}>
        <Navbar
          user={{
            _id: "viewer-1",
            name: "Viewer User",
            username: "viewer_user",
            avatar: "",
            role: "user",
          }}
        />
      </MemoryRouter>
    );

    const input = screen.getByPlaceholderText(/search people or @username/i);
    await user.type(input, "@jordan");

    await waitFor(() => {
      expect(searchGlobal).toHaveBeenLastCalledWith({ q: "@jordan", type: "users" });
    });

    expect(await screen.findByText("Jordan Bangoji")).toBeInTheDocument();
    expect(screen.getByText(/@jordan\.bangoji/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /jordan bangoji/i }));

    expect(navigateMock).toHaveBeenCalledWith("/profile/jordan.bangoji");
  });
});
