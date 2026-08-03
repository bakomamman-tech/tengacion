import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
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
  default: () => <main>Public landing</main>,
}));
vi.mock("../pages/creator/CreatorFanPageViewPage", () => ({
  default: () => <main>Public creator profile</main>,
}));

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
}

const renderApp = (entry) =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <App />
      <LocationProbe />
    </MemoryRouter>
  );

describe("App creator route access contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue({ user: null, loading: false });
  });

  it("redirects the public artist alias without requiring login", async () => {
    renderApp("/artist/Creator.Example?source=legacy");

    expect(await screen.findByText("Public creator profile")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent(
        "/creator/creator.example?source=legacy"
      );
    });
    expect(screen.queryByText("Public landing")).not.toBeInTheDocument();
  });

  it("keeps reserved creator workspace routes protected", async () => {
    renderApp("/creator/dashboard");

    expect(await screen.findByText("Public landing")).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent("/");
    expect(screen.queryByText("Public creator profile")).not.toBeInTheDocument();
  });
});
