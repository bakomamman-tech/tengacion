import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  getNotifications,
  getUnreadNotificationsCount,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from "../api";
import { connectSocket } from "../socket";
import { useAuth } from "./AuthContext";
import { NotificationsProvider, useNotifications } from "./NotificationsContext";

vi.mock("../api", () => ({
  getNotifications: vi.fn(),
  getUnreadNotificationsCount: vi.fn(),
  markAllNotificationsAsRead: vi.fn(),
  markNotificationAsRead: vi.fn(),
}));

vi.mock("../socket", () => ({
  connectSocket: vi.fn(),
}));

vi.mock("./AuthContext", () => ({
  useAuth: vi.fn(),
}));

function NotificationHarness() {
  const {
    notifications,
    unreadCount,
    fetchNotifications,
    markAllRead,
    markOneRead,
  } = useNotifications();

  return (
    <main>
      <output data-testid="unread-count">{unreadCount}</output>
      <output data-testid="read-state">
        {notifications.map((item) => `${item._id}:${item.read ? "read" : "unread"}`).join(",")}
      </output>
      <button type="button" onClick={() => void fetchNotifications()}>
        Load
      </button>
      <button
        type="button"
        onClick={async () => {
          const result = await markOneRead("notification-1");
          document.body.dataset.markOneResult = String(result);
        }}
      >
        Mark one
      </button>
      <button
        type="button"
        onClick={async () => {
          const result = await markAllRead({ optimistic: true });
          document.body.dataset.markAllResult = String(result);
        }}
      >
        Mark all
      </button>
    </main>
  );
}

const renderHarness = () =>
  render(
    <NotificationsProvider>
      <NotificationHarness />
    </NotificationsProvider>
  );

describe("NotificationsContext server authority", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete document.body.dataset.markOneResult;
    delete document.body.dataset.markAllResult;
    vi.mocked(useAuth).mockReturnValue({ user: { _id: "viewer-1" } });
    vi.mocked(connectSocket).mockReturnValue({ on: vi.fn(), off: vi.fn() });
    vi.mocked(getUnreadNotificationsCount).mockResolvedValue({ unreadCount: 1 });
    vi.mocked(getNotifications).mockResolvedValue({
      unreadCount: 1,
      data: [
        { _id: "notification-1", read: false },
        { _id: "notification-2", read: true },
      ],
    });
  });

  it("commits a read state only after the notification API confirms it", async () => {
    const user = userEvent.setup();
    vi.mocked(markNotificationAsRead).mockResolvedValue({ unreadCount: 0 });
    renderHarness();

    await user.click(screen.getByRole("button", { name: "Load" }));
    await waitFor(() => expect(screen.getByTestId("unread-count")).toHaveTextContent("1"));
    await user.click(screen.getByRole("button", { name: "Mark one" }));

    await waitFor(() => {
      expect(document.body.dataset.markOneResult).toBe("true");
      expect(screen.getByTestId("read-state")).toHaveTextContent("notification-1:read");
      expect(screen.getByTestId("unread-count")).toHaveTextContent("0");
    });
  });

  it("rolls back optimistic single and bulk reads when persistence fails", async () => {
    const user = userEvent.setup();
    vi.mocked(markNotificationAsRead).mockRejectedValue(new Error("Read failed"));
    vi.mocked(markAllNotificationsAsRead).mockRejectedValue(new Error("Bulk read failed"));
    renderHarness();

    await user.click(screen.getByRole("button", { name: "Load" }));
    await waitFor(() => expect(screen.getByTestId("read-state")).toHaveTextContent("notification-1:unread"));

    await user.click(screen.getByRole("button", { name: "Mark one" }));
    await waitFor(() => {
      expect(document.body.dataset.markOneResult).toBe("false");
      expect(screen.getByTestId("read-state")).toHaveTextContent("notification-1:unread");
      expect(screen.getByTestId("unread-count")).toHaveTextContent("1");
    });

    await user.click(screen.getByRole("button", { name: "Mark all" }));
    await waitFor(() => {
      expect(document.body.dataset.markAllResult).toBe("false");
      expect(screen.getByTestId("read-state")).toHaveTextContent("notification-1:unread");
      expect(screen.getByTestId("unread-count")).toHaveTextContent("1");
    });
  });
});

