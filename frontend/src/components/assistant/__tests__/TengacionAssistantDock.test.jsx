import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

const navigateMock = vi.hoisted(() => vi.fn());
const sendAssistantMessageMock = vi.hoisted(() => vi.fn());

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock("../../../context/AuthContext", () => ({
  useAuth: () => ({
    user: {
      id: "user-1",
      username: "viewer_user",
    },
    loading: false,
  }),
}));

vi.mock("../../../services/assistantApi", () => ({
  sendAssistantMessage: (...args) => sendAssistantMessageMock(...args),
}));

import TengacionAssistantDock from "../TengacionAssistantDock";

describe("TengacionAssistantDock", () => {
  it("opens the panel and navigates when Akuso returns a safe navigate action", async () => {
    const user = userEvent.setup();
    sendAssistantMessageMock.mockResolvedValue({
      message: "Opening your messages.",
      actions: [
        {
          type: "navigate",
          target: "/messages",
          state: { openMessenger: true },
        },
      ],
      cards: [],
      requiresConfirmation: false,
      pendingAction: null,
      conversationId: "conversation-1",
    });

    render(
      <MemoryRouter>
        <TengacionAssistantDock />
      </MemoryRouter>
    );

    await user.click(screen.getByRole("button", { name: /open akuso assistant/i }));
    const composer = await screen.findByRole("textbox", { name: /message akuso/i });
    await user.type(composer, "Take me to messages");
    await user.click(screen.getByRole("button", { name: /send/i }));

    await waitFor(() => {
      expect(sendAssistantMessageMock).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Take me to messages",
        })
      );
    });

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith(
        "/messages",
        expect.objectContaining({
          state: {
            openMessenger: true,
          },
        })
      );
    });
  });
});
