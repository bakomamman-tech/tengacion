import React from "react";
import {
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const {
  listMock,
  detailMock,
  actionMock,
  sendMock,
} = vi.hoisted(() => ({
  listMock: vi.fn(),
  detailMock: vi.fn(),
  actionMock: vi.fn(),
  sendMock: vi.fn(),
}));

vi.mock(
  "../../../services/tengaAgentApi",
  () => ({
    getTengaAgentOwnerConversations: (...args) =>
      listMock(...args),
    getTengaAgentOwnerConversation: (...args) =>
      detailMock(...args),
    updateTengaAgentOwnerConversationAction: (...args) =>
      actionMock(...args),
    sendTengaAgentOwnerHumanMessage: (...args) =>
      sendMock(...args),
  })
);

import TengaAgentHandoffInbox from "../TengaAgentHandoffInbox";

const SUMMARY = {
  id: "conversation-1",
  status: "handoff_requested",
  channel: "web",
  assignedToUser: null,
  lastMessageAt: "2026-09-16T15:00:00.000Z",
  lastMessage: {
    id: "message-1",
    sender: "customer",
    content: "I need a human to help me.",
    createdAt: "2026-09-16T15:00:00.000Z",
  },
  lead: {
    id: "lead-1",
    name: "Ada Visitor",
    email: "ada@example.com",
    projectSummary: "Needs help choosing a plan.",
  },
  appointment: null,
};

const detailFor = (status, assignedToUser = null) => ({
  ok: true,
  conversation: {
    ...SUMMARY,
    status,
    assignedToUser,
  },
  messages: [
    {
      id: "message-1",
      sender: "customer",
      content: "I need a human to help me.",
      createdAt: "2026-09-16T15:00:00.000Z",
    },
    ...(status === "human_active"
      ? [
          {
            id: "message-2",
            sender: "human",
            content: "Hello, I can help you now.",
            createdAt: "2026-09-16T15:01:00.000Z",
          },
        ]
      : []),
  ],
});

describe("TengaAgentHandoffInbox", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listMock.mockResolvedValue({
      ok: true,
      conversations: [SUMMARY],
    });
    detailMock.mockResolvedValue(
      detailFor("handoff_requested")
    );
  });

  it("loads the handoff queue and opens the tenant transcript", async () => {
    const user = userEvent.setup();

    render(<TengaAgentHandoffInbox />);

    expect(
      await screen.findByText("Ada Visitor")
    ).toBeInTheDocument();
    expect(
      screen.getByText("I need a human to help me.")
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", {
        name: /ada visitor/i,
      })
    );

    await waitFor(() => {
      expect(detailMock).toHaveBeenCalledWith({
        conversationId: "conversation-1",
      });
    });

    expect(
      await screen.findByText("Needs help choosing a plan.")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^claim$/i })
    ).toBeInTheDocument();
  });

  it("claims a conversation before sending a human reply", async () => {
    const user = userEvent.setup();

    detailMock
      .mockResolvedValueOnce(
        detailFor("handoff_requested")
      )
      .mockResolvedValue(
        detailFor("human_active", "user-owner-1")
      );

    actionMock.mockResolvedValue({
      ok: true,
      conversation: {
        ...SUMMARY,
        status: "human_active",
        assignedToUser: "user-owner-1",
      },
    });

    sendMock.mockResolvedValue({
      ok: true,
      conversation: {
        ...SUMMARY,
        status: "human_active",
        assignedToUser: "user-owner-1",
      },
      message: {
        id: "human-new",
        sender: "human",
        content: "I will check that for you.",
      },
    });

    render(<TengaAgentHandoffInbox />);

    await user.click(
      await screen.findByRole("button", {
        name: /ada visitor/i,
      })
    );

    await user.click(
      await screen.findByRole("button", {
        name: /^claim$/i,
      })
    );

    await waitFor(() => {
      expect(actionMock).toHaveBeenCalledWith({
        conversationId: "conversation-1",
        action: "claim",
      });
    });

    const reply = await screen.findByLabelText(
      /human reply/i
    );
    await user.type(reply, "I will check that for you.");
    await user.click(
      screen.getByRole("button", {
        name: /send human reply/i,
      })
    );

    await waitFor(() => {
      expect(sendMock).toHaveBeenCalledWith({
        conversationId: "conversation-1",
        content: "I will check that for you.",
      });
    });
  });
});
