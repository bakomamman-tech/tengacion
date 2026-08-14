import { MemoryRouter } from "react-router-dom";
import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import TengaHarvestLandingPage from "./TengaHarvestLandingPage";
import { getTengaHarvestImpact, getTengaHarvestServices } from "./tengaHarvestApi";

vi.mock("../../components/seo/SeoHead", () => ({
  default: () => null,
}));

vi.mock("./tengaHarvestApi", () => ({
  getTengaHarvestImpact: vi.fn(),
  getTengaHarvestServices: vi.fn(),
}));

describe("TengaHarvestLandingPage", () => {
  beforeEach(() => {
    vi.mocked(getTengaHarvestServices).mockResolvedValue({ services: [] });
    vi.mocked(getTengaHarvestImpact).mockResolvedValue({});
  });

  it("links to the authoritative Tengacion leadership and contact pages", () => {
    render(
      <MemoryRouter initialEntries={["/tengaharvest"]}>
        <TengaHarvestLandingPage />
      </MemoryRouter>
    );

    const navigation = screen.getByRole("navigation", {
      name: "TengaHarvest navigation",
    });

    expect(within(navigation).getByRole("link", { name: "Leadership" })).toHaveAttribute(
      "href",
      "/leadership"
    );
    expect(within(navigation).getByRole("link", { name: "Contact" })).toHaveAttribute(
      "href",
      "/contact"
    );
  });
});
