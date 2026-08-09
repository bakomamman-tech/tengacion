import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  blockUser,
  getNotificationPreferences,
  getPrivacySafetyLists,
  getUsers,
  updateNotificationPreferences,
  updatePrivacy,
} from "../../api";
import NotificationSettingsPage from "../NotificationSettings";
import PrivacySettings from "../PrivacySettings";

vi.mock("../../api", () => ({
  blockUser: vi.fn(),
  getNotificationPreferences: vi.fn(),
  getPrivacySafetyLists: vi.fn(),
  getUsers: vi.fn(),
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
    vi.mocked(getPrivacySafetyLists).mockResolvedValue({
      blocked: [],
      muted: [],
      restricted: [],
      hiddenStoriesFrom: [],
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

  it("finds an account, confirms the relationship impact, and records a server-backed block", async () => {
    const user = userEvent.setup();
    const candidate = { _id: "user-2", name: "Safety Target", username: "safety_target" };
    vi.mocked(getUsers).mockResolvedValue([candidate]);
    vi.mocked(blockUser).mockResolvedValue({ success: true, blocked: true });
    vi.mocked(getPrivacySafetyLists)
      .mockResolvedValueOnce({
        blocked: [],
        muted: [],
        restricted: [],
        hiddenStoriesFrom: [],
      })
      .mockResolvedValue({
        blocked: [candidate],
        muted: [],
        restricted: [],
        hiddenStoriesFrom: [],
      });

    render(<PrivacySettings user={{ privacy: {} }} />);

    await user.type(screen.getByLabelText("Find an account"), "safety");
    await user.click(screen.getByRole("button", { name: "Search accounts" }));
    expect(await screen.findByText("@safety_target")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Block" }));
    expect(blockUser).not.toHaveBeenCalled();
    expect(screen.getByRole("alertdialog", { name: "Confirm block" })).toHaveTextContent(
      /Existing relationship links are removed/i
    );

    await user.click(screen.getByRole("button", { name: "Confirm block" }));
    await waitFor(() => {
      expect(blockUser).toHaveBeenCalledWith("user-2");
      expect(screen.getByText("Blocked @safety_target.")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Unblock @safety_target" })).toBeInTheDocument();
    });
  });
});
