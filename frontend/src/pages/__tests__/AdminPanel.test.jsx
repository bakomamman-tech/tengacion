import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import AdminPanel from "../AdminPanel";
import {
  adminBanUser,
  adminForceLogoutUser,
  adminGetAuditLogs,
  adminGetUser,
  adminListUsers,
  adminSoftDeleteUser,
  adminUnbanUser,
} from "../../api";

const clipboardWriteTextMock = vi.hoisted(() => vi.fn());

vi.mock("../../api", () => ({
  adminBanUser: vi.fn(),
  adminForceLogoutUser: vi.fn(),
  adminGetAuditLogs: vi.fn(),
  adminGetUser: vi.fn(),
  adminListUsers: vi.fn(),
  adminSoftDeleteUser: vi.fn(),
  adminUnbanUser: vi.fn(),
}));

vi.mock("../../components/AdminShell", () => ({
  default: ({ title, subtitle, actions, children }) => (
    <div>
      <header>
        <h1>{title}</h1>
        <p>{subtitle}</p>
        <div>{actions}</div>
      </header>
      <main>{children}</main>
    </div>
  ),
}));

const listUser = {
  _id: "user-1",
  displayName: "Dean Ambrose",
  username: "dean",
  email: "deansky1212@gmail.com",
  role: "user",
  isBanned: false,
  isDeleted: false,
  createdAt: "2026-07-10T11:20:13.000Z",
};

const detailUser = {
  ...listUser,
  phone: "080 987 7667",
  lastLoginAt: "2026-07-10T11:20:15.000Z",
};

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/admin/users"]}>
      <AdminPanel user={{ _id: "admin-1", name: "Admin User", role: "admin" }} />
    </MemoryRouter>
  );

describe("AdminPanel user details", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clipboardWriteTextMock.mockResolvedValue(undefined);
    Object.defineProperty(window.navigator, "clipboard", {
      configurable: true,
      value: { writeText: clipboardWriteTextMock },
    });

    vi.mocked(adminListUsers).mockResolvedValue({ users: [listUser], total: 1 });
    vi.mocked(adminGetUser).mockResolvedValue(detailUser);
    vi.mocked(adminGetAuditLogs).mockResolvedValue({ logs: [], total: 0 });
    vi.mocked(adminBanUser).mockResolvedValue({ success: true });
    vi.mocked(adminUnbanUser).mockResolvedValue({ success: true });
    vi.mocked(adminForceLogoutUser).mockResolvedValue({ success: true });
    vi.mocked(adminSoftDeleteUser).mockResolvedValue({ success: true });
  });

  it("presents emergency contact details and copies stored values without triggering account actions", async () => {
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "Manage" }));

    await waitFor(() => {
      expect(adminGetUser).toHaveBeenCalledWith("user-1");
    });

    const dialog = await screen.findByRole("dialog", { name: /manage user/i });
    const modal = within(dialog);

    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(modal.getByRole("heading", { name: "Emergency contact" })).toBeInTheDocument();
    expect(modal.getByText("Dean Ambrose")).toBeInTheDocument();
    expect(modal.getByText("@dean")).toBeInTheDocument();
    expect(modal.getByRole("link", { name: "080 987 7667" })).toHaveAttribute(
      "href",
      "tel:0809877667"
    );
    expect(modal.getByRole("link", { name: "deansky1212@gmail.com" })).toHaveAttribute(
      "href",
      "mailto:deansky1212@gmail.com"
    );
    expect(modal.getByText("user-1")).toBeInTheDocument();
    expect(modal.getByText("Role")).toBeInTheDocument();
    expect(modal.getByText("Last login")).toBeInTheDocument();

    fireEvent.click(modal.getByRole("button", { name: "Copy phone" }));
    await waitFor(() => {
      expect(clipboardWriteTextMock).toHaveBeenCalledWith("080 987 7667");
    });
    expect(await modal.findByText("Phone copied.")).toBeInTheDocument();

    fireEvent.click(modal.getByRole("button", { name: "Copy email" }));
    await waitFor(() => {
      expect(clipboardWriteTextMock).toHaveBeenCalledWith("deansky1212@gmail.com");
    });

    fireEvent.click(modal.getByRole("button", { name: "Copy all details" }));
    await waitFor(() => {
      expect(clipboardWriteTextMock).toHaveBeenLastCalledWith(
        expect.stringContaining("Name: Dean Ambrose\nUsername: @dean\nPhone: 080 987 7667")
      );
    });
    expect(clipboardWriteTextMock.mock.calls.at(-1)[0]).toContain("User ID: user-1");
    expect(clipboardWriteTextMock.mock.calls.at(-1)[0]).toContain("Status: Active");

    expect(adminBanUser).not.toHaveBeenCalled();
    expect(adminForceLogoutUser).not.toHaveBeenCalled();
    expect(adminSoftDeleteUser).not.toHaveBeenCalled();

    fireEvent.click(modal.getByRole("button", { name: "Close user details" }));
    expect(screen.queryByRole("dialog", { name: /manage user/i })).not.toBeInTheDocument();
  });

  it("makes missing contact data explicit and disables unavailable copy actions", async () => {
    vi.mocked(adminGetUser).mockResolvedValue({ ...detailUser, phone: "", email: "" });
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "Manage" }));
    const dialog = await screen.findByRole("dialog", { name: /manage user/i });
    const modal = within(dialog);

    expect(modal.getAllByText("Not supplied")).toHaveLength(2);
    expect(modal.getByRole("button", { name: "Copy phone" })).toBeDisabled();
    expect(modal.getByRole("button", { name: "Copy email" })).toBeDisabled();
    expect(modal.queryByRole("link", { name: "Call" })).not.toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: /manage user/i })).not.toBeInTheDocument();
  });
});
