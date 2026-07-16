import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../api", () => ({
  discoverTopUpPromoChest: vi.fn(),
  getTopUpPromoStatus: vi.fn(),
}));

import AdminTopUpPromoPreviewPage from "../AdminTopUpPromoPreview";

const admin = {
  _id: "admin-1",
  name: "Tengacion Admin",
  username: "tengacion_admin",
  role: "admin",
};

describe("AdminTopUpPromoPreviewPage", () => {
  it("shows all 103 placement coordinates without starting a game", () => {
    render(
      <MemoryRouter initialEntries={["/admin/top-up-bank-account-promo/preview"]}>
        <AdminTopUpPromoPreviewPage user={admin} />
      </MemoryRouter>
    );

    expect(screen.getAllByRole("button", { name: /inspect star position/i })).toHaveLength(103);
    expect(screen.getByText("All 103 application star placements")).toBeInTheDocument();
    expect(screen.getByText(/Creator, Marketplace, and Admin surfaces are excluded/i)).toBeInTheDocument();
  });

  it("previews the water and winning chest states with a demo-only passcode", () => {
    render(
      <MemoryRouter initialEntries={["/admin/top-up-bank-account-promo/preview"]}>
        <AdminTopUpPromoPreviewPage user={admin} />
      </MemoryRouter>
    );

    expect(screen.getByText(/Water drips from the chest/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Winning chest" }));
    expect(screen.getByText("You won ₦5,000!")).toBeInTheDocument();
    expect(screen.getByText("DEMO7K2Q")).toBeInTheDocument();
  });
});
