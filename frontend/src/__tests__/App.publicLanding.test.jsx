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
vi.mock("../components/InstallPrompt", () => ({ default: () => null }));
vi.mock("../components/assistant/TengacionAssistantDock", () => ({ default: () => null }));
vi.mock("../pages/PublicHomePage", () => ({
  default: () => <main>Public landing is ready</main>,
}));

describe("App public landing session restore", () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      loading: true,
    });
  });

  it("renders the landing page while session restoration is still pending", async () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>
    );

    expect(await screen.findByText("Public landing is ready")).toBeInTheDocument();
    expect(screen.queryByText("Loading Tengacion...")).not.toBeInTheDocument();
  });

  it("keeps non-public routes behind the session restoration gate", () => {
    render(
      <MemoryRouter initialEntries={["/home"]}>
        <App />
      </MemoryRouter>
    );

    expect(screen.getByText("Loading Tengacion...")).toBeInTheDocument();
  });
});
