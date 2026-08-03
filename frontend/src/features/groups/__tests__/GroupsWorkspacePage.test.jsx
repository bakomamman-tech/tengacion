import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  apiRequest: vi.fn(),
  createGroup: vi.fn(),
  createGroupPost: vi.fn(),
  getMyGroups: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("../../../api", () => ({
  apiRequest: mocks.apiRequest,
  resolveImage: (value) => value || "",
}));

vi.mock("../../../components/QuickAccessLayout", () => ({
  default: ({ children }) => <div>{children}</div>,
}));

vi.mock("../groupApi", () => ({
  createGroup: mocks.createGroup,
  createGroupPost: mocks.createGroupPost,
  getMyGroups: mocks.getMyGroups,
}));

vi.mock("react-hot-toast", () => ({
  default: Object.assign(vi.fn(), {
    error: mocks.toastError,
    success: mocks.toastSuccess,
  }),
}));

import GroupsWorkspacePage from "../GroupsWorkspacePage";

const user = {
  _id: "user-1",
  name: "Test Creator",
  username: "test_creator",
};

const serverGroup = {
  id: "group-1",
  name: "Server Writers Room",
  description: "A group returned by the API.",
  privacy: "public",
  createdAt: "2026-08-03T10:00:00.000Z",
  updatedAt: "2026-08-03T10:00:00.000Z",
  members: [{ id: "user-1", name: "Test Creator", role: "Admin" }],
  posts: [],
};

const renderPage = (initialEntry = "/groups") =>
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <GroupsWorkspacePage user={user} />
    </MemoryRouter>
  );

describe("GroupsWorkspacePage server authority", () => {
  beforeEach(() => {
    window.localStorage.clear();
    mocks.apiRequest.mockReset();
    mocks.createGroup.mockReset();
    mocks.createGroupPost.mockReset();
    mocks.getMyGroups.mockReset();
    mocks.toastError.mockReset();
    mocks.toastSuccess.mockReset();
  });

  it("shows a server error and removes legacy data instead of displaying a browser fallback", async () => {
    window.localStorage.setItem(
      "tengacion:user-groups:v1",
      JSON.stringify([{ id: "legacy-group", name: "Legacy Local Group" }])
    );
    mocks.getMyGroups.mockRejectedValue(new Error("Server unavailable"));

    renderPage();

    expect(await screen.findByRole("heading", { name: "Groups unavailable" })).toBeInTheDocument();
    expect(screen.getByText("Server unavailable")).toBeInTheDocument();
    expect(screen.queryByText("Legacy Local Group")).not.toBeInTheDocument();
    expect(window.localStorage.getItem("tengacion:user-groups:v1")).toBeNull();
  });

  it("keeps a failed group creation unsaved and leaves the form open for retry", async () => {
    const browser = userEvent.setup();
    mocks.getMyGroups.mockResolvedValue([]);
    mocks.createGroup.mockRejectedValue(new Error("Create request failed"));
    renderPage();

    await screen.findByRole("heading", { name: "Your group feed is ready for you" });
    await browser.click(screen.getAllByRole("button", { name: "+ Create New Group" })[0]);
    await browser.type(screen.getByLabelText("Group name"), "API Only Group");
    await browser.click(screen.getByRole("button", { name: "Create group" }));

    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith("Create request failed"));
    expect(screen.getByRole("dialog", { name: "Create group" })).toBeInTheDocument();
    expect(screen.getByLabelText("Group name")).toHaveValue("API Only Group");
    expect(window.localStorage.getItem("tengacion:user-groups:v1")).toBeNull();
    expect(screen.queryByText("API Only Group", { selector: ".groups-directory-card__title" })).not.toBeInTheDocument();
  });

  it("publishes discussion posts through the group API and renders the confirmed result", async () => {
    const browser = userEvent.setup();
    mocks.getMyGroups.mockResolvedValue([serverGroup]);
    mocks.createGroupPost.mockResolvedValue({
      ...serverGroup,
      updatedAt: "2026-08-03T11:00:00.000Z",
      posts: [
        {
          id: "post-1",
          text: "A server-confirmed discussion.",
          createdAt: "2026-08-03T11:00:00.000Z",
          author: { id: "user-1", name: "Test Creator" },
        },
      ],
    });
    renderPage();

    const groupButtons = await screen.findAllByRole("button", { name: /Server Writers Room/i });
    await browser.click(groupButtons[0]);
    await browser.type(screen.getByPlaceholderText("Post in Server Writers Room"), "A server-confirmed discussion.");
    await browser.click(screen.getByRole("button", { name: "Post" }));

    await waitFor(() =>
      expect(mocks.createGroupPost).toHaveBeenCalledWith(
        "group-1",
        "A server-confirmed discussion."
      )
    );
    expect(await screen.findByText("A server-confirmed discussion.")).toBeInTheDocument();
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Posted to your group");
  });
});
