import { MemoryRouter } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import App from "../App";
import { useAuth } from "../context/AuthContext";

vi.mock("../context/AuthContext", () => ({
  useAuth: vi.fn(),
}));

vi.mock("../hooks/usePageTracking", () => ({ default: vi.fn() }));
vi.mock("../components/WelcomeVoiceController", () => ({ default: () => null }));
vi.mock("../components/seo/RouteSeoController", () => ({ default: () => null }));
vi.mock("../components/TopUpPromoDiscovery", () => ({
  default: () => <div>Top-up promotion overlay</div>,
}));
vi.mock("../components/InstallPrompt", () => ({
  default: () => <div>Install application overlay</div>,
}));
vi.mock("../components/assistant/TengacionAssistantDock", () => ({
  default: () => <div>Akuso assistant overlay</div>,
}));
vi.mock("../pages/MillionaireGamePage", () => ({
  default: () => <main>Focused Millionaire game</main>,
}));
vi.mock("../pages/Home", () => ({
  default: () => <main>Authenticated home</main>,
}));

describe("App focused game route", () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({
      user: { _id: "user-1", username: "ada" },
      loading: false,
    });
  });

  it("removes every unrelated floating overlay from the Millionaire game", async () => {
    render(
      <MemoryRouter initialEntries={["/millionaire"]}>
        <App />
      </MemoryRouter>
    );

    expect(await screen.findByText("Focused Millionaire game")).toBeInTheDocument();
    expect(screen.queryByText("Top-up promotion overlay")).not.toBeInTheDocument();
    expect(screen.queryByText("Install application overlay")).not.toBeInTheDocument();
    expect(screen.queryByText("Akuso assistant overlay")).not.toBeInTheDocument();
  });

  it("keeps the overlays available on ordinary authenticated pages", async () => {
    render(
      <MemoryRouter initialEntries={["/home"]}>
        <App />
      </MemoryRouter>
    );

    expect(await screen.findByText("Authenticated home")).toBeInTheDocument();
    expect(screen.getByText("Top-up promotion overlay")).toBeInTheDocument();
    expect(screen.getByText("Install application overlay")).toBeInTheDocument();
    expect(screen.getByText("Akuso assistant overlay")).toBeInTheDocument();
  });
});
