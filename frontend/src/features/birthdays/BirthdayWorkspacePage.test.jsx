import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getCommunityBirthdays, sendChatMessage } from "../../api";
import BirthdayWorkspacePage from "./BirthdayWorkspacePage";

const { toastSuccess, toastError } = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("react-hot-toast", () => ({
  default: { success: toastSuccess, error: toastError },
}));

vi.mock("../../api", () => ({
  getCommunityBirthdays: vi.fn(),
  resolveImage: (value) => value || "",
  sendChatMessage: vi.fn(),
}));

vi.mock("../../components/QuickAccessLayout", () => ({
  default: ({ children }) => <div>{children}</div>,
}));

const todayBirthday = {
  _id: "birthday-user-1",
  name: "Amina Bello",
  username: "amina",
  avatar: "",
  birthday: { day: 3, month: 8 },
  birthdayLabel: "Today",
  birthdayIsToday: true,
  birthdayDaysUntil: 0,
  birthdayDaysAgo: 0,
  canWish: true,
};

const renderPage = () =>
  render(
    <MemoryRouter>
      <BirthdayWorkspacePage user={{ _id: "viewer-1" }} />
    </MemoryRouter>
  );

describe("BirthdayWorkspacePage server-confirmed wishes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCommunityBirthdays).mockResolvedValue({
      today: [todayBirthday],
      upcoming: [],
      recent: [],
    });
  });

  it("clears a birthday wish only after the Messages API confirms it", async () => {
    const user = userEvent.setup();
    let resolveSend;
    vi.mocked(sendChatMessage).mockImplementation(
      () => new Promise((resolve) => {
        resolveSend = resolve;
      })
    );
    renderPage();

    const wishInput = await screen.findByPlaceholderText(/Happy Birthday, Amina/i);
    await user.type(wishInput, "Have a brilliant year ahead!");
    await user.click(screen.getByRole("button", { name: "Send birthday wish" }));

    expect(wishInput).toHaveValue("Have a brilliant year ahead!");
    expect(sendChatMessage).toHaveBeenCalledWith("birthday-user-1", {
      text: "Have a brilliant year ahead!",
    });

    resolveSend({ _id: "message-1" });
    await waitFor(() => expect(wishInput).toHaveValue(""));
    expect(toastSuccess).toHaveBeenCalledWith("Birthday wish sent to Amina Bello");
  });

  it("preserves the draft and reports the API error when sending fails", async () => {
    const user = userEvent.setup();
    vi.mocked(sendChatMessage).mockRejectedValue(new Error("Messaging is restricted"));
    renderPage();

    const wishInput = await screen.findByPlaceholderText(/Happy Birthday, Amina/i);
    await user.type(wishInput, "Warm wishes from Kaduna");
    await user.click(screen.getByRole("button", { name: "Send birthday wish" }));

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith("Messaging is restricted");
      expect(wishInput).toHaveValue("Warm wishes from Kaduna");
    });
  });
});
