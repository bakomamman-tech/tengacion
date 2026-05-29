import { MemoryRouter } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import PaywallModal from "../PaywallModal";

describe("PaywallModal", () => {
  it("shows visible Paystack trust and refund links near checkout", () => {
    render(
      <MemoryRouter>
        <PaywallModal
          open
          title="Firelight"
          price={1500}
          onClose={vi.fn()}
          onBuy={vi.fn()}
        />
      </MemoryRouter>
    );

    expect(screen.getByText(/paystack-secured checkout/i)).toBeInTheDocument();
    expect(screen.getByText(/secure payment powered by paystack/i)).toBeInTheDocument();
    expect(screen.getByText(/access unlocks only after backend verification/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /refund policy/i })).toHaveAttribute(
      "href",
      "/refund-policy"
    );
    expect(screen.getByRole("link", { name: /report payment issue/i })).toHaveAttribute(
      "href",
      "/contact"
    );
  });
});
