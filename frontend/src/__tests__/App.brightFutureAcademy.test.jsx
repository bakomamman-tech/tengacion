import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import App from "../App";
import { useAuth } from "../context/AuthContext";

vi.mock("../context/AuthContext", () => ({ useAuth: vi.fn() }));
vi.mock("../hooks/usePageTracking", () => ({ default: vi.fn() }));
vi.mock("../components/WelcomeVoiceController", () => ({ default: () => null }));
vi.mock("../components/seo/RouteSeoController", () => ({ default: () => null }));
vi.mock("../components/InstallPrompt", () => ({ default: () => null }));
vi.mock("../components/TopUpPromoDiscovery", () => ({ default: () => null }));
vi.mock("../components/assistant/TengacionAssistantDock", () => ({ default: () => null }));
vi.mock("../features/brightFutureAcademy/BrightFutureAcademyRoot", () => ({
  default: () => <main>Bright Future Academy canonical portal</main>,
  BrightFutureLowercaseRedirect: () => <main>Bright Future lowercase compatibility redirect</main>,
}));

describe("App Bright Future Academy routes", () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({ user: null, loading: false });
  });

  it("registers the exact public canonical route", async () => {
    render(<MemoryRouter initialEntries={["/Bright-Future-Academy"]}><App /></MemoryRouter>);
    expect(await screen.findByText("Bright Future Academy canonical portal")).toBeInTheDocument();
  });

  it("registers the lowercase compatibility route separately", async () => {
    render(<MemoryRouter initialEntries={["/bright-future-academy"]}><App /></MemoryRouter>);
    expect(await screen.findByText("Bright Future lowercase compatibility redirect")).toBeInTheDocument();
  });
});
