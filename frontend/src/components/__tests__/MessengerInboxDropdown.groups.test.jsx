import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getChatContacts: vi.fn(),
  getMyGroups: vi.fn(),
}));

vi.mock("../../api", () => ({
  getChatContacts: mocks.getChatContacts,
  resolveImage: (value) => value || "",
}));

vi.mock("../../features/groups/groupApi", () => ({
  getMyGroups: mocks.getMyGroups,
}));

import MessengerInboxDropdown from "../MessengerInboxDropdown";

describe("Messenger Groups directory authority", () => {
  beforeEach(() => {
    window.localStorage.clear();
    mocks.getChatContacts.mockReset().mockResolvedValue([]);
    mocks.getMyGroups.mockReset();
  });

  it("lists groups returned by the API instead of browser records", async () => {
    const browser = userEvent.setup();
    window.localStorage.setItem(
      "tengacion:user-groups:v1",
      JSON.stringify([{ id: "legacy", name: "Legacy Browser Group" }])
    );
    mocks.getMyGroups.mockResolvedValue([
      {
        id: "server-group",
        name: "Server Music Group",
        description: "Loaded from the Groups API.",
      },
    ]);

    render(
      <MemoryRouter>
        <MessengerInboxDropdown />
      </MemoryRouter>
    );

    await browser.click(screen.getByRole("tab", { name: "Groups" }));
    expect(await screen.findByText("Server Music Group")).toBeInTheDocument();
    expect(screen.getByText("Loaded from the Groups API.")).toBeInTheDocument();
    expect(screen.queryByText("Legacy Browser Group")).not.toBeInTheDocument();
  });

  it("surfaces the API failure instead of silently showing cached groups", async () => {
    const browser = userEvent.setup();
    mocks.getMyGroups.mockRejectedValue(new Error("Groups service unavailable"));

    render(
      <MemoryRouter>
        <MessengerInboxDropdown />
      </MemoryRouter>
    );

    await browser.click(screen.getByRole("tab", { name: "Groups" }));
    expect(await screen.findByText("Groups service unavailable")).toBeInTheDocument();
  });
});
