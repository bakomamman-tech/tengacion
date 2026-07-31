import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { loadKadahivePublic } from "../../api";
import KadahiveLanding from "./KadahiveLanding";

vi.mock("../../api", () => ({
  loadKadahivePublic: vi.fn(),
}));

describe("Kadahive public website", () => {
  beforeEach(() => {
    vi.mocked(loadKadahivePublic).mockResolvedValue({
      events: [
        {
          _id: "event-1",
          title: "Kaduna Builders Meetup",
          summary: "A practical evening for founders and technologists.",
          dateLabel: "14 August 2026",
          status: "published",
          category: "meetup",
        },
      ],
    });
  });

  it("renders the institution navigation, source content, and generated visual assets", async () => {
    render(
      <MemoryRouter initialEntries={["/kadahive"]}>
        <KadahiveLanding />
      </MemoryRouter>
    );

    expect(
      await screen.findByRole("heading", { name: "Kaduna Builders Meetup" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /building the future/i })
    ).toBeInTheDocument();
    const navigation = screen.getByRole("navigation", { name: /kadahive navigation/i });
    expect(navigation).toHaveTextContent("Services");
    expect(within(navigation).getByRole("link", { name: /member login/i })).toHaveAttribute(
      "href",
      "/kadahive/login"
    );
    expect(screen.getByRole("link", { name: /join our community/i })).toHaveAttribute(
      "href",
      "/kadahive/register"
    );
    expect(screen.getByText("Bank of Industry")).toBeInTheDocument();
    expect(screen.getByText("Kaduna State Government")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Co-working spaces" })).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: /kaduna innovators collaborating/i })
    ).toHaveAttribute("src", "/assets/kadahive/kadahive-innovation-hero.png");
  });
});
