import React from "react";
import { MemoryRouter } from "react-router-dom";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  connectSocketMock,
  getDiscoveryLiveMock,
  getLiveSessionsMock,
  navigateMock,
  trackDiscoveryEventsMock,
} = vi.hoisted(() => ({
  connectSocketMock: vi.fn(),
  getDiscoveryLiveMock: vi.fn(),
  getLiveSessionsMock: vi.fn(),
  navigateMock: vi.fn(),
  trackDiscoveryEventsMock: vi.fn(),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock("../../context/AuthContext", () => ({
  useAuth: () => ({
    user: {
      _id: "viewer-1",
      username: "viewer",
    },
  }),
}));

vi.mock("../../socket", () => ({
  connectSocket: connectSocketMock,
}));

vi.mock("../../api", () => ({
  getDiscoveryLive: getDiscoveryLiveMock,
  getLiveSessions: getLiveSessionsMock,
  trackDiscoveryEvents: trackDiscoveryEventsMock,
}));

import LiveDirectory from "../LiveDirectory";

const socketStub = {
  on: vi.fn(),
  off: vi.fn(),
};

const renderLiveDirectory = () =>
  render(
    <MemoryRouter initialEntries={["/live"]}>
      <LiveDirectory />
    </MemoryRouter>
  );

describe("LiveDirectory discovery ranking", () => {
  beforeEach(() => {
    connectSocketMock.mockReturnValue(socketStub);
    getDiscoveryLiveMock.mockReset();
    getLiveSessionsMock.mockReset();
    navigateMock.mockReset();
    socketStub.on.mockClear();
    socketStub.off.mockClear();
    trackDiscoveryEventsMock.mockReset();
    trackDiscoveryEventsMock.mockResolvedValue({ accepted: 1 });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("loads ranked live sessions from discovery and tracks watch clicks", async () => {
    const user = userEvent.setup();
    getDiscoveryLiveMock.mockResolvedValue({
      requestId: "rec-live-1",
      surface: "live",
      items: [
        {
          id: "live-1",
          entityType: "live",
          rank: 1,
          reason: "following_connection",
          reasonLabel: "From a creator you follow",
          creatorId: "creator-1",
          authorUserId: "host-1",
          payload: {
            id: "live-1",
            roomName: "studio-session",
            title: "Studio session",
            viewerCount: 8,
            startedAt: "2026-05-13T10:00:00.000Z",
            host: {
              userId: "host-1",
              name: "Creator One",
              username: "creator_one",
            },
          },
        },
      ],
    });

    renderLiveDirectory();

    expect(await screen.findByText("Studio session")).toBeInTheDocument();
    expect(screen.getByText("From a creator you follow")).toBeInTheDocument();
    expect(getDiscoveryLiveMock).toHaveBeenCalledWith({ limit: 24 });
    expect(getLiveSessionsMock).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /watch live/i }));

    expect(trackDiscoveryEventsMock).toHaveBeenCalledWith({
      requestId: "rec-live-1",
      surface: "live",
      events: [
        expect.objectContaining({
          type: "live_joined",
          entityType: "live",
          entityId: "live-1",
          position: 1,
        }),
      ],
    });
    expect(navigateMock).toHaveBeenCalledWith("/live/watch/studio-session");
  });

  it("falls back to active live sessions when discovery is unavailable", async () => {
    getDiscoveryLiveMock.mockRejectedValue(new Error("discovery unavailable"));
    getLiveSessionsMock.mockResolvedValue({
      sessions: [
        {
          id: "legacy-live-1",
          roomName: "legacy-room",
          title: "Legacy room",
          viewerCount: 3,
          startedAt: "2026-05-13T11:00:00.000Z",
          host: {
            userId: "host-2",
            name: "Legacy Creator",
            username: "legacy_creator",
          },
        },
      ],
    });

    renderLiveDirectory();

    expect(await screen.findByText("Legacy room")).toBeInTheDocument();

    await waitFor(() => {
      expect(getLiveSessionsMock).toHaveBeenCalledTimes(1);
    });
    expect(screen.queryByText("From a creator you follow")).not.toBeInTheDocument();
  });
});
