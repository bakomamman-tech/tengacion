import { describe, expect, it, vi } from "vitest";

import {
  executeAssistantActions,
  isSafeAssistantRoute,
} from "../assistantActionExecutor";

describe("assistantActionExecutor", () => {
  it("accepts safe internal routes and rejects external URLs", () => {
    expect(isSafeAssistantRoute("/messages")).toBe(true);
    expect(isSafeAssistantRoute("/creator/music/upload")).toBe(true);
    expect(isSafeAssistantRoute("https://example.com")).toBe(false);
    expect(isSafeAssistantRoute("/../../secret")).toBe(false);
  });

  it("executes safe navigate actions through the provided navigator", () => {
    const navigate = vi.fn();

    const outcomes = executeAssistantActions(
      [
        {
          type: "navigate",
          target: "/messages",
          state: { openMessenger: true },
        },
      ],
      { navigate }
    );

    expect(navigate).toHaveBeenCalledWith(
      "/messages",
      { openMessenger: true },
      expect.objectContaining({
        type: "navigate",
        target: "/messages",
      })
    );
    expect(outcomes).toEqual([
      expect.objectContaining({
        executed: true,
      }),
    ]);
  });

  it("blocks unsafe routes", () => {
    const navigate = vi.fn();

    const outcomes = executeAssistantActions(
      [
        {
          type: "navigate",
          target: "https://example.com",
        },
      ],
      { navigate }
    );

    expect(navigate).not.toHaveBeenCalled();
    expect(outcomes).toEqual([
      expect.objectContaining({
        executed: false,
        reason: "unsafe_route",
      }),
    ]);
  });
});

