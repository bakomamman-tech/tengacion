import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import AdminAssistantPage from "../AdminAssistant";
import {
  adminGetAssistantMetrics,
  adminGetAssistantReviews,
  adminUpdateAssistantReview,
} from "../../api";

vi.mock("../../components/AdminShell", () => ({
  default: ({ title, subtitle, actions, children }) => (
    <div>
      <header>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </header>
      <div>{actions}</div>
      <main>{children}</main>
    </div>
  ),
}));

vi.mock("../../api", () => ({
  adminGetAssistantMetrics: vi.fn(),
  adminGetAssistantReviews: vi.fn(),
  adminUpdateAssistantReview: vi.fn(),
}));

const mockAdminUser = {
  id: "admin-1",
  role: "admin",
  permissions: ["view_audit_logs"],
};

const metricsPayload = {
  alerts: [
    {
      key: "akuso_prompt_injection_attempts",
      severity: "medium",
      title: "Akuso prompt injection attempts detected",
      value: 2,
      actionPath: "/admin/assistant/metrics",
    },
  ],
  live: {
    snapshotAt: "2026-04-15T08:00:00.000Z",
    uptimeSec: 8100,
    requests: {
      chat: 12,
      hints: 4,
      feedback: 3,
      templates: 1,
    },
    policy: {
      denials: {
        total: 2,
      },
    },
    responses: {
      total: 10,
      providers: {
        openai: 6,
        local_fallback: 3,
        policy_engine: 1,
      },
    },
  },
  historical: {
    window: {
      range: "30d",
      startDate: "2026-03-16T00:00:00.000Z",
      endDate: "2026-04-15T23:59:59.000Z",
    },
    requests: {
      policyDecisions: 20,
      modelAttempts: 8,
    },
    policy: {
      buckets: {
        SAFE_ANSWER: 12,
        SAFE_WITH_CAUTION: 2,
        APP_GUIDANCE: 3,
        SENSITIVE_ACTION_REQUIRES_AUTH: 1,
        DISALLOWED: 1,
        EMERGENCY_ESCALATION: 0,
        PROMPT_INJECTION_ATTEMPT: 1,
      },
    },
    responses: {
      providers: {
        openai: 6,
        policy_engine: 1,
      },
      localFallbackReasons: {
        model_router_local: 1,
        invalid_model_payload: 1,
        openai_error: 0,
      },
      routeBreakdown: {
        template: 1,
      },
    },
    security: {
      promptInjectionAttempts: 2,
      rateLimitHits: 1,
      openAIFailures: 1,
    },
    feedback: {
      notHelpful: 1,
      report: 0,
      quality: {
        helpfulRate: 0.5,
        negativeRate: 0.25,
      },
    },
    rates: {
      denialRate: 0.1,
      localFallbackRate: 0.3,
      promptInjectionRate: 0.1,
      openAIFailureRate: 0.125,
    },
  },
};

const openReview = {
  _id: "review-1",
  status: "open",
  severity: "medium",
  category: "feedback",
  mode: "app_help",
  surface: "creator_dashboard",
  reason: "The answer skipped the actual creator upload flow.",
  requestSummary: "How do I upload a song from my creator dashboard?",
  responseSummary: "Open your dashboard and use the upload tools.",
  responseId: "response-1",
  createdAt: "2026-04-15T07:45:00.000Z",
  resolutionNote: "",
  trust: {
    provider: "openai",
    mode: "app_aware",
    grounded: true,
    usedModel: true,
    confidenceLabel: "medium",
  },
};

const resolvedReview = {
  ...openReview,
  status: "resolved",
  resolutionNote: "Triaged and queued for prompt tuning.",
};

describe("AdminAssistantPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads assistant metrics, switches to reviews, and saves a triage update", async () => {
    vi.mocked(adminGetAssistantMetrics).mockResolvedValue(metricsPayload);
    vi.mocked(adminGetAssistantReviews)
      .mockResolvedValueOnce({
        items: [openReview],
        total: 1,
        page: 1,
        limit: 25,
        hasMore: false,
      })
      .mockResolvedValueOnce({
        items: [resolvedReview],
        total: 1,
        page: 1,
        limit: 25,
        hasMore: false,
      });
    vi.mocked(adminUpdateAssistantReview).mockResolvedValue({
      ok: true,
      item: resolvedReview,
    });

    render(
      <MemoryRouter initialEntries={["/admin/assistant/metrics"]}>
        <Routes>
          <Route path="*" element={<AdminAssistantPage user={mockAdminUser} />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText("Akuso prompt injection attempts detected")).toBeInTheDocument();
    expect(screen.getByText("Live Responses")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Reviews" }));

    expect(await screen.findByText("Review Queue")).toBeInTheDocument();
    expect(await screen.findAllByText(openReview.requestSummary)).toHaveLength(2);

    fireEvent.change(screen.getByLabelText("Review status"), {
      target: { value: "resolved" },
    });
    fireEvent.change(screen.getByLabelText("Resolution note"), {
      target: { value: "Triaged and queued for prompt tuning." },
    });

    fireEvent.click(screen.getByRole("button", { name: "Save Review State" }));

    await waitFor(() => {
      expect(adminUpdateAssistantReview).toHaveBeenCalledWith("review-1", {
        status: "resolved",
        resolutionNote: "Triaged and queued for prompt tuning.",
      });
    });

    expect(await screen.findByText("Assistant review updated.")).toBeInTheDocument();

    expect(adminGetAssistantReviews).toHaveBeenCalledTimes(2);
  });
});
