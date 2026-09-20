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
  getConnectionsMock,
  startConnectionMock,
  completeConnectionMock,
  disconnectConnectionMock,
} = vi.hoisted(() => ({
  getConnectionsMock: vi.fn(),
  startConnectionMock: vi.fn(),
  completeConnectionMock: vi.fn(),
  disconnectConnectionMock: vi.fn(),
}));

vi.mock(
  "../../../services/tengaAgentCalendarApi",
  () => ({
    getTengaAgentCalendarConnections: (...args) =>
      getConnectionsMock(...args),
    startTengaAgentCalendarConnection: (...args) =>
      startConnectionMock(...args),
    completeTengaAgentCalendarConnection: (...args) =>
      completeConnectionMock(...args),
    disconnectTengaAgentCalendarConnection: (...args) =>
      disconnectConnectionMock(...args),
  })
);

import TengaAgentCalendarConnections from "../TengaAgentCalendarConnections";

const DISCONNECTED_PROVIDERS = [
  {
    provider: "google",
    label: "Google Calendar",
    configured: false,
    connected: false,
    connection: null,
  },
  {
    provider: "microsoft",
    label: "Microsoft Outlook",
    configured: false,
    connected: false,
    connection: null,
  },
];

describe("TengaAgentCalendarConnections", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState({}, "", "/tengaagent");
  });

  it("shows provider setup state without exposing OAuth secrets", async () => {
    getConnectionsMock.mockResolvedValue({
      ok: true,
      providers: DISCONNECTED_PROVIDERS,
    });

    render(<TengaAgentCalendarConnections />);

    expect(
      await screen.findByText("Google Calendar")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Microsoft Outlook")
    ).toBeInTheDocument();
    expect(
      screen.getAllByText("Admin setup required")
    ).toHaveLength(2);
    expect(
      screen.getByRole("button", {
        name: /connect google calendar/i,
      })
    ).toBeDisabled();
    expect(
      screen.getByRole("button", {
        name: /connect microsoft outlook/i,
      })
    ).toBeDisabled();
    expect(
      screen.getByText(/oauth tokens stay encrypted on the server/i)
    ).toBeInTheDocument();
  });

  it("keeps an errored provider connected until the owner disconnects it", async () => {
    const user = userEvent.setup();

    getConnectionsMock
      .mockResolvedValueOnce({
        ok: true,
        providers: [
          {
            provider: "google",
            label: "Google Calendar",
            configured: true,
            connected: true,
            connection: {
              provider: "google",
              status: "error",
              displayName: "Google Calendar",
              lastError:
                "Calendar provider authorization must be refreshed.",
              lastSyncedAt: null,
            },
          },
          DISCONNECTED_PROVIDERS[1],
        ],
      })
      .mockResolvedValueOnce({
        ok: true,
        providers: DISCONNECTED_PROVIDERS,
      });

    disconnectConnectionMock.mockResolvedValue({
      ok: true,
      provider: "google",
      disconnected: true,
    });

    render(<TengaAgentCalendarConnections />);

    expect(
      await screen.findByText("Needs attention")
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Calendar provider authorization must be refreshed."
      )
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", {
        name: /disconnect/i,
      })
    );

    await waitFor(() => {
      expect(
        disconnectConnectionMock
      ).toHaveBeenCalledWith("google");
    });

    expect(
      await screen.findByText(/calendar disconnected/i)
    ).toBeInTheDocument();
  });
});
