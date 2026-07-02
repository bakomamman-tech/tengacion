import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import LiveControlsBar from "./LiveControlsBar";

const renderControls = (overrides = {}) => {
  const props = {
    session: { title: "Morning live" },
    viewerCount: 4,
    hostName: "Admin User",
    elapsedSec: 75,
    micEnabled: true,
    cameraEnabled: true,
    screenShareEnabled: false,
    onToggleMic: vi.fn(),
    onToggleCamera: vi.fn(),
    onToggleScreenShare: vi.fn(),
    filter: "none",
    blurEnabled: false,
    onChangeFilter: vi.fn(),
    onToggleBlur: vi.fn(),
    onReact: vi.fn(),
    onToggleChat: vi.fn(),
    isChatOpen: false,
    onEndLive: vi.fn(),
    participants: ["Admin User"],
    ...overrides,
  };

  render(<LiveControlsBar {...props} />);
  return props;
};

describe("LiveControlsBar", () => {
  it("provides Meet-style accessible media controls", () => {
    renderControls();

    expect(screen.getByRole("button", { name: "Mute microphone" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Turn off camera" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Share screen" })).toBeInTheDocument();
  });

  it("starts screen sharing from the Present control", () => {
    const props = renderControls();

    fireEvent.click(screen.getByRole("button", { name: "Share screen" }));
    expect(props.onToggleScreenShare).toHaveBeenCalledTimes(1);
  });
});
