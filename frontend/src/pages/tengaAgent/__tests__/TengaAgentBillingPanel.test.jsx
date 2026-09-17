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
  getBillingMock,
  redirectMock,
  startCheckoutMock,
  verifyCheckoutMock,
} = vi.hoisted(() => ({
  getBillingMock: vi.fn(),
  redirectMock: vi.fn(),
  startCheckoutMock: vi.fn(),
  verifyCheckoutMock: vi.fn(),
}));

vi.mock(
  "../../../services/tengaAgentBillingApi",
  () => ({
    getTengaAgentOwnerBilling: (...args) =>
      getBillingMock(...args),
    redirectToTengaAgentCheckout: (...args) =>
      redirectMock(...args),
    startTengaAgentPlanCheckout: (...args) =>
      startCheckoutMock(...args),
    verifyTengaAgentPlanCheckout: (...args) =>
      verifyCheckoutMock(...args),
  })
);

import TengaAgentBillingPanel from "../TengaAgentBillingPanel";

const RESPONSE = {
  ok: true,
  billing: {
    allowed: true,
    planCode: "growth",
    subscriptionStatus: "active",
    billingProvider: "paystack",
    renewalMode: "prepaid",
    currentPeriodEnd: "2026-10-17T12:00:00.000Z",
    expired: false,
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
    window.history.replaceState({}, "", "/tengaagent");
    getBillingMock.mockResolvedValue(RESPONSE);
    startCheckoutMock.mockResolvedValue({
      ok: true,
      billingMode: "prepaid_30_day",
      checkout: {
        planCode: "starter",
        provider: "paystack",
        currency: "NGN",
        amount: 19900,
        reference: "tengaagent-starter-ref",
        status: "pending",
        checkoutUrl: "https://checkout.example/paystack",
      },
    });
    verifyCheckoutMock.mockResolvedValue({
      ok: true,
      billingMode: "prepaid_30_day",
      checkout: {
        reference: "tengaagent-starter-ref",
        status: "paid",
      },
    });
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
    expect(
      screen.getByText(/Paid access through:/i)
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

  it("starts a prepaid Paystack checkout from the owner dashboard", async () => {
    const user = userEvent.setup();

    render(
      <TengaAgentBillingPanel
        user={{ _id: "owner-1" }}
      />
    );

    await screen.findByText(/growth · active/i);
    const checkoutButton = screen.getByRole("button", {
      name: /pay.*19,900/i,
    });

    await user.click(checkoutButton);

    await waitFor(() => {
      expect(startCheckoutMock).toHaveBeenCalledWith({
        planCode: "starter",
        currency: "NGN",
      });
    });
    expect(redirectMock).toHaveBeenCalledWith(
      "https://checkout.example/paystack"
    );
  });

  it("verifies a provider return and refreshes the paid billing period", async () => {
    window.history.replaceState(
      {},
      "",
      "/tengaagent?billing=return&provider=paystack&reference=tengaagent-starter-ref"
    );

    render(
      <TengaAgentBillingPanel
        user={{ _id: "owner-1" }}
      />
    );

    await waitFor(() => {
      expect(verifyCheckoutMock).toHaveBeenCalledWith(
        "tengaagent-starter-ref"
      );
    });
    await waitFor(() => {
      expect(getBillingMock).toHaveBeenCalledTimes(2);
    });

    expect(
      await screen.findByText(/payment verified/i)
    ).toBeInTheDocument();
    expect(window.location.search).toBe("");
  });
});
