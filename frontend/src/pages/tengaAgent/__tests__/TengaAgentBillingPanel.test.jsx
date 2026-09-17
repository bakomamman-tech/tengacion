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

const { getBillingMock } = vi.hoisted(() => ({
  getBillingMock: vi.fn(),
}));

vi.mock(
  "../../../services/tengaAgentBillingApi",
  () => ({
    getTengaAgentOwnerBilling: (...args) =>
      getBillingMock(...args),
  })
);

import TengaAgentBillingPanel from "../TengaAgentBillingPanel";

const RESPONSE = {
  ok: true,
  billing: {
    allowed: true,
    planCode: "growth",
    subscriptionStatus: "active",
    entitlements: {
      agents: 3,
      monthlyConversations: 1500,
      whatsapp: true,
      voice: true,
    },
    usage: {
      periodKey: "2026-09",
      conversationsStarted: 125,
      conversationsRemaining: 1375,
      customerMessages: 420,
      aiReplies: 390,
      whatsappInboundMessages: 80,
      whatsappOutboundMessages: 75,
      voiceNotes: 12,
      agentsUsed: 1,
    },
  },
};

describe("TengaAgentBillingPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getBillingMock.mockResolvedValue(RESPONSE);
  });

  it("shows the enforced plan, usage, and channel entitlements", async () => {
    render(
      <TengaAgentBillingPanel
        user={{ _id: "owner-1" }}
      />
    );

    expect(
      await screen.findByText(/growth · active/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Conversations: 125 \/ 1,500/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Agents: 1 \/ 3/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/WhatsApp: included/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Voice notes: included/i)
    ).toBeInTheDocument();
  });

  it("refreshes the usage snapshot on demand", async () => {
    const user = userEvent.setup();

    render(
      <TengaAgentBillingPanel
        user={{ _id: "owner-1" }}
      />
    );

    const button = await screen.findByRole("button", {
      name: /refresh usage/i,
    });

    await user.click(button);

    await waitFor(() => {
      expect(getBillingMock).toHaveBeenCalledTimes(2);
    });
  });
});
