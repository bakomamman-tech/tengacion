import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import RightQuickNav from "../RightQuickNav";

describe("RightQuickNav", () => {
  it("routes the Friends quick access item to Find Friends", () => {
    render(
      <MemoryRouter initialEntries={["/home"]}>
        <RightQuickNav />
      </MemoryRouter>
    );

    expect(screen.getByRole("link", { name: /friends/i })).toHaveAttribute(
      "href",
      "/find-friends"
    );
  });
});
