import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  getNotificationPreferences,
  updateNotificationPreferences,
  updatePrivacy,
} from "../../api";
import NotificationSettingsPage from "../NotificationSettings";
import PrivacySettings from "../PrivacySettings";

vi.mock("../../api", () => ({
  blockUser: vi.fn(),
  getNotificationPreferences: vi.fn(),
  hideStoriesFromUser: vi.fn(),
  muteUser: vi.fn(),
  restrictUser: vi.fn(),
  unblockUser: vi.fn(),
  unhideStoriesFromUser: vi.fn(),
  unmuteUser: vi.fn(),
  unrestrictUser: vi.fn(),
  updateNotificationPreferences: vi.fn(),
  updatePrivacy: vi.fn(),
}));

vi.mock("../../components/QuickAccessLayout", () => ({
  default: ({ children }) => <div>{children}</div>,
}));

describe("account settings persistence journeys", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getNotificationPreferences).mockResolvedValue({
      notificationPrefs: {
        likes: true,
        comments: true,
        follows: true,
        mentions: true,
        messages: true,
        reports: true,
        system: true,
      },
    });
  });

  it("claims notification preference success only after the API confirms the save", async () => {
    const user = userEvent.setup();
    let resolveSave;
    vi.mocked(updateNotificationPreferences).mockImplementation(
      () => new Promise((resolve) => {
        resolveSave = resolve;
      })
    );
    render(<NotificationSettingsPage user={{ _id: "viewer-1" }} />);

    const likesToggle = await screen.findByRole("checkbox", { name: /Likes/i });
    expect(likesToggle).toBeChecked();
    await user.click(likesToggle);
    await user.click(screen.getByRole("button", { name: "Save preferences" }));

    expect(updateNotificationPreferences).toHaveBeenCalledWith(
      expect.objectContaining({ likes: false, system: true })
    );
    expect(screen.queryByText("Notification preferences saved.")).not.toBeInTheDocument();

    resolveSave({ notificationPrefs: { likes: false } });
    expect(await screen.findByText("Notification preferences saved.")).toBeInTheDocument();
  });

  it("submits the selected privacy contract and exposes persistence failures", async () => {
    const user = userEvent.setup();
    vi.mocked(updatePrivacy).mockRejectedValue(new Error("Privacy save rejected"));
    render(
      <PrivacySettings
        user={{
          privacy: {
            profileVisibility: "public",
            defaultPostAudience: "friends",
            allowMessagesFrom: "everyone",
          },
        }}
      />
    );

    await user.selectOptions(screen.getByLabelText("Profile visibility"), "private");
    await user.selectOptions(screen.getByLabelText("Allow messages from"), "friends");
    await user.click(screen.getByRole("button", { name: "Save privacy" }));

    await waitFor(() => {
      expect(updatePrivacy).toHaveBeenCalledWith({
        profileVisibility: "private",
        defaultPostAudience: "friends",
        allowMessagesFrom: "friends",
      });
      expect(screen.getByText("Privacy save rejected")).toBeInTheDocument();
    });
  });
});

