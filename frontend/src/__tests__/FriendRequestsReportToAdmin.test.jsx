import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import FriendRequests from "../FriendRequests";
import {
  getFriendRequests,
  submitAdminComplaint,
} from "../api";

const navigateMock = vi.fn();

vi.mock("../api", () => ({
  getFriendRequests: vi.fn(),
  submitAdminComplaint: vi.fn(),
  acceptFriendRequest: vi.fn(),
  rejectFriendRequest: vi.fn(),
  resolveImage: vi.fn((value) => value || ""),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({ user: { _id: "user-1", username: "reporter" } }),
}));

vi.mock("../socket", () => ({
  connectSocket: () => null,
}));

vi.mock("react-hot-toast", () => ({
  default: {
    success: vi.fn(),
  },
}));

describe("FriendRequests report flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getFriendRequests).mockResolvedValue([]);
    vi.mocked(submitAdminComplaint).mockResolvedValue({ success: true });
  });

  it("opens the report dialog and submits a complaint to admin", async () => {
    render(
      <MemoryRouter initialEntries={["/home"]}>
        <FriendRequests />
      </MemoryRouter>
    );

    expect(await screen.findByText("Report To Admin")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /find friends/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /find friends/i }));

    expect(navigateMock).toHaveBeenCalledWith("/find-friends");

    fireEvent.click(screen.getByRole("button", { name: /report to admin/i }));

    fireEvent.change(screen.getByLabelText(/subject/i), {
      target: { value: "Need admin help" },
    });
    fireEvent.change(screen.getByLabelText(/complaint/i), {
      target: { value: "Please review this issue as soon as possible." },
    });
    fireEvent.change(screen.getByLabelText(/type/i), {
      target: { value: "safety" },
    });

    fireEvent.click(screen.getByRole("button", { name: /send to admin/i }));

    await waitFor(() => {
      expect(submitAdminComplaint).toHaveBeenCalledWith({
        subject: "Need admin help",
        details: "Please review this issue as soon as possible.",
        category: "safety",
        sourcePath: "/home",
        sourceLabel: "Home",
      });
    });
  });
});
