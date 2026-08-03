import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import AdminSettingsPage from "../AdminSettings";
import {
  adminGetAnalyticsSystemAlerts,
  adminGetSystemReadiness,
  adminGetUser,
} from "../../api";

vi.mock("../../components/AdminShell", () => ({
  default: ({ title, subtitle, actions, children }) => (
    <div>
      <header>
        <h1>{title}</h1>
        <p>{subtitle}</p>
        <div>{actions}</div>
      </header>
      <main>{children}</main>
    </div>
  ),
}));

vi.mock("../../api", () => ({
  adminGetAnalyticsSystemAlerts: vi.fn(),
  adminGetSystemReadiness: vi.fn(),
  adminGetUser: vi.fn(),
}));

describe("Admin Settings deployment readiness", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(adminGetAnalyticsSystemAlerts).mockResolvedValue({
      alerts: [],
      metrics: {
        failedPayments: 0,
        uploadFailures: 0,
        loginWarnings: 0,
        unresolvedReports: 0,
        repeatFailedUploads: 0,
      },
    });
    vi.mocked(adminGetUser).mockResolvedValue({
      role: "admin",
      status: "active",
    });
    vi.mocked(adminGetSystemReadiness).mockResolvedValue({
      status: "degraded",
      time: "2026-08-03T20:00:00.000Z",
      uptimeSeconds: 90,
      requiredFailures: ["database"],
      checks: {
        runtime: {
          status: "ok",
          required: true,
          message: "Runtime is accepting traffic.",
        },
        database: {
          status: "fail",
          required: true,
          message: "MongoDB is disconnected.",
        },
        media_storage: {
          status: "warn",
          required: false,
          message: "No durable media storage provider is fully configured.",
        },
      },
    });
  });

  it("shows protected dependency diagnostics and distinguishes required checks", async () => {
    render(
      <MemoryRouter>
        <AdminSettingsPage user={{ id: "admin-1", role: "admin" }} />
      </MemoryRouter>
    );

    expect(await screen.findByRole("heading", { name: "System Health" })).toBeInTheDocument();
    expect(screen.getAllByText("Degraded").length).toBeGreaterThan(0);
    expect(screen.getByText("Deployment readiness")).toBeInTheDocument();
    expect(screen.getByText("MongoDB is disconnected. Required for traffic.")).toBeInTheDocument();
    expect(
      screen.getByText("No durable media storage provider is fully configured. Advisory check.")
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(adminGetSystemReadiness).toHaveBeenCalledTimes(1);
      expect(adminGetAnalyticsSystemAlerts).toHaveBeenCalledWith({ range: "30d" });
      expect(adminGetUser).toHaveBeenCalledWith("admin-1");
    });
  });
});
