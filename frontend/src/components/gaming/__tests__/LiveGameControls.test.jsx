import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ChessRoom from "../ChessRoom";
import MemoryAtlas from "../MemoryAtlas";
import MushroomRun from "../MushroomRun";
import SnakeXavia from "../SnakeXavia";
import TengacionRacer from "../TengacionRacer";
import Tengacion2048 from "../Tengacion2048";
import TengacionTetris from "../TengacionTetris";

const LIVE_GAMES = [
  {
    name: "2048",
    Component: Tengacion2048,
    controlsName: /2048 play controls/i,
    surfaceSelector: ".game-2048-board-shell",
  },
  {
    name: "Snake Xavia",
    Component: SnakeXavia,
    controlsName: /snake xavia play controls/i,
    surfaceSelector: ".game-snake-board-shell",
  },
  {
    name: "Mushroom Run",
    Component: MushroomRun,
    controlsName: /mushroom run play controls/i,
    surfaceSelector: ".game-mushroom-canvas-shell",
  },
  {
    name: "Tengacion Racer",
    Component: TengacionRacer,
    controlsName: /tengacion racer play controls/i,
    surfaceSelector: ".game-racer-canvas-shell",
  },
  {
    name: "Tetris",
    Component: TengacionTetris,
    controlsName: /tetris play controls/i,
    surfaceSelector: ".game-tetris-board-shell",
  },
  {
    name: "Chess Room",
    Component: ChessRoom,
    controlsName: /chess room match controls/i,
    surfaceSelector: ".game-chess-board-shell",
  },
  {
    name: "Memory Atlas",
    Component: MemoryAtlas,
    controlsName: /memory atlas controls/i,
    surfaceSelector: ".game-memory-board-shell",
  },
];

describe("live game control placement", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(window, "requestAnimationFrame").mockImplementation(() => 1);
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => null);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it.each(LIVE_GAMES)(
    "$name keeps its controls before the active play surface",
    ({ Component, controlsName, surfaceSelector }) => {
      const { container } = render(React.createElement(Component));
      const controls = screen.getByRole("region", { name: controlsName });
      const surface = container.querySelector(surfaceSelector);

      expect(surface).toBeInTheDocument();
      expect(controls.closest(".game-live-play-column")).toContainElement(surface);
      expect(
        controls.compareDocumentPosition(surface) & Node.DOCUMENT_POSITION_FOLLOWING
      ).toBeTruthy();
    }
  );
});
