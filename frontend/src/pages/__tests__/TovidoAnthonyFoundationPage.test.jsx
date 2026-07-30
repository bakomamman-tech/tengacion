import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import TovidoAnthonyFoundationPage from "../TovidoAnthonyFoundationPage";

describe("TovidoAnthonyFoundationPage", () => {
  it("renders verified foundation details and working contact links", () => {
    render(<TovidoAnthonyFoundationPage />);

    expect(
      screen.getByRole("heading", {
        name: /restoring hope\. strengthening communities\./i,
      })
    ).toBeInTheDocument();
    expect(screen.getAllByText("9649700").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Kaduna, Nigeria").length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "Email the foundation" })).toHaveAttribute(
      "href",
      expect.stringContaining("mailto:tovidoanthonyfoundation@gmail.com")
    );
    expect(screen.getByRole("link", { name: "0904 242 0446" })).toHaveAttribute(
      "href",
      "tel:+2349042420446"
    );
  });

  it("opens the mobile menu and credits Tengacion Technologies Limited", () => {
    render(<TovidoAnthonyFoundationPage />);

    const menuButton = screen.getByRole("button", { name: "Open navigation" });
    fireEvent.click(menuButton);

    expect(menuButton).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("navigation", { name: "Foundation website navigation" })).toHaveClass(
      "is-open"
    );
    expect(
      screen.getByRole("link", { name: /designed by tengacion technologies limited/i })
    ).toHaveAttribute("href", "https://www.tengacion.com");
  });
});
