import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import MessagesPage from "../MessagesPage";

vi.mock("../../Navbar", () => ({
  default: () => <div data-testid="navbar" />,
}));

vi.mock("../../Sidebar", () => ({
  default: () => <div data-testid="sidebar" />,
}));

vi.mock("../../Messenger", () => ({
  default: ({ initialSelectedId, autoSelectFirstConversation, onSelectedConversationChange }) => (
    <div
      data-testid="messenger"
      data-selected={initialSelectedId}
      data-auto-select={String(autoSelectFirstConversation)}
    >
      <button
        type="button"
        onClick={() => onSelectedConversationChange?.("chat-2")}
      >
        Select chat
      </button>
    </div>
  ),
}));

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location-search">{location.search}</output>;
}

describe("MessagesPage", () => {
  it("keeps the selected chat in sync with the URL query string", async () => {
    render(
      <MemoryRouter initialEntries={["/messages?chat=chat-1"]}>
        <MessagesPage user={{ _id: "user-1", username: "viewer_user" }} />
        <LocationProbe />
      </MemoryRouter>
    );

    expect(screen.getByTestId("navbar")).toBeInTheDocument();
    expect(screen.getByTestId("sidebar")).toBeInTheDocument();
    expect(screen.getByTestId("messenger")).toHaveAttribute("data-selected", "chat-1");
    expect(screen.getByTestId("messenger")).toHaveAttribute("data-auto-select", "false");
    expect(screen.getByTestId("location-search")).toHaveTextContent("?chat=chat-1");

    fireEvent.click(screen.getByRole("button", { name: /select chat/i }));

    await waitFor(() => {
      expect(screen.getByTestId("location-search")).toHaveTextContent("?chat=chat-2");
    });
  });
});
