import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import KadahiveProgrammeArchive from "./KadahiveProgrammeArchive";

const renderArchive = (programme) =>
  render(
    <MemoryRouter>
      <KadahiveProgrammeArchive programme={programme} />
    </MemoryRouter>
  );

describe("Kadahive programme archives", () => {
  it("preserves the Kids Code curriculum without exposing an expired payment flow", () => {
    renderArchive("kids");

    expect(
      screen.getByRole("heading", { name: /transform screen time into creation time/i })
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Getting started" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Your first real script" })).toBeInTheDocument();
    expect(screen.getByText("₦50,000")).toBeInTheDocument();
    expect(screen.getByText(/no old bank-transfer or access-token flow is active/i)).toBeInTheDocument();
  });

  it("preserves the Cyber Smart agenda, access levels, and facilitators", () => {
    renderArchive("cyber");

    expect(
      screen.getByRole("heading", { name: /secure your digital life/i })
    ).toBeInTheDocument();
    expect(screen.getByText("Day 01 · The Shield")).toBeInTheDocument();
    expect(screen.getByText("Day 02 · The Sword")).toBeInTheDocument();
    expect(screen.getByText(/Ugwu Uriel · Cyber Analyst/i)).toBeInTheDocument();
    expect(screen.getByText(/Abdulrasheed Audu · Cybersecurity Consultant/i)).toBeInTheDocument();
    expect(screen.getByText(/historical records from February 2026/i)).toBeInTheDocument();
  });
});
