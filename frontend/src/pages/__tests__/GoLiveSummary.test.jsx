import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import GoLive from "../GoLive";
import { getLiveConfig, startLiveSession } from "../../api";
import { createLocalAudioTrack, createLocalVideoTrack } from "livekit-client";

const { roomInstance, videoTrack, audioTrack } = vi.hoisted(() => ({
  roomInstance: {
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn(),
    on: vi.fn(),
    localParticipant: {
      publishTrack: vi.fn().mockResolvedValue(undefined),
      setScreenShareEnabled: vi.fn().mockResolvedValue(undefined),
    },
  },
  videoTrack: {
    attach: vi.fn(),
    detach: vi.fn(),
    stop: vi.fn(),
    mute: vi.fn().mockResolvedValue(undefined),
    unmute: vi.fn().mockResolvedValue(undefined),
  },
  audioTrack: {
    detach: vi.fn(),
    stop: vi.fn(),
    mute: vi.fn().mockResolvedValue(undefined),
    unmute: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("../../api", () => ({
  getLiveConfig: vi.fn(),
  startLiveSession: vi.fn(),
  endLiveSession: vi.fn(),
}));

vi.mock("../../context/AuthContext", () => ({
  useAuth: () => ({
    user: {
      _id: "host-1",
      name: "Admin User",
      username: "admin",
    },
  }),
}));

vi.mock("../../socket", () => ({
  connectSocket: () => ({
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
  }),
}));

vi.mock("../../livekitConfig", () => ({
  resolveLivekitWsUrl: () => "wss://example.livekit.test",
}));

vi.mock("livekit-client", () => ({
  RoomEvent: {
    Reconnecting: "reconnecting",
    Reconnected: "reconnected",
    Disconnected: "disconnected",
    MediaDevicesError: "mediaDevicesError",
  },
  Room: class {
    constructor() {
      return roomInstance;
    }
  },
  createLocalAudioTrack: vi.fn().mockResolvedValue(audioTrack),
  createLocalVideoTrack: vi.fn().mockResolvedValue(videoTrack),
}));

vi.mock("../../components/live/LiveControlsBar", () => ({
  default: () => <div data-testid="live-controls-bar" />,
}));

vi.mock("../../components/live/LiveChatDrawer", () => ({
  default: () => null,
}));

describe("GoLive summary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    roomInstance.on.mockReturnValue(roomInstance);
    vi.mocked(createLocalAudioTrack).mockResolvedValue(audioTrack);
    vi.mocked(createLocalVideoTrack).mockResolvedValue(videoTrack);

    vi.mocked(getLiveConfig).mockResolvedValue({
      livekitUrl: "wss://example.livekit.test",
    });
    vi.mocked(startLiveSession).mockResolvedValue({
      session: {
        roomName: "room-1",
        title: "Morning Live",
        viewerCount: 12,
        startedAt: new Date().toISOString(),
        host: {
          name: "Admin User",
          username: "admin",
        },
      },
      token: "token-123",
      livekit: {
        url: "wss://example.livekit.test",
      },
    });
  });

  it("shows a live report summary after the stream starts", async () => {
    render(
      <MemoryRouter initialEntries={["/live/go"]}>
        <GoLive />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /start live stream/i })).not.toBeDisabled();
    });

    fireEvent.change(screen.getByPlaceholderText(/share what you're about to do/i), {
      target: { value: "Morning Live" },
    });

    fireEvent.click(screen.getByRole("button", { name: /start live stream/i }));

    await screen.findByText(/live report summary/i);

    const summaryCard = screen.getByText(/live report summary/i).closest(".go-live-report");
    expect(summaryCard).not.toBeNull();

    const summaryScope = within(summaryCard);

    expect(summaryScope.getByText("Morning Live")).toBeInTheDocument();
    expect(summaryScope.getByText("12", { exact: true })).toBeInTheDocument();
    expect(summaryScope.getByText(/viewers now/i)).toBeInTheDocument();
    expect(summaryScope.getByText(/messages received/i)).toBeInTheDocument();
    expect(screen.getByTestId("live-controls-bar")).toBeInTheDocument();

    await waitFor(() => {
      expect(startLiveSession).toHaveBeenCalledWith("Morning Live");
    });
  }, 15000);

  it("shows unlimited access for an admin", async () => {
    vi.mocked(getLiveConfig).mockResolvedValue({
      livekitUrl: "wss://example.livekit.test",
      liveAccess: {
        canPublish: true,
        quotaExempt: true,
      },
      quota: {
        unlimited: true,
        canGoLive: true,
      },
    });

    render(
      <MemoryRouter initialEntries={["/live/go"]}>
        <GoLive />
      </MemoryRouter>
    );

    expect(await screen.findByText(/unlimited · go live at any time/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /start live stream/i })).not.toBeDisabled();
  });

  it("continues with video when the microphone is unavailable", async () => {
    vi.mocked(createLocalAudioTrack).mockRejectedValueOnce(new Error("Microphone denied"));

    render(
      <MemoryRouter initialEntries={["/live/go"]}>
        <GoLive />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /start live stream/i })).not.toBeDisabled();
    });
    fireEvent.click(screen.getByRole("button", { name: /start live stream/i }));

    expect(await screen.findByText(/continuing with video only/i)).toBeInTheDocument();
    expect(roomInstance.localParticipant.publishTrack).toHaveBeenCalledWith(videoTrack);
    expect(roomInstance.localParticipant.publishTrack).not.toHaveBeenCalledWith(audioTrack);
    expect(screen.getByText("Connected")).toBeInTheDocument();
  });
});
