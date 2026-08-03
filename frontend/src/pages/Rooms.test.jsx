import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createRoom, getRooms, joinRoom, leaveRoom } from "../api";
import Rooms from "./Rooms";

vi.mock("../api", () => ({
  createRoom: vi.fn(),
  getRooms: vi.fn(),
  joinRoom: vi.fn(),
  leaveRoom: vi.fn(),
}));

const publicRoom = {
  _id: "room-public",
  name: "Public Creators",
  description: "Open collaboration",
  privacy: "public",
  isMember: false,
  isOwner: false,
};

describe("Rooms server-confirmed journeys", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getRooms).mockResolvedValue([publicRoom]);
  });

  it("reloads authoritative room membership after a confirmed join and leave", async () => {
    const user = userEvent.setup();
    vi.mocked(joinRoom).mockResolvedValue({ success: true });
    vi.mocked(leaveRoom).mockResolvedValue({ success: true });
    vi.mocked(getRooms)
      .mockResolvedValueOnce([publicRoom])
      .mockResolvedValueOnce([{ ...publicRoom, isMember: true }])
      .mockResolvedValueOnce([publicRoom]);

    render(<Rooms />);

    await user.click(await screen.findByRole("button", { name: "Join" }));
    await waitFor(() => expect(joinRoom).toHaveBeenCalledWith("room-public"));
    const leaveButton = await screen.findByRole("button", { name: "Leave" });

    await user.click(leaveButton);
    await waitFor(() => expect(leaveRoom).toHaveBeenCalledWith("room-public"));
    expect(await screen.findByRole("button", { name: "Join" })).toBeInTheDocument();
    expect(getRooms).toHaveBeenCalledTimes(3);
  });

  it("keeps failed membership actions visible instead of claiming success", async () => {
    const user = userEvent.setup();
    vi.mocked(joinRoom).mockRejectedValue(new Error("Private room requires invite"));

    render(<Rooms />);

    await user.click(await screen.findByRole("button", { name: "Join" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Private room requires invite");
    expect(screen.getByRole("button", { name: "Join" })).toBeInTheDocument();
    expect(getRooms).toHaveBeenCalledTimes(1);
  });

  it("clears the creation form only after the room API confirms persistence", async () => {
    const user = userEvent.setup();
    let resolveCreate;
    vi.mocked(createRoom).mockImplementation(
      () => new Promise((resolve) => {
        resolveCreate = resolve;
      })
    );

    render(<Rooms />);

    const nameInput = screen.getByPlaceholderText("Room name");
    const descriptionInput = screen.getByPlaceholderText("Description");
    await user.type(nameInput, "Writers Circle");
    await user.type(descriptionInput, "Draft together");
    await user.click(screen.getByRole("button", { name: "Create room" }));

    expect(nameInput).toHaveValue("Writers Circle");
    expect(screen.getByRole("button", { name: "Creating..." })).toBeDisabled();

    resolveCreate({ _id: "room-created" });
    await waitFor(() => expect(nameInput).toHaveValue(""));
    expect(descriptionInput).toHaveValue("");
    expect(getRooms).toHaveBeenCalledTimes(2);
  });
});

