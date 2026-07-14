import React from "react";
import { MemoryRouter } from "react-router-dom";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const navigateMock = vi.fn();
const scrollIntoViewMock = vi.fn();
const originalScrollIntoView = Object.getOwnPropertyDescriptor(
  Element.prototype,
  "scrollIntoView"
);

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");

  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock("../../Navbar", () => ({
  default: () => <nav aria-label="Primary navigation" />,
}));

vi.mock("../../components/gaming/ChessRoom", () => ({
  default: () => <div data-testid="game-chess-room" />,
}));

vi.mock("../../components/gaming/BlockDrop", () => ({
  default: () => <div data-testid="game-block-drop" />,
}));

vi.mock("../../components/gaming/MemoryAtlas", () => ({
  default: () => <div data-testid="game-memory-atlas" />,
}));

vi.mock("../../components/gaming/MushroomRun", () => ({
  default: () => <div data-testid="game-mushroom-run" />,
}));

vi.mock("../../components/gaming/NightRaid", () => ({
  default: () => <div data-testid="game-night-raid" />,
}));

vi.mock("../../components/gaming/TengacionRacer", () => ({
  default: () => <div data-testid="game-tengacion-racer" />,
}));

vi.mock("../../components/gaming/Tengacion2048", () => ({
  default: () => <div data-testid="game-2048-classic" />,
}));

vi.mock("../../components/gaming/SnakeXavia", () => ({
  default: () => <div data-testid="game-snake-xavia" />,
}));

vi.mock("../../components/gaming/TengacionTetris", () => ({
  default: () => <div data-testid="game-tengacion-tetris" />,
}));

vi.mock("../../components/gaming/WordSprint", () => ({
  default: () => <div data-testid="game-word-sprint" />,
}));

import GamingPage from "../GamingPage";

const viewer = {
  _id: "viewer-1",
  name: "Gaming Viewer",
  username: "gaming_viewer",
  avatar: "",
};

const renderGamingPage = () =>
  render(
    <MemoryRouter initialEntries={["/gaming"]}>
      <GamingPage user={viewer} />
    </MemoryRouter>
  );

describe("Gaming page", () => {
  beforeEach(() => {
    window.localStorage.clear();
    navigateMock.mockReset();
    scrollIntoViewMock.mockReset();

    Object.defineProperty(Element.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoViewMock,
    });

    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      callback(0);
      return 1;
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();

    if (originalScrollIntoView) {
      Object.defineProperty(Element.prototype, "scrollIntoView", originalScrollIntoView);
    } else {
      delete Element.prototype.scrollIntoView;
    }
  });

  it("exposes the game room landmarks and opens Tengacion Racer by default", () => {
    renderGamingPage();

    const main = screen.getByRole("main", {
      name: "Choose your lane. Keep your streak.",
    });

    expect(main).toBeInTheDocument();
    expect(
      within(main).getByRole("heading", {
        level: 1,
        name: "Choose your lane. Keep your streak.",
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("complementary", { name: "Game library controls" })
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Skip to games" })).toHaveAttribute(
      "href",
      "#gaming-main"
    );
    expect(screen.getByTestId("game-tengacion-racer")).toBeInTheDocument();
    expect(
      within(screen.getByRole("navigation", { name: "Gaming sections" })).getByRole(
        "button",
        { name: /^Play games/ }
      )
    ).toHaveAttribute("aria-current", "page");
  });

  it("combines search and category filters and restores the full library", async () => {
    const user = userEvent.setup();
    renderGamingPage();

    const search = screen.getByRole("searchbox", { name: "Search library" });
    const library = screen.getByRole("region", { name: "Pick your next lane" });
    const categories = screen.getByRole("group", { name: "Game categories" });

    await user.type(search, "atlas");

    expect(await screen.findByText("1 game ready")).toBeInTheDocument();
    expect(
      within(library).getByRole("button", { name: /Memory Atlas/i })
    ).toBeInTheDocument();
    expect(within(library).queryByRole("button", { name: /Tengacion Racer/i })).toBeNull();

    await user.click(within(categories).getByRole("button", { name: "Racing" }));

    expect(
      await within(library).findByRole("heading", { name: "No games matched that search" })
    ).toBeInTheDocument();
    expect(screen.getByText("0 games ready in Racing")).toBeInTheDocument();

    await user.click(within(library).getByRole("button", { name: "Clear filters" }));

    await waitFor(() => {
      expect(search).toHaveValue("");
      expect(within(categories).getByRole("button", { name: "All" })).toHaveAttribute(
        "aria-pressed",
        "true"
      );
      expect(within(library).getAllByRole("button")).toHaveLength(17);
    });
    expect(screen.getByText("10 games ready")).toBeInTheDocument();
  });

  it("selects a library game, swaps the live component, and focuses the play deck", async () => {
    const user = userEvent.setup();
    renderGamingPage();

    const library = screen.getByRole("region", { name: "Pick your next lane" });
    const gameCard = library.querySelector('[data-game-id="2048-classic"]');

    expect(gameCard).toBeInTheDocument();
    await user.click(gameCard);

    expect(await screen.findByTestId("game-2048-classic")).toBeInTheDocument();
    expect(screen.queryByTestId("game-tengacion-racer")).not.toBeInTheDocument();
    expect(gameCard).toHaveAttribute("aria-pressed", "true");
    expect(scrollIntoViewMock).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "start",
    });
  });

  it("persists a saved game and reopens it from the Saved games view", async () => {
    const user = userEvent.setup();
    renderGamingPage();

    const playDeck = screen.getByRole("region", { name: "Tengacion Racer" });
    await user.click(within(playDeck).getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(JSON.parse(window.localStorage.getItem("tengacion.gaming.saved"))).toEqual([
        "2048-classic",
        "tengacion-racer",
      ]);
    });

    const sectionNav = screen.getByRole("navigation", { name: "Gaming sections" });
    await user.click(within(sectionNav).getByRole("button", { name: /^Saved games/ }));

    const savedHeading = await screen.findByRole("heading", {
      level: 1,
      name: "Ready when you are.",
    });
    const main = savedHeading.closest("main");

    expect(main).toBeInTheDocument();
    await user.click(within(main).getByRole("button", { name: /Tengacion Racer/i }));

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Choose your lane. Keep your streak.",
      })
    ).toBeInTheDocument();
    expect(screen.getByTestId("game-tengacion-racer")).toBeInTheDocument();
  });

  it("keeps an intentionally empty saved-games collection empty", async () => {
    const user = userEvent.setup();
    window.localStorage.setItem("tengacion.gaming.saved", "[]");

    renderGamingPage();

    const sectionNav = screen.getByRole("navigation", { name: "Gaming sections" });
    await user.click(within(sectionNav).getByRole("button", { name: /^Saved games/ }));

    expect(
      await screen.findByRole("heading", {
        level: 3,
        name: "No saved games yet",
      })
    ).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem("tengacion.gaming.saved"))).toEqual([]);
  });

  it("persists the opened game and restores it on a fresh render", async () => {
    const user = userEvent.setup();
    const firstRender = renderGamingPage();
    const library = screen.getByRole("region", { name: "Pick your next lane" });
    const gameCard = library.querySelector('[data-game-id="memory-atlas"]');

    expect(gameCard).toBeInTheDocument();
    await user.click(gameCard);

    await waitFor(() => {
      expect(window.localStorage.getItem("tengacion.gaming.last-game")).toBe("memory-atlas");
    });
    expect(await screen.findByTestId("game-memory-atlas")).toBeInTheDocument();

    firstRender.unmount();
    renderGamingPage();

    expect(await screen.findByTestId("game-memory-atlas")).toBeInTheDocument();
    expect(screen.queryByTestId("game-tengacion-racer")).not.toBeInTheDocument();

    const restoredLibrary = screen.getByRole("region", { name: "Pick your next lane" });
    expect(restoredLibrary.querySelector('[data-game-id="memory-atlas"]')).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });

  it("remains playable when browser storage is unavailable", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("Storage access denied", "SecurityError");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Storage access denied", "SecurityError");
    });

    expect(() => renderGamingPage()).not.toThrow();
    expect(screen.getByTestId("game-tengacion-racer")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Choose your lane. Keep your streak.",
      })
    ).toBeInTheDocument();
  });
});
