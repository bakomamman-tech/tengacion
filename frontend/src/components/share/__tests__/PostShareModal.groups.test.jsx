import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  apiRequest: vi.fn(),
  createGroupPost: vi.fn(),
  getMyGroups: vi.fn(),
  onClose: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("../../../api", () => ({
  apiRequest: mocks.apiRequest,
  createPost: vi.fn(),
  createStory: vi.fn(),
  getChatContacts: vi.fn().mockResolvedValue([]),
  getFriendsHub: vi.fn().mockResolvedValue({ friends: [] }),
  getPostById: vi.fn(),
  resolveImage: (value) => value || "",
  sendChatMessage: vi.fn(),
}));

vi.mock("../../../context/AuthContext", () => ({
  useAuth: () => ({
    user: { _id: "user-1", name: "Test Creator", username: "test_creator" },
  }),
}));

vi.mock("../../../features/groups/groupApi", () => ({
  createGroupPost: mocks.createGroupPost,
  getMyGroups: mocks.getMyGroups,
}));

vi.mock("react-hot-toast", () => ({
  default: Object.assign(vi.fn(), {
    error: mocks.toastError,
    success: mocks.toastSuccess,
  }),
}));

import PostShareModal from "../PostShareModal";

const post = {
  _id: "post-1",
  text: "An original server post.",
  user: { _id: "author-1", name: "Original Artist", username: "original_artist" },
};

const group = {
  id: "group-1",
  name: "Server Creators",
  privacy: "public",
  updatedAt: "2026-08-03T10:00:00.000Z",
  members: [{ id: "user-1", name: "Test Creator", role: "Admin" }],
  posts: [],
};

describe("PostShareModal group destination", () => {
  beforeEach(() => {
    window.localStorage.clear();
    Element.prototype.scrollIntoView = vi.fn();
    mocks.apiRequest.mockReset().mockResolvedValue({ shareCount: 2 });
    mocks.createGroupPost.mockReset();
    mocks.getMyGroups.mockReset().mockResolvedValue([group]);
    mocks.onClose.mockReset();
    mocks.toastError.mockReset();
    mocks.toastSuccess.mockReset();
  });

  it("creates a server group post before reporting a successful share", async () => {
    const browser = userEvent.setup();
    mocks.createGroupPost.mockResolvedValue({
      ...group,
      posts: [{ id: "group-post-1", text: "Shared post", author: group.members[0] }],
    });

    render(
      <MemoryRouter>
        <PostShareModal open post={post} onClose={mocks.onClose} />
      </MemoryRouter>
    );

    await browser.click(await screen.findByRole("button", { name: "Share via Group" }));
    await browser.click((await screen.findByText("Server Creators")).closest("button"));
    await browser.click(screen.getByRole("button", { name: "Share to group" }));

    await waitFor(() => expect(mocks.createGroupPost).toHaveBeenCalledTimes(1));
    expect(mocks.createGroupPost).toHaveBeenCalledWith(
      "group-1",
      expect.stringMatching(/Shared from Original Artist.*An original server post.*post-1/s)
    );
    expect(mocks.apiRequest).toHaveBeenCalledWith("/api/posts/post-1/share", { method: "POST" });
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Shared to Server Creators.");
    expect(mocks.onClose).toHaveBeenCalled();
    expect(window.localStorage.getItem("tengacion:group-shares")).toBeNull();
  });

  it("keeps the modal open and records nothing locally when the server rejects the share", async () => {
    const browser = userEvent.setup();
    mocks.createGroupPost.mockRejectedValue(new Error("Group write rejected"));

    render(
      <MemoryRouter>
        <PostShareModal open post={post} onClose={mocks.onClose} />
      </MemoryRouter>
    );

    await browser.click(await screen.findByRole("button", { name: "Share via Group" }));
    await browser.click((await screen.findByText("Server Creators")).closest("button"));
    await browser.click(screen.getByRole("button", { name: "Share to group" }));

    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith("Group write rejected"));
    expect(mocks.apiRequest).not.toHaveBeenCalled();
    expect(mocks.onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Share" })).toBeInTheDocument();
    expect(window.localStorage.getItem("tengacion:group-shares")).toBeNull();
  });
});
