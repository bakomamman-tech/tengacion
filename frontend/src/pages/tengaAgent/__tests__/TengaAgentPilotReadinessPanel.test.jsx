import React from "react";
import {
  render,
  screen,
} from "@testing-library/react";
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const readinessMock = vi.fn();

vi.mock(
  "../../../services/tengaAgentApi",
  () => ({
    getTengaAgentOwnerPilotReadiness: (...args) =>
      readinessMock(...args),
  })
);

import TengaAgentPilotReadinessPanel from "../TengaAgentPilotReadinessPanel";

const USER = { _id: "owner-1" };

beforeEach(() => {
  vi.clearAllMocks();
  readinessMock.mockResolvedValue({
    ok: true,
    readiness: {
      checks: {
        workspace: true,
        subscription: true,
        hasAgent: true,
        hasPublishedAgent: true,
        coreEnvironment: true,
        whatsappEnvironment: false,
        whatsappTenantConnection: false,
        voiceEnvironment: false,
      },
      channelReady: {
        web: true,
        whatsapp: false,
        voiceNotes: false,
      },
      billing: {
        entitlements: {
          monthlyConversations: 300,
        },
        usage: {
          conversationsStarted: 17,
        },
      },
    },
  });
});

describe("TengaAgentPilotReadinessPanel", () => {
  it("shows channel readiness without rendering credential values", async () => {
    render(<TengaAgentPilotReadinessPanel user={USER} />);

    expect(
      await screen.findByText("Deployment and channel readiness")
    ).toBeInTheDocument();

    expect(screen.getByText("17 / 300")).toBeInTheDocument();
    expect(screen.getByText("Web pilot")).toBeInTheDocument();
    expect(screen.getByText("WhatsApp")).toBeInTheDocument();
    expect(screen.getByText("Voice notes")).toBeInTheDocument();
    expect(screen.getAllByText("Blocked")).toHaveLength(2);
    expect(
      screen.getByText(/No API keys, tokens, secrets/i)
    ).toBeInTheDocument();
  });
});
