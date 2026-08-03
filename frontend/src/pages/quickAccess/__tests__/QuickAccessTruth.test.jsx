import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import {
  AdsManagerPage,
  EventsPage,
  MemoriesPage,
  ProfessionalDashboardPage,
  SavedPage,
} from "../QuickAccessPages";

vi.mock("../../../components/QuickAccessLayout", () => ({
  default: ({ title, subtitle, children }) => (
    <main>
      <h1>{title}</h1>
      <p>{subtitle}</p>
      {children}
    </main>
  ),
}));

const PREVIEW_SURFACES = [
  [ProfessionalDashboardPage, "Professional Dashboard is not available yet"],
  [MemoriesPage, "Memories is not available yet"],
  [SavedPage, "Saved is not available yet"],
  [EventsPage, "Events is not available yet"],
  [AdsManagerPage, "Ads Manager is not available yet"],
];

describe("quick access route truth", () => {
  it.each(PREVIEW_SURFACES)("renders %s as an honest Preview", (Page, heading) => {
    render(
      <MemoryRouter>
        <Page user={{ username: "truth_tester" }} />
      </MemoryRouter>
    );

    expect(screen.getByText("Preview")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: heading })).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("does not expose the former fabricated figures or sample activity", () => {
    render(
      <MemoryRouter>
        <ProfessionalDashboardPage user={{ username: "truth_tester" }} />
        <AdsManagerPage user={{ username: "truth_tester" }} />
      </MemoryRouter>
    );

    expect(screen.queryByText("4,812")).not.toBeInTheDocument();
    expect(screen.queryByText("$214")).not.toBeInTheDocument();
    expect(screen.queryByText(/latest post reached/i)).not.toBeInTheDocument();
  });
});
